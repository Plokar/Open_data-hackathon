"""Bosové na mapě: každý týden (od pondělí) se u 12 míst objeví boss, vyzvat ho jde jen do 300 m od místa.

Rozmístění je deterministické podle týdne (žádná tabulka ani cron), takže všichni hráči vidí stejné bosy
a další týden jsou jinde. S každým bosem jde bojovat jednou za týden, i když prohraješ (BossWin = pokus).
Na bosse můžou vyrazit až 3 kamarádi spolu, každý musí být na místě; boss sílí s počtem hráčů.
Kdo bosse porazí, dostane legendárního tvora a odznak.
"""
import random
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from apps.game import pets
from apps.game.models import BossWin, Pet
from apps.places.models import Place

from . import engine

BOSS_COUNT = 12
MAX_PARTY = 3
CATEGORIES = ('castle', 'lookout', 'nature', 'spring', 'culture', 'heritage')
TITLE = {'fortress': 'Pán hradeb', 'view': 'Vládce větrů', 'nature': 'Duch hvozdu',
         'spring': 'Pán pramenů', 'culture': 'Strážce múz', 'taste': 'Mistr hostin'}
HP_MULT = 2.5        # sólo boss
HP_PER_FRIEND = 1.6  # každý další hráč přidá bossovi tolik násobků životů navíc


def week_start(day=None):
    """Pondělí aktuálního (nebo zadaného) týdne – identifikátor „týdne bossů“."""
    day = day or timezone.localdate()
    return day - timedelta(days=day.weekday())


def spec(place, week):
    """Boss místa pro daný týden: druh, seed a staty legendárního tvora typu místa."""
    base = pets.generate(place.id, place.category, 'legendary', f'boss-{week}', 0)
    return {**base, 'title': TITLE[base['type']], 'name': f"{base['species']}, {TITLE[base['type']]}"}


def of_week(week=None):
    """[(place, spec)] pro týden. ponytail: výběr míst v cache na týden, při tisících míst stačí."""
    week = week or week_start()
    key = f'bosses:{week}'
    ids = cache.get(key)
    if ids is None:
        pool = sorted(Place.objects.filter(category__in=CATEGORIES, is_hazardous=False).values_list('id', flat=True))
        ids = random.Random(f'boss-{week}').sample(pool, min(BOSS_COUNT, len(pool)))
        cache.set(key, ids, 24 * 3600)
    places = Place.objects.in_bulk(ids)
    return [(places[i], spec(places[i], week)) for i in ids if i in places]


def active_at(place_id, week=None):
    return next(((p, s) for p, s in of_week(week) if p.id == place_id), (None, None))


def fought(user, place, week):
    return BossWin.objects.filter(user=user, place=place, week=week).exists()


def fighter(boss, party_pets):
    """Boss roste s nejsilnějším tvorem party (o 2 levely víc, plně vyvinutý) a s počtem hráčů (životy)."""
    level = max(max(p.level for p in party_pets) + 2, 4)
    stats = pets.scaled(boss, level, 3)
    stats['hp'] = round(stats['hp'] * (HP_MULT + HP_PER_FRIEND * (len(party_pets) - 1)))
    f = engine.fighter(stats, boss['type'], boss['name'], 3)
    f.update(seed=boss['seed'], rarity='legendary', level=level, team='boss', boss=True, user=None, owner=None)
    return f


def record_attempts(users, place, week):
    """Start souboje: každý hráč party tento týden s bosem bojoval (i kdyby prohrál)."""
    for u in users:
        BossWin.objects.get_or_create(user=u, place=place, week=week)


def reward(user, place, week):
    """Výhra: legendární tvor typu bosse. Vrací tvora (nebo None, když už tento týden vyhrál)."""
    if BossWin.objects.filter(user=user, place=place, week=week, won=True).exists():
        return None
    BossWin.objects.update_or_create(user=user, place=place, week=week, defaults={'won': True})
    s = spec(place, week)
    spec_pet = pets.generate(place.id, place.category, 'legendary', f'boss-{week}', user.id)
    return Pet.objects.create(owner=user, place=place, checkin=None, verified=True,
                              lore=f'Trofej z vítězného boje s bosem {s["name"]} u místa {place.name}.', **spec_pet)
