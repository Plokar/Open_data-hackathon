"""Stav soubojů v DB. Synchronní funkce sdílené REST views a WS consumerem. Stav se persistuje po každém tahu."""
import random
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from apps.game import pets
from apps.game.models import CheckIn
from apps.places.models import Place

from . import engine
from .models import Battle

TURN_SECONDS = 25  # vč. času na animace útoků
QUEUE_WINDOW = timedelta(seconds=60)
LEVEL_RANGE = 3


class BattleError(Exception):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code, self.detail = code, detail


def _fighter(pet):
    cats = [c for c, t in pets.CATEGORY_TYPE.items() if t == pet.type]
    same_type = CheckIn.objects.filter(user_id=pet.owner_id, place__category__in=cats).count()
    return {**engine.fighter(pets.effective_stats(pet, same_type), pet.type, pet.name, pet.stage),
            'seed': pet.seed, 'rarity': pet.rarity, 'level': pet.level}


def _deadline():
    return (timezone.now() + timedelta(seconds=TURN_SECONDS)).isoformat()


def _start(b):
    b.status = 'active'
    b.state.update({'turn': 1, 'pending': {}, 'deadline': _deadline()})
    b.state['start'] = {'a': dict(b.state['a']), 'b': dict(b.state['b'])}  # pro přehrání z logu
    b.save()


def _check_pet(user, pet, mode):
    if pet.owner_id != user.id:
        raise BattleError('NOT_YOUR_PET', 'Tohle není tvůj PET.')
    if mode == 'ranked' and not pet.verified:
        raise BattleError('PET_NOT_VERIFIED', 'Do hodnoceného souboje smí jen ověření PETi (ne demo).')
    if pet.injured_until and pet.injured_until > timezone.now():
        mins = max(1, round((pet.injured_until - timezone.now()).total_seconds() / 60))
        raise BattleError('PET_INJURED', f'{pet.name} je zraněný z prohraného souboje. Léčí se ještě {mins} min.')


def create_practice(user, pet):
    _check_pet(user, pet, 'practice')
    seed = random.getrandbits(31)
    place = Place.objects.order_by('?').first()
    spec = pets.generate(place.id, place.category, 'common', 'bot', seed)
    # Strážce roste s tvým tvorem (level i evoluce), ať trénink zůstane výzvou.
    bot = engine.fighter(pets.scaled(spec, pet.level, pet.stage), spec['type'],
                         f'Strážce: {spec["species"]} ({place.name})', pet.stage)
    bot.update(seed=spec['seed'], rarity='common', level=pet.level)
    b = Battle.objects.create(player_a=user, pet_a=pet, mode='practice', seed=seed,
                              state={'a': _fighter(pet), 'b': bot, 'bot': True})
    _start(b)
    return b


def create_waiting(user, pet, mode):
    _check_pet(user, pet, mode)
    return Battle.objects.create(player_a=user, pet_a=pet, mode=mode, seed=random.getrandbits(31),
                                 state={'a': _fighter(pet)})


@transaction.atomic
def join(battle_id, user, pet):
    b = Battle.objects.select_for_update().get(pk=battle_id)
    if b.status != 'waiting' or b.player_b_id:
        raise BattleError('NOT_WAITING', 'Souboj už začal nebo skončil.')
    if b.player_a_id == user.id:
        raise BattleError('SELF', 'Nemůžeš bojovat sám se sebou.')
    _check_pet(user, pet, b.mode)
    b.player_b, b.pet_b = user, pet
    b.state['b'] = _fighter(pet)
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
    return 'a' if b.player_a_id == user_id else 'b' if b.player_b_id == user_id else None


def _resolve(b):
    s = b.state
    turn, pending = s['turn'], s['pending']
    events = engine.resolve_turn(s['a'], s['b'], pending['a'], pending['b'], b.seed, turn)
    b.log.append({'turn': turn, 'moves': dict(pending), 'events': events})
    w = engine.winner(s['a'], s['b'], turn)
    s.update({'turn': turn + 1, 'pending': {}, 'deadline': _deadline()})
    if w:
        _finish(b, w)
    b.save()


def _finish(b, w):
    from apps.game.views import profile_of
    b.status, b.winner, b.finished_at = 'finished', w, timezone.now()
    result = {}
    for side, user, pet in (('a', b.player_a, b.pet_a), ('b', b.player_b, b.pet_b)):
        if user is None:
            continue
        won = w == side
        xp = (40 if won else 12) // (2 if b.mode == 'practice' else 1)
        rating_delta = 0
        level_up, injured = None, None
        if pet:
            old = pet.level
            pet.xp += xp
            pet.level = pets.level_for_xp(pet.xp)
            level_up = pet.level if pet.level > old else None
            if not won and w != 'draw':  # poražený tvor je zraněný a chvíli nemůže bojovat
                pet.injured_until = timezone.now() + pets.INJURY
                injured = pet.injured_until.isoformat()
            pet.save(update_fields=['xp', 'level', 'injured_until'])
        prof = profile_of(user)
        if won:
            prof.add_xp(20)
        if b.mode == 'ranked':
            opp = profile_of(b.player_b if side == 'a' else b.player_a)
            expected = 1 / (1 + 10 ** ((opp.rating - prof.rating) / 400))
            rating_delta = round(32 * ((1 if won else 0.5 if w == 'draw' else 0) - expected))
            prof.rating += rating_delta
            prof.wins += int(won)
        prof.save()
        result[side] = {'xp': xp, 'rating_delta': rating_delta, 'level_up': level_up, 'injured_until': injured,
                        'can_evolve': bool(pet and pets.can_evolve(pet))}
    b.state['result'] = result


@transaction.atomic
def submit_move(battle_id, user_id, turn, move):
    b = Battle.objects.select_for_update().get(pk=battle_id)
    side = side_of(b, user_id)
    if b.status != 'active' or side is None or move not in engine.MOVES or turn != b.state['turn'] \
            or side in b.state['pending'] or not engine.can_use(b.state[side], move):
        return False  # duplicitní / opožděný / neplatný tah se ignoruje (10)
    b.state['pending'][side] = move
    if b.state.get('bot'):
        b.state['pending']['b'] = engine.bot_move(b.state['b'], b.seed, turn)
    if len(b.state['pending']) == 2:
        _resolve(b)
    else:
        b.save(update_fields=['state'])
    return True


@transaction.atomic
def timeout(battle_id, turn):
    """Po vypršení tahu doplní chybějící tahy Útokem. Idempotentní (kontroluje číslo tahu)."""
    b = Battle.objects.select_for_update().get(pk=battle_id)
    if b.status != 'active' or b.state['turn'] != turn or timezone.now() < datetime.fromisoformat(b.state['deadline']):
        return False
    for side in 'ab':
        b.state['pending'].setdefault(side, engine.bot_move(b.state['b'], b.seed, turn) if side == 'b' and b.state.get('bot') else 'attack')
    _resolve(b)
    return True


def view(b, side):
    """Stav z pohledu hráče (you/opp) – tvar zprávy `state` z PROJECT_SPEC 10."""
    s, opp = b.state, 'b' if side == 'a' else 'a'
    pub = lambda f: f and {k: f.get(k) for k in ('hp', 'max_hp', 'sp', 'max_sp', 'guard', 'type', 'name', 'seed',
                                                    'stage', 'rarity', 'level')}
    you = pub(s.get(side))
    if you:  # vlastní tahy jen pro hráče, soupeřova kouzla uvidí až v boji
        you['moves'] = [{'id': m, **engine.MOVES[m], 'type': s[side]['type']} for m in s[side].get('moves', engine.BASIC)]
    return {'type': 'state', 'battle_id': str(b.id), 'mode': b.mode, 'status': b.status, 'turn': s.get('turn'),
            'you': you, 'opp': pub(s.get(opp)), 'deadline': s.get('deadline'),
            'waiting_for_you': b.status == 'active' and side not in s.get('pending', {}), 'is_bot': bool(s.get('bot'))}


def turn_result(entry, side):
    me = lambda a: 'you' if a == side else 'opp'
    return {'type': 'turn_result', 'turn': entry['turn'], 'events': [{**e, 'actor': me(e['actor'])} for e in entry['events']]}


def battle_end(b, side):
    w = 'draw' if b.winner == 'draw' else ('you' if b.winner == side else 'opp')
    r = b.state.get('result', {}).get(side, {})
    return {'type': 'battle_end', 'winner': w, 'xp': r.get('xp', 0), 'rating_delta': r.get('rating_delta', 0),
            'level_up': r.get('level_up'), 'injured_until': r.get('injured_until'), 'can_evolve': r.get('can_evolve', False)}
