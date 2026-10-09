import random

from apps.battles import engine

STATS = {'hp': 100, 'atk': 20, 'defense': 12, 'spd': 10}


def _pair(ta='fortress', tb='view'):
    return engine.fighter(STATS, ta), engine.fighter({**STATS, 'spd': 9}, tb)


def test_type_chart_cycle():
    assert engine.type_mult('fortress', 'view') == 1.5
    assert engine.type_mult('view', 'fortress') == 0.75
    assert engine.type_mult('culture', 'fortress') == 1.5
    assert engine.type_mult('taste', 'fortress') == 1.0


def test_deterministic_replay_and_termination():
    for seed in range(50):
        rng = random.Random(seed)
        a, b = _pair()
        a['moves'] = b['moves'] = list(engine.MOVES)  # i drahá kouzla, ať se testuje nedostatek výdrže
        moves = [(rng.choice(list(engine.MOVES)), rng.choice(list(engine.MOVES))) for _ in range(engine.MAX_TURNS)]
        r1 = engine.replay(a, b, moves, seed)
        r2 = engine.replay(a, b, moves, seed)
        assert r1 == r2                                   # stejný seed + tahy = stejný boj
        fa, fb, log, w = r1
        assert w in ('a', 'b', 'draw')                    # vždy skončí do 30 tahů
        assert len(log) <= engine.MAX_TURNS
        assert fa['hp'] >= 0 and fb['hp'] >= 0            # žádné záporné HP
        assert 0 <= fa['sp'] <= fa['max_sp'] and 0 <= fb['sp'] <= fb['max_sp']  # výdrž nikdy pod nulu


def test_guard_halves_damage_and_taste_heals():
    a, b = _pair('taste', 'fortress')
    a['hp'] = 50
    ev = engine.resolve_turn(a, b, 'guard', 'attack', seed=1, turn=1)
    assert ev[0]['actor'] == 'a' and ev[0]['move'] == 'guard' and ev[0]['heal'] == 10
    hit = next(e for e in ev if e['actor'] == 'b')
    assert 60 - a['hp'] == hit['damage'] and hit['damage'] < 40 * 20 / 12 * engine.DAMAGE_SCALE


def test_bot_finishes_battle():
    a, b = _pair()
    moves = [('attack', engine.bot_move(b, 7, t)) for t in range(1, 31)]
    *_, w = engine.replay(a, b, moves, 7)
    assert w is not None


def test_stamina_and_magic():
    a, b = _pair('spring', 'culture')
    assert a['moves'] == ['attack', 'heavy', 'guard', 'jet']
    a['sp'] = 10
    ev = engine.resolve_turn(a, b, 'jet', 'attack', seed=3, turn=1)
    assert next(e for e in ev if e['actor'] == 'a')['move'] == 'guard'   # na kouzlo nemá výdrž → obrana
    a['sp'] = 100
    hp = b['hp']
    ev = engine.resolve_turn(a, b, 'jet', 'guard', seed=3, turn=2)
    jet = next(e for e in ev if e['move'] == 'jet')
    assert jet['fx'] == 'projectile' and jet['effectiveness'] == 1.5 and b['hp'] < hp
    assert a['sp'] == 100 - 20 + int(100 * engine.SP_REGEN)


def test_evolution_unlocks_spells():
    assert engine.moves_for('view', 3)[-3:] == ['gust', 'thunder', 'sunbeam']
    f = engine.fighter(STATS, 'spring', stage=2)
    f['hp'] = 10
    assert engine.bot_move(f, 1, 1) in f['moves']
