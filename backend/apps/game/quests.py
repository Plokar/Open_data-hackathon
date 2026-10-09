"""Questy počítané z dat, bez vlastních tabulek (PROJECT_SPEC 7.5)."""
import hashlib
from datetime import timedelta

from django.utils import timezone

from apps.places.models import Place

from .models import CheckIn


def daily_place(day=None):
    """Doporučené místo dne – deterministicky z data, stejné pro všechny hráče."""
    day = day or timezone.localdate()
    ids = list(Place.objects.filter(is_hazardous=False).order_by('id').values_list('id', flat=True))
    if not ids:
        return None
    return Place.objects.get(pk=ids[int(hashlib.sha256(day.isoformat().encode()).hexdigest(), 16) % len(ids)])


def week_start():
    today = timezone.localdate()
    return today - timedelta(days=today.weekday())


def quests_for(user):
    place = daily_place()
    stamps = CheckIn.objects.filter(user=user) if user.is_authenticated else CheckIn.objects.none()
    week = stamps.filter(created_at__date__gte=week_start()).count()
    food = stamps.filter(place__category='food').count()
    daily_done = bool(place) and stamps.filter(place=place).exists()
    return [
        {'code': 'daily', 'title': 'Místo dne', 'reward': 'XP ×2',
         'description': f'Dnes doporučujeme: {place.name} ({place.obec or place.okres}).' if place else 'Žádné místo.',
         'place_id': place and place.id, 'progress': int(daily_done), 'target': 1, 'done': daily_done},
        {'code': 'weekly3', 'title': '3 místa tento týden', 'reward': '+100 XP',
         'description': 'Orazítkuj tři různá místa od pondělí do neděle.', 'progress': min(week, 3), 'target': 3, 'done': week >= 3},
        {'code': 'dobrota', 'title': 'Ochutnej Dobrotu', 'reward': 'PET typu Chuť + odznak',
         'description': 'Navštiv oceněného výrobce Dobroty Karlovarského kraje.', 'progress': min(food, 1), 'target': 1, 'done': food >= 1},
    ]
