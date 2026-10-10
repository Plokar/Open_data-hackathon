"""Stav soubojů v DB. Synchronní funkce sdílené REST views a WS consumerem. Stav se persistuje po každém tahu.

state = {
  'fighters': {slot: fighter + team, user, pet, owner},   # sloty a–d
  'bots': [slot],                                          # strážce / boss
  'pending': {slot: {'move', 'target'}}, 'turn', 'deadline', 'start', 'result', 'boss': {...}
}
Režimy: 1v1 (ranked, friendly, practice), ffa = 3 hráči všichni proti všem, team = 2v2,
boss = 1–3 hráči (sloty a, c, d) proti bossovi ve slotu b; hostitel spouští souboj sám.
"""
import json
import random
from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone

from apps.game import badges, pets, rating
from apps.game.models import CheckIn, Pet
from apps.places.models import Place

from . import engine
from .models import Battle

TURN_SECONDS = 25  # vč. času na animace útoků
QUEUE_WINDOW = timedelta(seconds=60)
LEVEL_RANGE = 3
SLOTS = 'abcd'
SIZE = {'ranked': 2, 'friendly': 2, 'practice': 2, 'boss': 4, 'ffa': 3, 'team': 4}
TEAMS = {'team': {'a': 'red', 'b': 'blue', 'c': 'red', 'd': 'blue'},
         'boss': {'a': 'party', 'b': 'boss', 'c': 'party', 'd': 'party'}}  # jinde má každý slot svůj tým
XP = {'practice': (20, 6), 'boss': (90, 15)}  # tvorům (výhra, prohra), jinak 40 / 12; v sestavě se dělí podle zranění
PLAYER_XP = (20, 5)  # hráči do profilu (výhra, prohra) – i prohra něco dá
PVP = ('ranked', 'friendly', 'ffa', 'team')


class BattleError(Exception):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code, self.detail = code, detail


def team_of(mode, slot):
    return TEAMS.get(mode, {}).get(slot, slot)


def fighters(b):
    return b.state.setdefault('fighters', {})


def _fighter(pet, user, slot, mode):
    from apps.game.views import profile_of
    cats = [c for c, t in pets.CATEGORY_TYPE.items() if t == pet.type]
    same_type = CheckIn.objects.filter(user_id=pet.owner_id, place__category__in=cats).count()
    f = engine.fighter(pets.effective_stats(pet, same_type), pet.type, pet.name, pet.stage, pet.type2, pet.bonus_move,
                       pets.growth(pet.level, pet.stage))
    f.update(seed=pet.seed, rarity=pet.rarity, level=pet.level, team=team_of(mode, slot),
             user=user.id, pet=pet.id, owner=profile_of(user).nickname)
    return f


def _deadline():
    return (timezone.now() + timedelta(seconds=TURN_SECONDS)).isoformat()


def _start(b):
    if b.mode == 'boss':  # boss se přizpůsobí partě, každý hráč tím tento týden využil svůj souboj
        from . import bosses
        info, fs = b.state['boss'], fighters(b)
        place = Place.objects.get(pk=info['place'])
        week = datetime.fromisoformat(info['week']).date()
        party = [f for s, f in fs.items() if s != 'b']
        lineups = party + [f for bench in b.state.get('reserve', {}).values() for f in bench]
        fs['b'] = bosses.fighter(bosses.spec(place, week), lineups, len(party))
        bosses.record_attempts(User.objects.filter(pk__in=[f['user'] for f in party]), place, week)
    b.status = 'active'
    b.state.update({'turn': 1, 'pending': {}, 'deadline': _deadline()})
    b.state['start'] = {s: dict(f) for s, f in fighters(b).items()}  # pro přehrání z logu
    b.save()


def _check_pet(user, pet, mode):
    if pet.owner_id != user.id:
        raise BattleError('NOT_YOUR_PET', 'Tohle není tvůj PET.')
    if mode == 'ranked' and not pet.verified:
        raise BattleError('PET_NOT_VERIFIED', 'Do hodnoceného souboje smí jen ověření PETi (ne demo).')
    if pet.injured_until and pet.injured_until > timezone.now():
        mins = max(1, round((pet.injured_until - timezone.now()).total_seconds() / 60))
        raise BattleError('PET_INJURED', f'{pet.name} je zraněný z prohraného souboje. Léčí se ještě {mins} min.')


def _vs_bot(user, pet, mode, bot, seed, **extra):
    b = Battle.objects.create(player_a=user, pet_a=pet, mode=mode, seed=seed,
                              state={'fighters': {'a': _fighter(pet, user, 'a', mode), 'b': bot}, 'bots': ['b'], **extra})
    _start(b)
    return b


def create_practice(user, pet):
    _check_pet(user, pet, 'practice')
    seed = random.getrandbits(31)
    place = Place.objects.order_by('?').first()
    spec = pets.generate(place.id, place.category, 'common', 'bot', seed)
    # Strážce roste s tvým tvorem (level i evoluce), ať trénink zůstane výzvou.
    bot = engine.fighter(pets.scaled(spec, pet.level, pet.stage), spec['type'],
                         f'Strážce: {spec["species"]} ({place.name})', pet.stage, growth=pets.growth(pet.level, pet.stage))
    bot.update(seed=spec['seed'], rarity='common', level=pet.level, team='b', user=None, owner=None)
    return _vs_bot(user, pet, 'practice', bot, seed)


def create_boss(user, lineup, place, boss, week, solo=True):
    """Sólo: souboj hned, se sestavou až 3 tvorů (padlého nahradí další). Jinak čekárna s jedním tvorem,
    kam se přidají kamarádi na místě; hostitel ji spustí (start_boss)."""
    from . import bosses
    if not solo:
        lineup = lineup[:1]
    for pet in lineup:
        _check_pet(user, pet, 'boss')
    team = [_fighter(pet, user, 'a', 'boss') for pet in lineup]
    b = Battle.objects.create(player_a=user, pet_a=lineup[0], mode='boss', seed=random.getrandbits(31), state={
        'fighters': {'a': team[0], 'b': bosses.fighter(boss, team)}, 'bots': ['b'],
        'reserve': {'a': team[1:]} if len(team) > 1 else {},
        'boss': {'place': place.id, 'place_name': place.name, 'week': week.isoformat()}})
    if solo:
        _start(b)
    return b


@transaction.atomic
def start_boss(battle_id, user):
    b = Battle.objects.select_for_update().get(pk=battle_id)
    if b.mode != 'boss' or b.status != 'waiting':
        raise BattleError('NOT_WAITING', 'Souboj už začal nebo skončil.')
    if b.player_a_id != user.id:
        raise BattleError('NOT_HOST', 'Souboj spouští ten, kdo bosse vyzval.')
    _start(b)
    return b


def create_waiting(user, pet, mode, invited=None):
    _check_pet(user, pet, mode)
    return Battle.objects.create(player_a=user, pet_a=pet, mode=mode, seed=random.getrandbits(31), invited=invited,
                                 state={'fighters': {'a': _fighter(pet, user, 'a', mode)}})


def free_slots(b, team=None):
    taken = fighters(b)
    return [s for s in SLOTS[:SIZE[b.mode]] if s not in taken and team in (None, team_of(b.mode, s))]


@transaction.atomic
def join(battle_id, user, pet, team=None):
    """Přidá hráče do čekajícího souboje (1v1 i skupinového). U 2v2 si může vybrat tým. Plný souboj startuje."""
    b = Battle.objects.select_for_update().get(pk=battle_id)
    if b.status != 'waiting' or not free_slots(b):
        raise BattleError('NOT_WAITING', 'Souboj už začal nebo skončil.')
    if side_of(b, user.id):
        raise BattleError('SELF', 'Nemůžeš bojovat sám se sebou.' if SIZE[b.mode] == 2 else 'V tomhle souboji už jsi.')
    if b.invited_id and b.invited_id != user.id:
        raise BattleError('NOT_INVITED', 'Tahle výzva patří jinému hráči.')
    _check_pet(user, pet, b.mode)
    slot = (free_slots(b, team) or free_slots(b))[0]
    fighters(b)[slot] = _fighter(pet, user, slot, b.mode)
    if slot == 'b':  # druhý hráč i v modelu (fronta, výzvy přátel)
        b.player_b, b.pet_b = user, pet
    if free_slots(b):
        b.save()
    else:
        _start(b)
    return b


@transaction.atomic
def queue(user, pet):
    """ponytail: fronta v DB místo Redis (čekající ranked boje z poslední minuty), stačí na desítky hráčů."""
    _check_pet(user, pet, 'ranked')
    level = user.profile.level
    b = (Battle.objects.select_for_update(skip_locked=True)
         .filter(mode='ranked', status='waiting', player_b__isnull=True,
                 created_at__gte=timezone.now() - QUEUE_WINDOW,
                 player_a__profile__level__range=(level - LEVEL_RANGE, level + LEVEL_RANGE))
         .exclude(player_a=user).order_by('created_at').first())
    if b:
        return join(b.id, user, pet)
    Battle.objects.filter(player_a=user, mode='ranked', status='waiting').update(status='abandoned')
    return create_waiting(user, pet, 'ranked')


def side_of(b, user_id):
    if user_id is None:
        return None
    if b.player_a_id == user_id:
        return 'a'
    return next((s for s, f in b.state.get('fighters', {}).items() if f.get('user') == user_id), None)


def _humans_alive(b):
    return [s for s, f in sorted(fighters(b).items()) if f['hp'] > 0 and s not in b.state.get('bots', [])]


def _resolve(b):
    s, fs = b.state, fighters(b)
    for slot in s.get('bots', []):
        if fs[slot]['hp'] > 0:
            s['pending'][slot] = engine.bot_pick(fs, slot, b.seed + ord(slot), s['turn'])
    turn = s['turn']
    events = engine.resolve(fs, s['pending'], b.seed, turn)
    # zranění podle tvorů (XP v sestavě se dělí podle toho, kolik kdo dal)
    dmg = s.setdefault('dmg', {})
    for e in events:
        pet_id = fs[e['actor']].get('pet')
        total = e.get('damage', 0) + sum(x['damage'] for x in e.get('more', ()))  # plošné kouzlo zasáhne víc soupeřů
        if total and pet_id:
            dmg[str(pet_id)] = dmg.get(str(pet_id), 0) + total
    # padlého tvora ze sestavy nahradí další
    for slot, bench in s.get('reserve', {}).items():
        if fs[slot]['hp'] <= 0 and bench:
            s.setdefault('fallen', {}).setdefault(slot, []).append(fs[slot]['pet'])
            fs[slot] = bench.pop(0)
            events.append({'actor': slot, 'move': 'swap', 'kind': 'swap', 'fx': 'swap', 'cost': 0, 'name': fs[slot]['name'],
                           'fighter': _public(slot, fs[slot])})
    b.log.append({'turn': turn, 'moves': dict(s['pending']), 'events': events})
    w = engine.outcome(fs, turn)
    s.update({'turn': turn + 1, 'pending': {}, 'deadline': _deadline()})
    if w:
        _finish(b, w)
    b.save()


def _finish(b, w):
    from apps.game.views import pet_json, profile_of
    b.status, b.winner, b.finished_at = 'finished', w, timezone.now()
    boss = b.state.get('boss')
    result = {}
    dmg = b.state.get('dmg', {})
    for slot, f in fighters(b).items():
        if not f.get('user'):
            continue
        user = User.objects.get(pk=f['user'])
        won = w != 'draw' and f['team'] == w
        lost = not won and w != 'draw'
        before = rating.compute(user)  # před uložením tvora, ať „+N“ ukazuje jen tenhle souboj
        xp = XP.get(b.mode, (40, 12))[0 if won else 1]
        # tvorové, kteří bojovali: padlí ze sestavy + ten, kdo stál v aréně na konci
        fallen = b.state.get('fallen', {}).get(slot, [])
        used = Pet.objects.in_bulk(fallen + [f['pet']])
        shares = split_xp(xp, [pid for pid in fallen + [f['pet']] if pid in used], dmg)
        pet_results, injured = [], None
        for pid, gain in shares.items():
            pet = used[pid]
            old = pet.level
            pet.xp += gain
            pet.level = pets.level_for_xp(pet.xp)
            # padlý tvor (i ve vyhraném souboji) a tvor poraženého hráče se 30 min léčí
            if pid in fallen or (pid == f['pet'] and (f['hp'] <= 0 or lost)):
                pet.injured_until = timezone.now() + pets.INJURY
                injured = pet.injured_until.isoformat()
            pet.save(update_fields=['xp', 'level', 'injured_until'])
            pet_results.append({'id': pid, 'name': pet.name, 'xp': gain, 'damage': dmg.get(str(pid), 0),
                                'level_up': pet.level if pet.level > old else None, 'injured': pet.injured_until is not None and pet.injured_until > timezone.now(),
                                'can_evolve': pets.can_evolve(pet)})
        pet = used.get(f['pet'])
        level_up = next((r['level_up'] for r in pet_results if r['id'] == f['pet']), None)
        prof = profile_of(user)
        player_xp = PLAYER_XP[0 if won else 1]
        prof.add_xp(player_xp)
        if won:
            prof.wins += int(b.mode in PVP)  # výhry na profilu a v žebříčku: jen proti hráčům
            prof.battle_points += rating.WIN_POINTS[b.mode]
        prof.save()
        reward = None
        if won and boss:
            from . import bosses
            place = Place.objects.get(pk=boss['place'])
            trophy = bosses.reward(user, place, datetime.fromisoformat(boss['week']).date())
            new_badges = badges.evaluate(user)
            player_xp += badges.BADGE_XP * len(new_badges)
            prof.add_xp(badges.BADGE_XP * len(new_badges))
            # state je JSONField: datumy z pet_json převést na text
            pet_data = trophy and json.loads(json.dumps(pet_json(trophy), cls=DjangoJSONEncoder))
            reward = {'pet': pet_data, 'badges': [{'code': x.code, 'name': x.name, 'icon': x.icon} for x in new_badges]}
        prof.rating = rating.compute(user)
        prof.save(update_fields=['rating', 'xp', 'level'])
        result[slot] = {'xp': xp, 'player_xp': player_xp, 'pets': pet_results, 'rating_delta': prof.rating - before,
                        'level_up': level_up, 'injured_until': injured, 'reward': reward,
                        'can_evolve': any(r['can_evolve'] for r in pet_results)}
    b.state['result'] = result


def split_xp(xp, pet_ids, dmg):
    """XP souboje mezi tvory podle zranění, které dali (bez zranění rovným dílem). {pet_id: xp}"""
    if not pet_ids:
        return {}
    total = sum(dmg.get(str(p), 0) for p in pet_ids)
    if not total:
        return {p: xp // len(pet_ids) for p in pet_ids}
    return {p: round(xp * dmg.get(str(p), 0) / total) for p in pet_ids}


@transaction.atomic
def submit_move(battle_id, user_id, turn, move, target=None):
    b = Battle.objects.select_for_update().get(pk=battle_id)
    slot, s = side_of(b, user_id), b.state
    if b.status != 'active' or slot is None or move not in engine.MOVES or turn != s['turn'] or slot in s['pending']:
        return False  # duplicitní / opožděný / neplatný tah se ignoruje (10)
    f = fighters(b)[slot]
    if f['hp'] <= 0 or not engine.can_use(f, move):
        return False
    s['pending'][slot] = {'move': move, 'target': target if target in engine.enemies(fighters(b), slot) else None}
    if all(x in s['pending'] for x in _humans_alive(b)):
        _resolve(b)
    else:
        b.save(update_fields=['state'])
    return True


@transaction.atomic
def timeout(battle_id, turn):
    """Po vypršení tahu doplní chybějící tahy Útokem na nejslabšího soupeře. Idempotentní (kontroluje číslo tahu)."""
    b = Battle.objects.select_for_update().get(pk=battle_id)
    if b.status != 'active' or b.state['turn'] != turn or timezone.now() < datetime.fromisoformat(b.state['deadline']):
        return False
    for slot in _humans_alive(b):
        b.state['pending'].setdefault(slot, {'move': 'attack', 'target': None})
    _resolve(b)
    return True


PUBLIC = ('hp', 'max_hp', 'guard', 'type', 'type2', 'name', 'seed', 'stage', 'rarity', 'level', 'team', 'owner', 'boss', 'status')


def _public(slot, f):
    return {**{k: f.get(k) for k in PUBLIC}, 'slot': slot, 'sp': f.get('sp'), 'max_sp': f.get('max_sp')}


def view(b, slot):
    """Stav z pohledu hráče (slot; None = divák). Výdrž je vidět jen u sebe a spojenců."""
    s, fs = b.state, b.state.get('fighters', {})
    me = fs.get(slot)
    out = []
    for x, f in sorted(fs.items()):
        d = {k: f.get(k) for k in PUBLIC}
        d.update(slot=x, me=x == slot, ally=bool(me) and f['team'] == me['team'])
        if d['ally']:
            d.update(sp=f['sp'], max_sp=f['max_sp'])
        out.append(d)
    active = b.status == 'active'
    pending = s.get('pending', {})
    return {'type': 'state', 'battle_id': str(b.id), 'mode': b.mode, 'size': SIZE[b.mode], 'status': b.status,
            'turn': s.get('turn'), 'deadline': s.get('deadline'), 'me': slot if me else None, 'fighters': out,
            'moves': me and [{'id': m, **engine.MOVES[m], 'type': me['type']} for m in me['moves']],
            'waiting_for_you': active and bool(me) and me['hp'] > 0 and slot not in pending,
            'waiting_for': [fs[x]['owner'] for x in _humans_alive(b) if x not in pending] if active else [],
            'is_bot': bool(s.get('bots')), 'boss': s.get('boss'),
            # sestava na bosse: kdo ještě čeká na střídačce
            'reserve': {x: [{k: f.get(k) for k in PUBLIC} for f in bench] for x, bench in s.get('reserve', {}).items()}}


def turn_result(entry, slot=None):
    return {'type': 'turn_result', 'turn': entry['turn'], 'events': entry['events']}


def battle_end(b, slot):
    fs = b.state.get('fighters', {})
    me = fs.get(slot)
    w = 'draw' if b.winner == 'draw' else ('you' if me and me['team'] == b.winner else 'opp')
    r = b.state.get('result', {}).get(slot, {})
    return {'type': 'battle_end', 'winner': w, 'xp': r.get('xp', 0), 'rating_delta': r.get('rating_delta', 0),
            'player_xp': r.get('player_xp', 0), 'pets': r.get('pets', []),
            'winners': [f.get('owner') or f['name'] for f in fs.values() if f['team'] == b.winner],
            'level_up': r.get('level_up'), 'injured_until': r.get('injured_until'), 'can_evolve': r.get('can_evolve', False),
            'reward': r.get('reward')}
