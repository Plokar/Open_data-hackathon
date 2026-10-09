"""Hodnocení hráče: body za objevování, souboje, tvory a odznaky.

Dřív to bylo Elo jen z hodnocených soubojů, takže skoro všichni měli 1000. Teď hodnocení roste
s tím, co hráč v kraji opravdu udělá. Ukládá se do Profile.rating a přepočítává se při zobrazení
profilu a po souboji (z rozdílu je „hodnocení +N“ na konci souboje).
"""
from django.db.models import Q

STAMP_POINTS = {'common': 10, 'rare': 25, 'epic': 50, 'legendary': 100}
FORGOTTEN_BONUS = 10   # razítko z málo navštěvovaného místa
WIN_POINTS = {'ranked': 30, 'friendly': 15, 'practice': 5}
PET_LEVEL_POINTS = 5   # za každý level tvora nad 1
EVOLUTION_POINTS = 20  # za každý stupeň evoluce
BADGE_POINTS = 25


def compute(user):
    from apps.battles.models import Battle
    stamps = sum(STAMP_POINTS.get(r, 0) + FORGOTTEN_BONUS * f for r, f in
                 user.checkins.filter(is_demo=False).values_list('place__rarity', 'forgotten'))
    wins = Battle.objects.filter(Q(player_a=user, winner='a') | Q(player_b=user, winner='b'), status='finished')
    battles = sum(WIN_POINTS.get(m, 0) for m in wins.values_list('mode', flat=True))
    pets = sum(PET_LEVEL_POINTS * (lvl - 1) + EVOLUTION_POINTS * (stage - 1) for lvl, stage in user.pets.values_list('level', 'stage'))
    return stamps + battles + pets + BADGE_POINTS * user.badges.count()


def refresh(user):
    """Přepočítá a uloží hodnocení, vrátí nové."""
    from .views import profile_of
    prof = profile_of(user)
    value = compute(user)
    if prof.rating != value:
        prof.rating = value
        prof.save(update_fields=['rating'])
    return value
