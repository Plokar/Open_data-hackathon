"""Tahový battle engine (PROJECT_SPEC 7.3). Čistý Python bez Django, boj jde z logu přesně přehrát.

Každý tah stojí výdrž (sp), ta se po tahu částečně obnoví. Fyzické útoky jdou přes `atk`,
kouzla přes `mag`; kouzla jsou podle typu tvora a s evolucí se odemykají silnější.
`fx` je jen nápověda pro frontend, jakou animaci zahrát.
"""
import math
import random

# kind: phys / magic / guard. power 0 = podpůrné kouzlo. heal = % max HP, drain = % způsobeného zranění.
MOVES = {
    'attack': {'name': 'Útok', 'kind': 'phys', 'power': 40, 'acc': 1.0, 'cost': 0, 'fx': 'slash'},
    'heavy': {'name': 'Silný úder', 'kind': 'phys', 'power': 70, 'acc': 0.75, 'cost': 25, 'fx': 'smash'},
    'guard': {'name': 'Obrana', 'kind': 'guard', 'power': 0, 'acc': 1.0, 'cost': 0, 'fx': 'shield'},

    'rockfall': {'name': 'Kamenná lavina', 'kind': 'magic', 'power': 55, 'acc': 0.95, 'cost': 25, 'fx': 'rain'},
    'bastion': {'name': 'Hradní štít', 'kind': 'guard', 'power': 0, 'acc': 1.0, 'cost': 30, 'heal': 0.15, 'fx': 'aura'},
    'siege_fire': {'name': 'Ohnivá střela z hradeb', 'kind': 'magic', 'power': 95, 'acc': 0.85, 'cost': 50, 'fx': 'projectile'},

    'gust': {'name': 'Vichřice', 'kind': 'magic', 'power': 50, 'acc': 1.0, 'cost': 20, 'fx': 'wave'},
    'thunder': {'name': 'Blesk z výšin', 'kind': 'magic', 'power': 80, 'acc': 0.85, 'cost': 40, 'fx': 'bolt'},
    'sunbeam': {'name': 'Sluneční paprsek', 'kind': 'magic', 'power': 100, 'acc': 0.9, 'cost': 55, 'fx': 'beam'},

    'vines': {'name': 'Šlahouny', 'kind': 'magic', 'power': 50, 'acc': 0.95, 'cost': 25, 'drain': 0.5, 'fx': 'vines'},
    'spores': {'name': 'Pylová bouře', 'kind': 'magic', 'power': 65, 'acc': 0.95, 'cost': 30, 'fx': 'burst'},
    'forest_wrath': {'name': 'Hněv pralesa', 'kind': 'magic', 'power': 95, 'acc': 0.85, 'cost': 50, 'fx': 'rain'},

    'jet': {'name': 'Vodní tryska', 'kind': 'magic', 'power': 50, 'acc': 1.0, 'cost': 20, 'fx': 'projectile'},
    'healing_spring': {'name': 'Léčivý pramen', 'kind': 'magic', 'power': 0, 'acc': 1.0, 'cost': 35, 'heal': 0.3, 'fx': 'aura'},
    'geyser': {'name': 'Gejzír', 'kind': 'magic', 'power': 95, 'acc': 0.85, 'cost': 50, 'fx': 'geyser'},

    'echo': {'name': 'Ozvěna varhan', 'kind': 'magic', 'power': 50, 'acc': 1.0, 'cost': 20, 'fx': 'wave'},
    'fresco_curse': {'name': 'Kletba fresek', 'kind': 'magic', 'power': 65, 'acc': 0.9, 'cost': 35, 'drain': 0.5, 'fx': 'beam'},
    'choir': {'name': 'Nebeský chorál', 'kind': 'magic', 'power': 95, 'acc': 0.85, 'cost': 50, 'fx': 'burst'},

    'honey': {'name': 'Medová střela', 'kind': 'magic', 'power': 50, 'acc': 1.0, 'cost': 20, 'drain': 0.3, 'fx': 'projectile'},
    'feast': {'name': 'Hostina', 'kind': 'magic', 'power': 0, 'acc': 1.0, 'cost': 35, 'heal': 0.3, 'fx': 'aura'},
    'cake_storm': {'name': 'Koláčová smršť', 'kind': 'magic', 'power': 90, 'acc': 0.85, 'cost': 50, 'fx': 'rain'},
}
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
SP_REGEN = 0.12   # obnova výdrže za tah (z max)
GUARD_REGEN = 0.2  # obrana navíc
BEATS = {'fortress': 'view', 'view': 'nature', 'nature': 'spring', 'spring': 'culture', 'culture': 'fortress'}


def type_mult(attacker, defender):
    if BEATS.get(attacker) == defender:
        return 1.5
    if BEATS.get(defender) == attacker:
        return 0.75
    return 1.0


def moves_for(pet_type, stage=1):
    return BASIC + MAGIC[pet_type][:stage]


def fighter(stats, pet_type, name='', stage=1):
    sp = stats.get('stamina', 100)
    return {'hp': stats['hp'], 'max_hp': stats['hp'], 'atk': stats['atk'], 'defense': stats['defense'],
            'spd': stats['spd'], 'mag': stats.get('mag', stats['atk']), 'sp': sp, 'max_sp': sp,
            'type': pet_type, 'name': name, 'stage': stage, 'guard': False, 'moves': moves_for(pet_type, stage)}


def can_use(f, move):
    return move in f.get('moves', BASIC) and f['sp'] >= MOVES[move]['cost']


def _event(side, move, **kw):
    m = MOVES[move]
    return {'actor': side, 'move': move, 'name': m['name'], 'kind': m['kind'], 'fx': m['fx'], 'cost': m['cost'], **kw}


def resolve_turn(a, b, move_a, move_b, seed, turn):
    """Zmutuje fightery a a b, vrátí seznam událostí tahu. Nepoužitelný tah se změní na Obranu."""
    rng = random.Random(seed ^ turn)
    sides = {'a': [a, b, move_a], 'b': [b, a, move_b]}
    for s in sides.values():
        if not can_use(s[0], s[2]):
            s[2] = 'guard'
        s[0]['sp'] -= MOVES[s[2]]['cost']
    events = []
    # Obrana má přednost (platí už proti zásahu v tomtéž tahu).
    for side, (me, _, move) in sides.items():
        if MOVES[move]['kind'] == 'guard':
            me['guard'] = True
            pct = MOVES[move].get('heal', 0.1 if me['type'] == 'taste' else 0)
            heal = min(me['max_hp'] - me['hp'], math.floor(me['max_hp'] * pct))
            me['hp'] += heal
            events.append(_event(side, move, heal=heal))
    tie = rng.random() < 0.5
    order = sorted('ab', key=lambda s: (-sides[s][0]['spd'], (s == 'a') == tie))
    for side in order:
        me, opp, move = sides[side]
        m = MOVES[move]
        if m['kind'] == 'guard' or me['hp'] <= 0 or opp['hp'] <= 0:
            continue
        if not m['power']:  # léčivé kouzlo
            heal = min(me['max_hp'] - me['hp'], math.floor(me['max_hp'] * m.get('heal', 0)))
            me['hp'] += heal
            events.append(_event(side, move, hit=True, damage=0, heal=heal, effectiveness=1.0))
            continue
        hit = rng.random() < m['acc']
        mult = type_mult(me['type'], opp['type'])
        power_stat = me['mag'] if m['kind'] == 'magic' else me['atk']
        dmg = heal = 0
        crit = False
        if hit:
            crit = rng.random() < 0.0625
            dmg = max(1, math.floor(m['power'] * power_stat / opp['defense'] * mult * rng.uniform(0.9, 1.1)
                                    * DAMAGE_SCALE * (1.5 if crit else 1)))
            if opp['guard']:
                dmg = max(1, dmg // 2)
                opp['guard'] = False
            dmg = min(dmg, opp['hp'])
            opp['hp'] -= dmg
            heal = min(me['max_hp'] - me['hp'], math.floor(dmg * m.get('drain', 0)))
            me['hp'] += heal
        events.append(_event(side, move, hit=hit, damage=dmg, effectiveness=mult, crit=crit, heal=heal))
    for side, (me, _, move) in sides.items():
        regen = SP_REGEN + (GUARD_REGEN if move == 'guard' else 0)
        me['sp'] = min(me['max_sp'], me['sp'] + math.floor(me['max_sp'] * regen))
    return events


def winner(a, b, turn):
    """'a' / 'b' / 'draw', nebo None pokud boj pokračuje. `turn` = počet odehraných tahů."""
    if a['hp'] <= 0 or b['hp'] <= 0:
        return 'b' if a['hp'] <= 0 else 'a'
    if turn >= MAX_TURNS:
        pa, pb = a['hp'] / a['max_hp'], b['hp'] / b['max_hp']
        return 'draw' if pa == pb else ('a' if pa > pb else 'b')
    return None


def bot_move(me, seed, turn):
    """Strážce místa: jednoduchá deterministická taktika, šetří výdrž na nejsilnější kouzlo."""
    r = random.Random(seed * 31 + turn).random()
    usable = [m for m in me.get('moves', BASIC) if can_use(me, m)]
    heals = [m for m in usable if MOVES[m].get('heal') and MOVES[m]['kind'] == 'magic']
    if me['hp'] < me['max_hp'] * 0.35 and heals and r < 0.6:
        return heals[0]
    if me['hp'] < me['max_hp'] * 0.3 and r < 0.35:
        return 'guard'
    spells = sorted((m for m in usable if MOVES[m]['kind'] == 'magic' and MOVES[m]['power']), key=lambda m: -MOVES[m]['power'])
    if spells and r < 0.55:
        return spells[0]
    if me['sp'] < me['max_sp'] * 0.25 and r < 0.75:
        return 'guard'
    return 'heavy' if 'heavy' in usable and r < 0.75 else 'attack'


def replay(a, b, moves, seed):
    """Přehraje boj z počátečních fighterů a seznamu dvojic tahů; vrací (a, b, log, vítěz)."""
    a, b, log = dict(a), dict(b), []
    for turn, (ma, mb) in enumerate(moves, start=1):
        log.append(resolve_turn(a, b, ma, mb, seed, turn))
        w = winner(a, b, turn)
        if w:
            return a, b, log, w
    return a, b, log, None
