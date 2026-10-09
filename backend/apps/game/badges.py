"""Vyhodnocení deklarativních pravidel odznaků (PROJECT_SPEC 7.4). Nový odznak = nový záznam ve fixture."""
from apps.places.models import Place

from .models import Badge, CheckIn, UserBadge


def progress(rule, user):
    """Vrátí (postup, cíl) pro pravidlo odznaku."""
    stamps = CheckIn.objects.filter(user=user)
    kind = rule['type']
    if 'category' in rule:
        stamps = stamps.filter(place__category=rule['category'])
    if 'okres' in rule:
        stamps = stamps.filter(place__okres=rule['okres'])

    if kind == 'count':
        return stamps.count(), rule['n']
    if kind == 'all_in_category':
        # nebezpečná místa se do odznaků „všechny" nepočítají (12.5)
        places = Place.objects.filter(category=rule['category'], is_hazardous=False)
        if 'okres' in rule:
            places = places.filter(okres=rule['okres'])
        return stamps.filter(place__is_hazardous=False).count(), places.count()
    if kind == 'district_complete':
        return stamps.values('place__category').distinct().count(), rule['categories_min']
    if kind == 'no_car':
        return stamps.filter(place__nearest_stop_m__lte=300).count(), rule['n']
    if kind == 'season':
        return stamps.filter(created_at__month__in=rule['months']).count(), rule['n']
    raise ValueError(f'Neznámé pravidlo {kind}')


def evaluate(user):
    """Udělí nově splněné odznaky, vrátí je jako seznam."""
    owned = set(UserBadge.objects.filter(user=user).values_list('badge_id', flat=True))
    new = []
    for badge in Badge.objects.exclude(id__in=owned):
        done, target = progress(badge.rule, user)
        if target and done >= target:
            UserBadge.objects.create(user=user, badge=badge)
            new.append(badge)
    return new
