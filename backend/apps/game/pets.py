"""Deterministické generování PETů (PROJECT_SPEC 7.2). Čistý Python."""
import hashlib
import random

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
BASE_STATS = {'hp': 100, 'atk': 20, 'defense': 12, 'spd': 10}


def pet_seed(place_id, photo_sha256, user_id):
    return int(hashlib.sha256(f'{place_id}{photo_sha256}{user_id}'.encode()).hexdigest()[:15], 16)


def generate(place_id, category, rarity, photo_sha256, user_id):
    seed = pet_seed(place_id, photo_sha256, user_id)
    rng = random.Random(seed)
    pet_type = CATEGORY_TYPE[category]
    species = rng.choice(SPECIES[pet_type])
    stats = {k: round(v * RARITY_MULT[rarity] * rng.uniform(0.9, 1.1)) for k, v in BASE_STATS.items()}
    return {'seed': seed, 'type': pet_type, 'species': species, 'name': species, 'rarity': rarity, **stats}


def effective_stats(pet, same_type_stamps=0):
    """Staty do boje: +4 % za level nad 1, +2 % za každá 3 razítka stejného typu."""
    mult = (1 + 0.04 * (pet.level - 1)) * (1 + 0.02 * (same_type_stamps // 3))
    return {k: round(getattr(pet, k) * mult) for k in BASE_STATS}


def template_lore(spec, place):
    """Šablonový příběh PETa; AI lore (stretch G) ho může nahradit."""
    where = f'{place.name} ({place.obec})' if place.obec else place.name
    return f'{spec["species"]} typu {TYPE_LABEL[spec["type"]]} se zrodil u místa {where}. {place.subtype or ""}'.strip()
