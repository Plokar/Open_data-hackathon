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


def scaled(stats, level, stage, same_type_stamps=0):
    """Staty do boje: level, stupeň evoluce a +2 % za každá 3 razítka stejného typu."""
    mult = (1 + LEVEL_GROWTH * (level - 1)) * STAGES[stage][1] * (1 + 0.02 * (same_type_stamps // 3))
    return {k: round(stats[k] * mult) for k in BASE_STATS}


def effective_stats(pet, same_type_stamps=0):
    return scaled({k: getattr(pet, k) for k in BASE_STATS}, pet.level, pet.stage, same_type_stamps)


def can_evolve(pet):
    return pet.stage < 3 and pet.level >= EVOLVE_LEVEL[pet.stage + 1]


def template_lore(spec, place):
    """Šablonový příběh PETa; AI lore (stretch G) ho může nahradit."""
    where = f'{place.name} ({place.obec})' if place.obec else place.name
    return f'{spec["species"]} typu {TYPE_LABEL[spec["type"]]} se zrodil u místa {where}. {place.subtype or ""}'.strip()


if __name__ == '__main__':
    assert [level_for_xp(x) for x in (0, 39, 40, 120, 599, 600, 10**9)] == [1, 1, 2, 3, 5, 6, MAX_LEVEL]
    a = generate(1, 'castle', 'common', 'x', 1)
    assert a == generate(1, 'castle', 'common', 'x', 1) and set(BASE_STATS) <= set(a)
    assert [next_rarity(r) for r in RARITY_MULT] == ['rare', 'epic', 'legendary', 'legendary']
    print('ok')
