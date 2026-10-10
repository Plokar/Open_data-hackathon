"""Deterministické generování PETů (PROJECT_SPEC 7.2), levely a evoluce. Čistý Python."""
import hashlib
import random
from datetime import timedelta

CATEGORY_TYPE = {
    'castle': 'fortress', 'lookout': 'view', 'nature': 'nature', 'spring': 'spring',
    'culture': 'culture', 'heritage': 'culture', 'info': 'culture', 'food': 'taste',
}
SPECIES = {
    'fortress': ['Hradník', 'Cimbuřík', 'Baštoun', 'Padacák'],
    'view': ['Vyhlídal', 'Oblačík', 'Větrník', 'Rozhledoun'],
    'nature': ['Mechouš', 'Kapradík', 'Smrčák', 'Lesňáček'],
    'spring': ['Vřídlík', 'Bublinka', 'Prameník', 'Kyselkáč'],
    'culture': ['Múzík', 'Kamenáč', 'Freskáč', 'Varhaník'],
    'taste': ['Oplatek', 'Koláčník', 'Bylinkář', 'Medoušek'],
}
TYPE_LABEL = {'fortress': 'Pevnost', 'view': 'Výhled', 'nature': 'Příroda', 'spring': 'Pramen', 'culture': 'Kultura', 'taste': 'Chuť'}
RARITY_MULT = {'common': 1.0, 'rare': 1.15, 'epic': 1.3, 'legendary': 1.6}
# Pořadí klíčů je součást determinismu (rng.uniform se losuje v tomto pořadí), nové staty jen na konec.
BASE_STATS = {'hp': 100, 'atk': 20, 'defense': 12, 'spd': 10, 'mag': 20, 'stamina': 100}
# Charakter typu: Pevnost vydrží, Výhled je rychlý, Pramen a Kultura kouzlí…
TYPE_BIAS = {
    'fortress': {'defense': 1.2, 'spd': 0.85},
    'view': {'spd': 1.25, 'defense': 0.9},
    'nature': {'hp': 1.12, 'stamina': 1.1},
    'spring': {'mag': 1.2, 'atk': 0.9},
    'culture': {'mag': 1.25, 'hp': 0.92},
    'taste': {'stamina': 1.2, 'atk': 0.95},
}

MAX_LEVEL = 30
LEVEL_GROWTH = 0.05          # +5 % ke všem statům za level
STAGES = {1: ('Mládě', 1.0), 2: ('Dospělec', 1.2), 3: ('Prastarý', 1.45)}
EVOLVE_LEVEL = {2: 3, 3: 6}  # do stupně 2 od levelu 3, do stupně 3 od levelu 6
INJURY = timedelta(minutes=30)


def next_rarity(rarity):
    """O stupeň vzácnější tvor (odměna za dokončenou výpravu), legendary už výš nejde."""
    order = list(RARITY_MULT)
    return order[min(order.index(rarity) + 1, len(order) - 1)]


def pet_seed(place_id, photo_sha256, user_id):
    return int(hashlib.sha256(f'{place_id}{photo_sha256}{user_id}'.encode()).hexdigest()[:15], 16)


def generate(place_id, category, rarity, photo_sha256, user_id):
    seed = pet_seed(place_id, photo_sha256, user_id)
    rng = random.Random(seed)
    pet_type = CATEGORY_TYPE[category]
    species = rng.choice(SPECIES[pet_type])
    bias = TYPE_BIAS[pet_type]
    stats = {k: round(v * RARITY_MULT[rarity] * rng.uniform(0.9, 1.1) * bias.get(k, 1)) for k, v in BASE_STATS.items()}
    return {'seed': seed, 'type': pet_type, 'species': species, 'name': species, 'rarity': rarity, **stats}


def xp_for_level(level):
    """Celkové XP potřebné na daný level: 0, 40, 120, 240, 400, 600…"""
    return 20 * level * (level - 1)


def level_for_xp(xp):
    level = 1
    while level < MAX_LEVEL and xp >= xp_for_level(level + 1):
        level += 1
    return level


def growth(level, stage):
    """Násobek statů za level a evoluci. Engine jím násobí zranění, které tvor dostane (viz engine.resolve)."""
    return (1 + LEVEL_GROWTH * (level - 1)) * STAGES[stage][1]


def scaled(stats, level, stage, same_type_stamps=0):
    """Staty do boje: level, stupeň evoluce a +2 % za každá 3 razítka stejného typu.
    Výdrž neroste: ceny kouzel jsou pevné, takže s rostoucí výdrží šlo nejsilnější kouzlo opakovat pořád dokola."""
    mult = growth(level, stage) * (1 + 0.02 * (same_type_stamps // 3))
    return {k: stats[k] if k == 'stamina' else round(stats[k] * mult) for k in BASE_STATS}


def effective_stats(pet, same_type_stamps=0):
    return scaled({k: getattr(pet, k) for k in BASE_STATS}, pet.level, pet.stage, same_type_stamps)


def can_evolve(pet):
    return pet.stage < 3 and pet.level >= EVOLVE_LEVEL[pet.stage + 1]


# Vyšlechtěná kouzla (klíče apps.battles.engine.BRED)
BRED_MOVES = ['aurora', 'quake', 'meteor', 'living_water', 'leech_bloom', 'twin_bolt']
# Když se šlechtění nepovede, s touto šancí oba rodiče zmizí (jinak jsou jen vyčerpaní).
# Bez ztráty by šlo neúspěch zkoušet donekonečna.
MERGE_LOSS = 0.45
# Šlechtit jde jen tvory podobné síly (rozdíl levelů nejvýš 1), jinak by šlo slabým tvorem „vylepšit“ silného.
MERGE_MAX_LEVEL_GAP = 1
RANK = list(RARITY_MULT)


def merge_odds(a, b):
    """Šance při spojení dvou tvorů (dicty s type, rarity). Stejný typ se spojí skoro vždy, kříženec jen občas."""
    same = a['type'] == b['type']
    top = max(RANK.index(a['rarity']), RANK.index(b['rarity']))
    return {'success': 0.95 if same else 0.6, 'hybrid': not same,
            'ability': 0.15 + 0.05 * top,                              # common 15 %, legendary 30 %
            'rarity_up': 0.3 if a['rarity'] == b['rarity'] else 0.15,
            'mutation': 0.12, 'loss': MERGE_LOSS}


def portmanteau(x, y):
    """Nový druh ze dvou jmen: Vřídlík + Hradník → Vřídník."""
    return x if x == y else x[:max(2, (len(x) + 1) // 2)] + y[(len(y) + 1) // 2:]


def merge(a, b, rng):
    """Spojí dva tvory (dicty se staty a vlastnostmi Pet) do nového, nebo vrátí None, když se to nepovede.
    Staty jsou náhodně mezi rodiči s šancí na zlepšení; kříženec dvou typů dostane i kouzlo druhého typu."""
    odds = merge_odds(a, b)
    if rng.random() >= odds['success']:
        return None
    main, other = (a, b) if (a['level'], a['xp']) >= (b['level'], b['xp']) else (b, a)
    stats = {k: rng.uniform(min(a[k], b[k]), max(a[k], b[k])) * rng.uniform(0.97, 1.12) for k in BASE_STATS}
    rarity = max(a['rarity'], b['rarity'], key=RANK.index)
    rarity_up = rarity != 'legendary' and rng.random() < odds['rarity_up']
    if rarity_up:
        rarity = next_rarity(rarity)
        stats = {k: v * 1.1 for k, v in stats.items()}
    mutation = rng.choice(list(BASE_STATS)) if rng.random() < odds['mutation'] else None
    if mutation:
        stats[mutation] *= 1.2
    type2 = other['type'] if odds['hybrid'] else (main.get('type2') or other.get('type2') or '')
    inherited = main.get('bonus_move') or other.get('bonus_move') or ''
    bonus = rng.choice(BRED_MOVES) if rng.random() < odds['ability'] else inherited
    species = main['species'] if a['species'] == b['species'] else portmanteau(main['species'], other['species'])
    seed = int(hashlib.sha256(f"{a['seed']}x{b['seed']}".encode()).hexdigest()[:15], 16)
    return {
        'type': main['type'], 'type2': '' if type2 == main['type'] else type2, 'species': species, 'name': species,
        'rarity': rarity, 'seed': seed, 'bonus_move': bonus, **{k: round(v) for k, v in stats.items()},
        'level': max(a['level'], b['level']), 'xp': max(a['xp'], b['xp']), 'stage': max(a['stage'], b['stage']),
        # pro animaci a hlášku
        'new_ability': bonus if bonus and bonus not in (a.get('bonus_move'), b.get('bonus_move')) else '',
        'new_species': species not in (a['species'], b['species']), 'rarity_up': rarity_up, 'mutation': mutation,
    }


def template_lore(spec, place):
    """Šablonový příběh PETa; AI lore (stretch G) ho může nahradit."""
    where = f'{place.name} ({place.obec})' if place.obec else place.name
    return f'{spec["species"]} typu {TYPE_LABEL[spec["type"]]} se zrodil u místa {where}. {place.subtype or ""}'.strip()


if __name__ == '__main__':
    assert [level_for_xp(x) for x in (0, 39, 40, 120, 599, 600, 10**9)] == [1, 1, 2, 3, 5, 6, MAX_LEVEL]
    a = generate(1, 'castle', 'common', 'x', 1)
    assert a == generate(1, 'castle', 'common', 'x', 1) and set(BASE_STATS) <= set(a)
    assert [next_rarity(r) for r in RARITY_MULT] == ['rare', 'epic', 'legendary', 'legendary']
    p1 = {**generate(1, 'castle', 'rare', 'x', 1), 'level': 3, 'xp': 130, 'stage': 2, 'type2': '', 'bonus_move': ''}
    p2 = {**generate(2, 'spring', 'rare', 'y', 1), 'level': 1, 'xp': 0, 'stage': 1, 'type2': '', 'bonus_move': ''}
    results = [merge(p1, p2, random.Random(i)) for i in range(300)]
    ok = [r for r in results if r]
    assert 0.5 < len(ok) / len(results) < 0.7                                   # kříženec ~60 %
    assert all(r['type'] == 'fortress' and r['type2'] == 'spring' and r['level'] == 3 for r in ok)
    assert any(r['bonus_move'] for r in ok) and any(r['rarity'] == 'epic' for r in ok)
    assert portmanteau('Vřídlík', 'Hradník') == 'Vřídník'
    print('ok')
