"""Tahový battle engine (PROJECT_SPEC 7.3). Čistý Python bez Django, boj jde z logu přesně přehrát.

Každý tah stojí výdrž (sp), ta se po tahu o kus obnoví. Fyzické útoky jdou přes `atk`, kouzla přes `mag`.
Každé kouzlo má živel (`elem`): proti typu, který jeho živel poráží, dává 1,5×, proti silnějšímu jen 0,75×.
Fyzické útoky jsou bez živlu. Kouzla se navíc liší efektem (stavy, průraz Obrany, víc zásahů, kombo…),
takže na každého soupeře se hodí něco jiného. `fx` je jen nápověda pro frontend, jakou animaci zahrát.

Bojovníci sedí ve slotech ('a'…'d') a každý má `team`. 1v1 = dva týmy, „všichni proti všem“ = každý
svůj tým, 2v2 = dva týmy po dvou. Útok míří na zvolený cíl; když cíl chybí nebo už padl, na nejslabšího soupeře.
"""
import copy
import math
import random

# kind: phys / magic / guard. power 0 = podpůrné kouzlo. elem = živel (None = bez živlu, vždy 1×).
# Volitelné vlastnosti tahu:
#   heal       % max HP (léčivé kouzlo, Hradní štít)       drain    % způsobeného zranění zpět jako život
#   status     (stav, tahy) na cíl po zásahu                self_status (stav, tahy) na sebe
#   break      prorazí Obranu cíle (plné zranění)           solid    Obrana, kterou nic neprorazí
#   pierce     ignoruje tuto část obrany cíle               first    jde první bez ohledu na rychlost
#   sap        ubere cíli tolik výdrže                      hits     počet zásahů (power je na jeden)
#   vs         {stav: násobek} proti cíli v tom stavu       per_status  +x za každý neduh cíle (nejvýš 3)
#   cleanse    smaže vlastní neduhy                         aoe      zasáhne všechny soupeře
MOVES = {
    'attack': {'name': 'Útok', 'kind': 'phys', 'elem': None, 'power': 40, 'acc': 1.0, 'cost': 0, 'fx': 'slash'},
    'heavy': {'name': 'Silný úder', 'kind': 'phys', 'elem': None, 'power': 70, 'acc': 0.75, 'cost': 25, 'fx': 'smash', 'break': True},
    'guard': {'name': 'Obrana', 'kind': 'guard', 'elem': None, 'power': 0, 'acc': 1.0, 'cost': 0, 'fx': 'shield'},

    'rockfall': {'name': 'Kamenná lavina', 'kind': 'magic', 'elem': 'fortress', 'power': 55, 'acc': 0.95, 'cost': 25,
                 'status': ('slow', 2), 'fx': 'boulders'},
    'bastion': {'name': 'Hradní štít', 'kind': 'guard', 'elem': 'fortress', 'power': 0, 'acc': 1.0, 'cost': 30,
                'heal': 0.15, 'solid': True, 'fx': 'wall'},
    'siege_fire': {'name': 'Ohnivá střela z hradeb', 'kind': 'magic', 'elem': 'fortress', 'power': 90, 'acc': 0.85, 'cost': 50,
                   'status': ('burn', 3), 'fx': 'fireball'},

    'gust': {'name': 'Vichřice', 'kind': 'magic', 'elem': 'view', 'power': 45, 'acc': 1.0, 'cost': 20,
             'first': True, 'sap': 15, 'fx': 'gust'},
    'thunder': {'name': 'Blesk z výšin', 'kind': 'magic', 'elem': 'view', 'power': 75, 'acc': 0.85, 'cost': 40,
                'vs': {'wet': 1.6}, 'fx': 'bolt'},
    'sunbeam': {'name': 'Sluneční paprsek', 'kind': 'magic', 'elem': 'view', 'power': 95, 'acc': 0.9, 'cost': 55,
                'pierce': 0.5, 'fx': 'sunbeam'},

    'vines': {'name': 'Šlahouny', 'kind': 'magic', 'elem': 'nature', 'power': 45, 'acc': 0.95, 'cost': 25, 'drain': 0.5,
              'status': ('root', 2), 'fx': 'vines'},
    'spores': {'name': 'Pylová bouře', 'kind': 'magic', 'elem': 'nature', 'power': 55, 'acc': 0.95, 'cost': 30,
               'status': ('weak', 2), 'fx': 'pollen'},
    'forest_wrath': {'name': 'Hněv pralesa', 'kind': 'magic', 'elem': 'nature', 'power': 90, 'acc': 0.85, 'cost': 50,
                     'vs': {'root': 1.5}, 'fx': 'forest'},

    'jet': {'name': 'Vodní tryska', 'kind': 'magic', 'elem': 'spring', 'power': 50, 'acc': 1.0, 'cost': 20,
            'status': ('wet', 2), 'fx': 'jet'},
    'healing_spring': {'name': 'Léčivý pramen', 'kind': 'magic', 'elem': 'spring', 'power': 0, 'acc': 1.0, 'cost': 35,
                       'heal': 0.3, 'cleanse': True, 'fx': 'spring'},
    'geyser': {'name': 'Gejzír', 'kind': 'magic', 'elem': 'spring', 'power': 85, 'acc': 0.85, 'cost': 50,
               'break': True, 'status': ('wet', 2), 'fx': 'geyser'},

    'echo': {'name': 'Ozvěna varhan', 'kind': 'magic', 'elem': 'culture', 'power': 45, 'acc': 1.0, 'cost': 20,
             'status': ('daze', 1), 'fx': 'echo'},
    'fresco_curse': {'name': 'Kletba fresek', 'kind': 'magic', 'elem': 'culture', 'power': 60, 'acc': 0.9, 'cost': 35,
                     'drain': 0.5, 'status': ('curse', 3), 'fx': 'curse'},
    'choir': {'name': 'Nebeský chorál', 'kind': 'magic', 'elem': 'culture', 'power': 80, 'acc': 0.9, 'cost': 50,
              'per_status': 0.25, 'fx': 'choir'},

    'honey': {'name': 'Medová střela', 'kind': 'magic', 'elem': 'taste', 'power': 45, 'acc': 1.0, 'cost': 20, 'drain': 0.3,
              'status': ('sticky', 2), 'fx': 'honey'},
    'feast': {'name': 'Hostina', 'kind': 'magic', 'elem': 'taste', 'power': 0, 'acc': 1.0, 'cost': 35, 'heal': 0.2,
              'self_status': ('fed', 2), 'fx': 'feast'},
    'cake_storm': {'name': 'Koláčová smršť', 'kind': 'magic', 'elem': 'taste', 'power': 34, 'hits': 3, 'acc': 0.9, 'cost': 50,
                   'fx': 'cakes'},
}
# Vyšlechtěná kouzla: dají se získat jen spojením dvou tvorů (apps.game.pets.merge).
BRED = {
    'aurora': {'name': 'Polární záře', 'kind': 'magic', 'elem': None, 'power': 80, 'acc': 1.0, 'cost': 45,
               'cleanse': True, 'fx': 'aurora'},
    'quake': {'name': 'Krušnohorské zemětřesení', 'kind': 'magic', 'elem': 'fortress', 'power': 75, 'acc': 0.9, 'cost': 50,
              'aoe': True, 'break': True, 'fx': 'quake'},
    'meteor': {'name': 'Meteorický roj', 'kind': 'magic', 'elem': 'view', 'power': 110, 'acc': 0.8, 'cost': 60,
               'status': ('burn', 3), 'fx': 'meteor'},
    'living_water': {'name': 'Živá voda', 'kind': 'magic', 'elem': 'spring', 'power': 0, 'acc': 1.0, 'cost': 45,
                     'heal': 0.45, 'cleanse': True, 'fx': 'living_water'},
    'leech_bloom': {'name': 'Pijavý květ', 'kind': 'magic', 'elem': 'nature', 'power': 55, 'acc': 0.95, 'cost': 35,
                    'drain': 0.7, 'status': ('root', 2), 'fx': 'bloom'},
    'twin_bolt': {'name': 'Dvojitý blesk', 'kind': 'magic', 'elem': 'view', 'power': 50, 'hits': 2, 'acc': 0.9, 'cost': 50,
                  'vs': {'wet': 1.6}, 'fx': 'twin_bolt'},
}
MOVES.update(BRED)
BASIC = ['attack', 'heavy', 'guard']
# Kouzla typu podle stupně evoluce: stupeň 1 má první, stupeň 3 všechna tři.
MAGIC = {
    'fortress': ['rockfall', 'bastion', 'siege_fire'],
    'view': ['gust', 'thunder', 'sunbeam'],
    'nature': ['vines', 'spores', 'forest_wrath'],
    'spring': ['jet', 'healing_spring', 'geyser'],
    'culture': ['echo', 'fresco_curse', 'choir'],
    'taste': ['honey', 'feast', 'cake_storm'],
}
MAX_TURNS = 30
# ponytail: ladicí konstanta, aby boj trval ~5–8 tahů (vzorec ze specu dává 66 dmg na 100 HP)
DAMAGE_SCALE = 0.25
# Obnova výdrže za tah v bodech, ne v % z max: s procenty silný tvor nabíral víc, než stojí nejsilnější kouzlo,
# a mohl ho opakovat donekonečna. Takhle z plné výdrže (~100) vyjdou dvě silná kouzla a pak je potřeba šetřit.
SP_REGEN = 8
GUARD_REGEN = 15  # obrana navíc
BEATS = {'fortress': 'view', 'view': 'nature', 'nature': 'spring', 'spring': 'culture', 'culture': 'fortress'}

# Stavy. Trvají daný počet tahů počítaných od dalšího tahu: v tahu, kdy vzniknou, ještě neubývají ani nepálí.
#   burn hoří (−6 % max HP za tah)   wet promočený (blesk víc, nehoří)   root spoutaný (nemůže se krýt)
#   weak oslabený (útok a magie ×0,7)  slow zpomalený (rychlost ×0,5)  curse prokletý (léčení napůl)
#   daze omámený (35 % šance, že tah nevyjde)  sticky zalepený (výdrž se neobnovuje)  fed sytý (útok a magie ×1,3)
BUFFS = {'fed'}
BURN, DAZE, WEAK, FED = 0.06, 0.35, 0.7, 1.3


def type_mult(attacker, defender):
    if BEATS.get(attacker) == defender:
        return 1.5
    if BEATS.get(defender) == attacker:
        return 0.75
    return 1.0


def moves_for(pet_type, stage=1, type2='', bonus=''):
    """Základní tahy, kouzla typu podle evoluce, u křížence první kouzlo druhého typu, vyšlechtěné kouzlo."""
    moves = BASIC + MAGIC[pet_type][:stage]
    if type2 and type2 != pet_type:
        moves.append(MAGIC[type2][0])
    if bonus in MOVES and bonus not in moves:
        moves.append(bonus)
    return moves


def fighter(stats, pet_type, name='', stage=1, type2='', bonus='', growth=1.0):
    """`growth` = násobek statů za level a evoluci (pets.growth), viz _strike."""
    sp = stats.get('stamina', 100)
    return {'hp': stats['hp'], 'max_hp': stats['hp'], 'atk': stats['atk'], 'defense': stats['defense'], 'growth': growth,
            'spd': stats['spd'], 'mag': stats.get('mag', stats['atk']), 'sp': sp, 'max_sp': sp,
            'type': pet_type, 'type2': type2, 'name': name, 'stage': stage, 'guard': False, 'status': {},
            'moves': moves_for(pet_type, stage, type2, bonus)}


def can_use(f, move):
    return move in f.get('moves', BASIC) and f['sp'] >= MOVES[move]['cost']


def _event(side, move, **kw):
    m = MOVES[move]
    return {'actor': side, 'move': move, 'name': m['name'], 'kind': m['kind'], 'fx': m['fx'], 'cost': m['cost'],
            'elem': m['elem'], **kw}


def enemies(fs, slot):
    return [t for t in sorted(fs) if fs[t]['team'] != fs[slot]['team'] and fs[t]['hp'] > 0]


def _target(fs, slot, wanted):
    alive = enemies(fs, slot)
    if not alive:
        return None
    return wanted if wanted in alive else min(alive, key=lambda t: (fs[t]['hp'], t))


def _ailments(f):
    return len(set(f.get('status', {})) - BUFFS)


def _bonus(m, target_status):
    """Kombo: násobek za stav cíle (blesk na promočeného, prales na spoutaného, chorál za každý neduh)."""
    bonus = math.prod(x for st, x in m.get('vs', {}).items() if st in target_status)
    if m.get('per_status'):
        bonus *= 1 + m['per_status'] * min(3, len(set(target_status) - BUFFS))
    return bonus


def _heal(f, amount):
    """Vyléčí (prokletému jen napůl), vrátí kolik."""
    heal = max(0, min(f['max_hp'] - f['hp'], math.floor(amount * (0.5 if 'curse' in f['status'] else 1))))
    f['hp'] += heal
    return heal


def _apply(f, slot, name, turns, fresh, source=None):
    """Přidá stav. Vrací pole pro událost: status, nebo resisted (mokrého nic nezapálí) / extinguished."""
    st = f['status']
    if name == 'burn' and 'wet' in st:
        return {'resisted': name}
    out = {'status': name}
    if name == 'wet' and st.pop('burn', None):
        out['extinguished'] = True
    st[name] = max(st.get(name, 0), turns)
    fresh.add((slot, name))
    if name == 'burn':
        f['burn_by'] = source
    return out


def _cleanse(f):
    gone = sorted(set(f['status']) - BUFFS)
    for name in gone:
        del f['status'][name]
    return gone


def _strike(rng, fs, s, t, m, fresh):
    """Jeden útok na jeden cíl. Vrátí (výsledek pro událost, kolik vysát)."""
    me, opp = fs[s], fs[t]
    out = {'target': t, 'hit': rng.random() < m['acc'], 'damage': 0, 'crit': False,
           'effectiveness': type_mult(m['elem'], opp['type'])}
    if not out['hit']:
        return out, 0
    bonus = _bonus(m, opp['status'])
    if bonus > 1:
        out['combo'] = True
    stat = (me['mag'] if m['kind'] == 'magic' else me['atk']) * (WEAK if 'weak' in me['status'] else 1) \
        * (FED if 'fed' in me['status'] else 1)
    defense = max(1, opp['defense'] * (1 - m.get('pierce', 0)))
    hits = []
    for _ in range(m.get('hits', 1)):
        crit = rng.random() < 0.0625
        # Útok i obrana rostou s levelem stejně, takže bez násobku `growth` by zásah na levelu 20 bral stejně
        # jako na levelu 1, ale životy jsou 2,8× větší a boj by se táhl. Tempo boje je tak stejné na každém levelu.
        dmg = max(1, math.floor(m['power'] * stat / defense * out['effectiveness'] * bonus * rng.uniform(0.9, 1.1)
                                * DAMAGE_SCALE * opp.get('growth', 1) * (1.5 if crit else 1)))
        if opp.get('guard'):  # Obrana zachytí jen první zásah
            if m.get('break') and not opp.get('solid'):
                out['broke'] = True
            else:
                dmg = max(1, dmg // 2)
            opp['guard'] = opp['solid'] = False
        dmg = min(dmg, opp['hp'])
        opp['hp'] -= dmg
        hits.append(dmg)
        out['crit'] = out['crit'] or crit
        if opp['hp'] <= 0:
            break
    out['damage'] = sum(hits)
    if m.get('hits'):
        out['hits'] = hits
    if m.get('sap'):
        out['sap'] = min(opp['sp'], m['sap'])
        opp['sp'] -= out['sap']
    if m.get('status') and opp['hp'] > 0:
        out.update(_apply(opp, t, *m['status'], fresh, source=s))
    return out, math.floor(out['damage'] * m.get('drain', 0))


def resolve(fs, picks, seed, turn):
    """Jeden tah pro libovolný počet bojovníků. fs = {slot: fighter s 'team'}, picks = {slot: {'move', 'target'}}.
    Zmutuje fightery, vrátí seznam událostí. Nepoužitelný tah se změní na Obranu, Obrana spoutaného na Útok."""
    rng = random.Random(seed ^ turn)
    for f in fs.values():
        f.setdefault('status', {})
    acting = [s for s in sorted(fs) if fs[s]['hp'] > 0]
    moves, rooted, fresh = {}, set(), set()
    for s in acting:
        f = fs[s]
        m = (picks.get(s) or {}).get('move', 'attack')
        m = m if m in MOVES and can_use(f, m) else 'guard'
        if MOVES[m]['kind'] == 'guard' and 'root' in f['status']:
            m = 'attack'
            rooted.add(s)
        f['sp'] -= MOVES[m]['cost']
        moves[s] = m
    dazed = {s for s in acting if 'daze' in fs[s]['status'] and rng.random() < DAZE}
    events = []
    # Obrana má přednost (platí už proti zásahu v tomtéž tahu).
    for s in acting:
        me, move = fs[s], moves[s]
        m = MOVES[move]
        if m['kind'] != 'guard':
            continue
        if s in dazed:
            events.append(_event(s, move, fizzle=True))
            continue
        me['guard'], me['solid'] = True, bool(m.get('solid'))
        events.append(_event(s, move, heal=_heal(me, me['max_hp'] * m.get('heal', 0.1 if me['type'] == 'taste' else 0))))
    tiebreak = {s: rng.random() for s in acting}
    speed = lambda s: fs[s]['spd'] * (0.5 if 'slow' in fs[s]['status'] else 1)
    for s in sorted(acting, key=lambda s: (not MOVES[moves[s]].get('first'), -speed(s), tiebreak[s])):
        me, move = fs[s], moves[s]
        m = MOVES[move]
        if m['kind'] == 'guard' or me['hp'] <= 0:
            continue
        extra = {'rooted': True} if s in rooted else {}
        if s in dazed:
            events.append(_event(s, move, fizzle=True, **extra))
            continue
        if not m['power']:  # léčivé a podpůrné kouzlo
            ev = _event(s, move, hit=True, damage=0, effectiveness=1.0, heal=_heal(me, me['max_hp'] * m.get('heal', 0)))
            if m.get('cleanse'):
                ev['cleansed'] = _cleanse(me)
            if m.get('self_status'):
                _apply(me, s, *m['self_status'], fresh)
                ev['buff'] = m['self_status'][0]
            events.append(ev)
            continue
        wanted = (picks.get(s) or {}).get('target')
        targets = enemies(fs, s) if m.get('aoe') else [t for t in [_target(fs, s, wanted)] if t]
        if not targets:
            continue
        results = [_strike(rng, fs, s, t, m, fresh) for t in targets]
        ev = _event(s, move, **results[0][0], **extra)
        ev['heal'] = _heal(me, sum(d for _, d in results))
        if len(results) > 1:
            ev['more'] = [r for r, _ in results[1:]]
        if m.get('cleanse'):
            ev['cleansed'] = _cleanse(me)
        events.append(ev)
    # Konec tahu: hoření, stavy ubývají, Obrana končí, výdrž se obnoví (zalepenému ne)
    for s in sorted(fs):
        f = fs[s]
        f['guard'] = f['solid'] = False
        if f['hp'] <= 0:
            continue
        st = f['status']
        if 'burn' in st and (s, 'burn') not in fresh:
            dmg = min(f['hp'], max(1, math.floor(f['max_hp'] * BURN)))
            f['hp'] -= dmg
            src = f.get('burn_by') if f.get('burn_by') in fs else s  # zranění se počítá tomu, kdo zapálil
            events.append({'actor': src, 'target': s, 'move': 'burn', 'name': 'Hoření', 'kind': 'status', 'fx': 'burn',
                           'cost': 0, 'elem': None, 'hit': True, 'damage': dmg, 'effectiveness': 1.0})
        if s in moves and 'sticky' not in st:
            f['sp'] = min(f['max_sp'], f['sp'] + SP_REGEN + (GUARD_REGEN if moves[s] == 'guard' else 0))
        for name in list(st):
            if (s, name) not in fresh:
                st[name] -= 1
                if st[name] <= 0:
                    del st[name]
    return events


def mirror_damage(stats, move, growth=1.0):
    """Průměrné zranění tahu proti stejně silnému tvorovi, bez typové výhody (jen pro popis na kartě tvora)."""
    m = MOVES[move]
    stat = stats['mag'] if m['kind'] == 'magic' else stats['atk']
    return math.floor(m['power'] * m.get('hits', 1) * stat / stats['defense'] * DAMAGE_SCALE * growth) if m['power'] else 0


def casts_in_row(max_sp, move):
    """Kolikrát jde tah použít za sebou z plné výdrže (s obnovou po každém tahu). None = nic nestojí."""
    cost = MOVES[move]['cost']
    if cost <= SP_REGEN:
        return None
    sp, n = max_sp, 0
    while sp >= cost:
        sp, n = min(max_sp, sp - cost + SP_REGEN), n + 1
    return n


def outcome(fs, turn):
    """Vítězný tým, 'draw', nebo None pokud boj pokračuje. `turn` = počet odehraných tahů."""
    alive = {f['team'] for f in fs.values() if f['hp'] > 0}
    if len(alive) <= 1:
        return alive.pop() if alive else 'draw'
    if turn >= MAX_TURNS:
        share = {}
        for f in fs.values():
            hp, mx = share.get(f['team'], (0, 0))
            share[f['team']] = (hp + f['hp'], mx + f['max_hp'])
        best = sorted(((hp / mx, team) for team, (hp, mx) in share.items()), reverse=True)
        return 'draw' if best[0][0] == best[1][0] else best[0][1]
    return None


def resolve_turn(a, b, move_a, move_b, seed, turn):
    """1v1 (sloty a, b). Zmutuje fightery a vrátí události."""
    a.setdefault('team', 'a')
    b.setdefault('team', 'b')
    return resolve({'a': a, 'b': b}, {'a': {'move': move_a}, 'b': {'move': move_b}}, seed, turn)


def winner(a, b, turn):
    """'a' / 'b' / 'draw', nebo None pokud boj pokračuje."""
    return outcome({'a': {**a, 'team': 'a'}, 'b': {**b, 'team': 'b'}}, turn)


def bot_move(me, seed, turn, foe=None):
    """Strážce místa a boss: tah s nejlepším skóre (účinnost na cíl, kombo, stavy, výdrž) plus trocha náhody."""
    rng = random.Random(seed * 31 + turn)
    st, fst = me.get('status', {}), (foe or {}).get('status', {})
    hp = me['hp'] / me['max_hp']

    def score(name):
        m = MOVES[name]
        if m['kind'] == 'guard':
            return 10 + 30 * (hp < 0.35) + 20 * (me['sp'] < 25) + 100 * m.get('heal', 0) * (hp < 0.6)
        if not m['power']:
            s = 300 * m.get('heal', 0) * max(0, 0.7 - hp) * (0.5 if 'curse' in st else 1)
            if m.get('cleanse'):
                s += 15 * _ailments(me)
            if m.get('self_status') and m['self_status'][0] not in st:
                s += 20
            return s - 0.4 * m['cost']
        mult = type_mult(m['elem'], foe['type']) if foe else 1.0
        stat = me['mag'] if m['kind'] == 'magic' else me['atk']
        s = m['power'] * m.get('hits', 1) * m['acc'] * mult * _bonus(m, fst) * stat / me['atk'] * (1 + m.get('pierce', 0) / 2)
        if m.get('status') and m['status'][0] not in fst:
            s += 15
        if m.get('sap') and foe and foe.get('sp', 0) >= 40:
            s += 8
        return s - 0.4 * m['cost']

    usable = [m for m in me.get('moves', BASIC) if can_use(me, m)]
    return max(usable, key=lambda m: score(m) + rng.uniform(0, 15))


def bot_pick(fs, slot, seed, turn):
    """Tah bota ve slotu: cílí na nejslabšího soupeře a volí tah podle něj."""
    t = _target(fs, slot, None)
    return {'move': bot_move(fs[slot], seed, turn, fs.get(t)), 'target': t}


def replay(a, b, moves, seed):
    """Přehraje boj z počátečních fighterů a seznamu dvojic tahů; vrací (a, b, log, vítěz)."""
    a, b, log = copy.deepcopy(a), copy.deepcopy(b), []
    for turn, (ma, mb) in enumerate(moves, start=1):
        log.append(resolve_turn(a, b, ma, mb, seed, turn))
        w = winner(a, b, turn)
        if w:
            return a, b, log, w
    return a, b, log, None
