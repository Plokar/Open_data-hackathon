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
    assert jet['fx'] == 'jet' and jet['effectiveness'] == 1.5 and b['hp'] < hp
    assert a['sp'] == 100 - 20 + engine.SP_REGEN


def test_strongest_spell_cannot_be_spammed():
    """Vylepšený tvor (level 20, Prastarý) dřív nabíral výdrž rychleji, než stálo nejsilnější kouzlo."""
    from apps.game import pets
    stats = pets.scaled(pets.generate(1, 'castle', 'legendary', 'x', 1), level=20, stage=3)
    a = engine.fighter(stats, 'fortress', stage=3)
    b = engine.fighter({**stats, 'hp': 10**6}, 'nature')
    casts = 0
    for turn in range(1, 11):
        ev = engine.resolve_turn(a, b, 'siege_fire', 'guard', seed=1, turn=turn)
        casts += any(e['move'] == 'siege_fire' for e in ev)
    assert casts <= 5                                                       # nanejvýš každý druhý tah
    assert engine.casts_in_row(100, 'siege_fire') == 2 and engine.casts_in_row(100, 'attack') is None


def test_fight_pace_same_on_every_level():
    """Útok i obrana rostou s levelem stejně: zranění musí růst se životy, jinak se boje na vysokém levelu táhnou."""
    from apps.game import pets
    hits = {}
    for level, stage in ((1, 1), (20, 3)):
        g = pets.growth(level, stage)
        stats = pets.scaled({**pets.BASE_STATS}, level, stage)
        a, b = engine.fighter(stats, 'nature', growth=g), engine.fighter(stats, 'nature', growth=g)
        ev = engine.resolve_turn(a, b, 'attack', 'guard', seed=5, turn=1)
        hits[level] = next(e['damage'] for e in ev if e['move'] == 'attack') / b['max_hp']
    assert abs(hits[1] - hits[20]) < 0.02                                   # stejný podíl životů na zásah


def test_evolution_unlocks_spells():
    assert engine.moves_for('view', 3)[-3:] == ['gust', 'thunder', 'sunbeam']
    f = engine.fighter(STATS, 'spring', stage=2)
    f['hp'] = 10
    assert engine.bot_move(f, 1, 1) in f['moves']


# ── Strategie: živly, stavy, Obrana ─────────────────────────────────────────

def _duel(ta='fortress', tb='nature', spd_b=9):
    a, b = engine.fighter(STATS, ta), engine.fighter({**STATS, 'spd': spd_b}, tb)
    for f in (a, b):
        f.update(moves=list(engine.MOVES), sp=999, max_sp=999)
    return a, b


def _cast(move, b_move='attack', setup=None, **kw):
    """Seslání na čerstvé bojovníky; vrací první seed, kde kouzlo trefí."""
    for seed in range(1, 300):
        a, b = _duel(**kw)
        if setup:
            setup(a, b)
        ev = engine.resolve_turn(a, b, move, b_move, seed, 1)
        e = next(x for x in ev if x['actor'] == 'a' and x['move'] == move)
        if e.get('hit', True) and not e.get('fizzle'):
            return a, b, ev, e
    raise AssertionError(move)


def test_spell_element_decides_effectiveness():
    """Účinnost se řídí živlem kouzla, ne typem tvora: Pevnost s Vodní tryskou trefí Kulturu naplno."""
    assert _cast('jet', tb='culture')[3]['effectiveness'] == 1.5
    assert _cast('rockfall', tb='culture')[3]['effectiveness'] == 0.75
    assert _cast('attack', tb='culture')[3]['effectiveness'] == 1.0          # fyzický útok je bez živlu


def test_burn_ticks_from_next_turn_and_water_puts_it_out():
    a, b, ev, e = _cast('siege_fire')
    assert e['status'] == 'burn' and not any(x['move'] == 'burn' for x in ev)  # v tahu zásahu ještě nepálí
    ev = engine.resolve_turn(a, b, 'guard', 'guard', 2, 2)
    tick = next(x for x in ev if x['move'] == 'burn')
    assert tick['actor'] == 'a' and tick['target'] == 'b' and tick['damage'] == 6  # 6 % ze 100 HP, připíše se zapalovači
    ev = engine.resolve_turn(a, b, 'jet', 'guard', 3, 3)
    assert next(x for x in ev if x['move'] == 'jet')['extinguished'] and 'burn' not in b['status']
    ev = engine.resolve_turn(a, b, 'siege_fire', 'guard', 9, 4)
    fire = next(x for x in ev if x['move'] == 'siege_fire')
    assert not fire['hit'] or (fire['resisted'] == 'burn' and 'burn' not in b['status'])  # mokrého nic nezapálí


def test_heavy_breaks_guard_but_not_castle_shield():
    *_, broke = _cast('heavy', b_move='guard')
    *_, held = _cast('heavy', b_move='bastion')
    assert broke['broke'] and not held.get('broke') and broke['damage'] > held['damage']


def test_rooted_cannot_guard():
    a, b, _, e = _cast('vines')
    assert e['status'] == 'root'
    ev = engine.resolve_turn(a, b, 'guard', 'guard', 2, 2)
    turned = next(x for x in ev if x['actor'] == 'b')
    assert turned['move'] == 'attack' and turned['rooted'] and not b['guard']


def test_multi_hit_beats_guard():
    *_, e = _cast('cake_storm', b_move='guard')
    assert len(e['hits']) == 3 and e['hits'][0] < min(e['hits'][1:])      # Obrana zachytí jen první koláč


def test_gust_goes_first_and_steals_stamina():
    a, b, ev, e = _cast('gust', spd_b=999)
    assert ev.index(e) < ev.index(next(x for x in ev if x['actor'] == 'b')) and e['sap'] == 15


def test_combos_and_status_effects():
    wet = lambda a, b: b['status'].update(wet=2)
    plain, combo = _cast('thunder')[3], _cast('thunder', setup=wet)[3]
    assert combo['combo'] and combo['damage'] > plain['damage'] * 1.3       # blesk do promočeného

    a, b, _, e = _cast('honey')
    sp = b['sp']
    engine.resolve_turn(a, b, 'guard', 'attack', 2, 2)
    assert e['status'] == 'sticky' and b['sp'] == sp                        # zalepenému se výdrž neobnovuje

    a, b, *_ = _cast('fresco_curse')
    b['hp'] = 40
    ev = engine.resolve_turn(a, b, 'guard', 'healing_spring', 2, 2)
    spring = next(x for x in ev if x['move'] == 'healing_spring')
    assert spring['heal'] == 15 and 'curse' in spring['cleansed']            # prokletý: 30 % → 15, pak se očistí

    a, b, *_ = _cast('feast')
    assert 'fed' in a['status']
    fed = [x for x in engine.resolve_turn(a, b, 'attack', 'guard', 2, 2) if x['actor'] == 'a'][0]['damage']
    plain = [x for x in engine.resolve_turn(*_duel(), 'attack', 'guard', 2, 2) if x['actor'] == 'a'][0]['damage']
    assert fed > plain


def test_daze_sometimes_wastes_the_turn():
    fizzles = 0
    for seed in range(40):
        a, b, *_ = _cast('echo')
        ev = engine.resolve_turn(a, b, 'guard', 'attack', seed, 2)
        fizzles += next(x for x in ev if x['actor'] == 'b').get('fizzle', False)
    assert 5 < fizzles < 25                                                  # ~35 %


def test_quake_hits_every_enemy():
    fs = {s: {**engine.fighter(STATS, t), 'team': s, 'moves': list(engine.MOVES), 'sp': 999}
          for s, t in (('a', 'fortress'), ('b', 'view'), ('c', 'nature'))}
    ev = engine.resolve(fs, {'a': {'move': 'quake'}, 'b': {'move': 'guard'}, 'c': {'move': 'guard'}}, 4, 1)
    quake = next(x for x in ev if x['move'] == 'quake')
    assert {quake['target']} | {x['target'] for x in quake['more']} == {'b', 'c'}
