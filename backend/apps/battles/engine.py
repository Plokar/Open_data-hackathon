"""Tahový battle engine (PROJECT_SPEC 7.3). Čistý Python bez Django, boj jde z logu přesně přehrát."""
import math
import random

MOVES = {'attack': (40, 1.0), 'heavy': (70, 0.7), 'guard': None}
MAX_TURNS = 30
# ponytail: ladicí konstanta, aby boj trval ~5–8 tahů (vzorec ze specu dává 66 dmg na 100 HP)
DAMAGE_SCALE = 0.25
BEATS = {'fortress': 'view', 'view': 'nature', 'nature': 'spring', 'spring': 'culture', 'culture': 'fortress'}


def type_mult(attacker, defender):
    if BEATS.get(attacker) == defender:
        return 1.5
    if BEATS.get(defender) == attacker:
        return 0.75
    return 1.0


def fighter(stats, pet_type, name=''):
    return {'hp': stats['hp'], 'max_hp': stats['hp'], 'atk': stats['atk'], 'defense': stats['defense'],
            'spd': stats['spd'], 'type': pet_type, 'name': name, 'guard': False}


def resolve_turn(a, b, move_a, move_b, seed, turn):
    """Zmutuje fightery a a b, vrátí seznam událostí tahu."""
    rng = random.Random(seed ^ turn)
    sides = {'a': (a, b, move_a), 'b': (b, a, move_b)}
    events = []
    # Obrana má přednost (platí už proti zásahu v tomtéž tahu).
    for side, (me, _, move) in sides.items():
        if move == 'guard':
            me['guard'] = True
            heal = math.floor(me['max_hp'] * 0.1) if me['type'] == 'taste' else 0
            me['hp'] = min(me['max_hp'], me['hp'] + heal)
            events.append({'actor': side, 'move': 'guard', 'heal': heal})
    tie = rng.random() < 0.5
    order = sorted('ab', key=lambda s: (-sides[s][0]['spd'], (s == 'a') == tie))
    for side in order:
        me, opp, move = sides[side]
        if move == 'guard' or me['hp'] <= 0 or opp['hp'] <= 0:
            continue
        power, acc = MOVES[move]
        hit = rng.random() < acc
        mult = type_mult(me['type'], opp['type'])
        dmg = 0
        if hit:
            dmg = max(1, math.floor(power * me['atk'] / opp['defense'] * mult * rng.uniform(0.9, 1.1) * DAMAGE_SCALE))
            if opp['guard']:
                dmg = max(1, dmg // 2)
                opp['guard'] = False
            opp['hp'] = max(0, opp['hp'] - dmg)
        events.append({'actor': side, 'move': move, 'hit': hit, 'damage': dmg, 'effectiveness': mult})
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
    """Strážce místa: jednoduchá deterministická taktika."""
    r = random.Random(seed * 31 + turn).random()
    if me['hp'] < me['max_hp'] * 0.3 and r < 0.35:
        return 'guard'
    return 'heavy' if r < 0.35 else 'attack'


def replay(a, b, moves, seed):
    """Přehraje boj z počátečních fighterů a seznamu dvojic tahů; vrací (a, b, log, vítěz)."""
    a, b, log = dict(a), dict(b), []
    for turn, (ma, mb) in enumerate(moves, start=1):
        log.append(resolve_turn(a, b, ma, mb, seed, turn))
        w = winner(a, b, turn)
        if w:
            return a, b, log, w
    return a, b, log, None
