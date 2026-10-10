"""Questy počítané z dat, bez vlastních tabulek (PROJECT_SPEC 7.5)."""
import hashlib
import json
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from apps.places.importer import BBOX
from apps.places.models import Place

from .models import CheckIn

# Počasí po buňkách ~25 km kolem hráče: předpověď sedí na jeho okolí a Open-Meteo dostane jen hrubou polohu, ne přesnou
WEATHER_CELL = 0.25
WEATHER_URL = ('https://api.open-meteo.com/v1/forecast?latitude={lat:.2f}&longitude={lon:.2f}'
               '&daily=weather_code,precipitation_sum&timezone=Europe%2FPrague&forecast_days=1')
DEFAULT_POS = (49.7, 12.97)  # střed Karlovarského a Plzeňského kraje, když o poloze hráče nic nevíme
NEAR_DEG = (0.27, 0.42)      # ~30 km: místo dne je v dosahu hráče, ne na druhém konci kraje
# počasí → z jakých míst se vybírá místo dne (v dešti pod střechu, za jasna na výhled)
WEATHER_POOL = {
    'rain': Q(subtype__in=('Muzea a galerie', 'Muzea', 'Solné jeskyně', 'Divadla')),  # 'Muzea' = Plzeňský kraj
    'clear': Q(category='lookout'),
}
WEATHER_HINT = {'rain': 'Dnes prší, tak doporučujeme něco pod střechou', 'clear': 'Dnes bude jasno, vyraz na výhled'}


def classify_weather(code, rain_mm):
    """WMO kód počasí a srážky v mm → 'rain' / 'clear' / None (nic zvláštního)."""
    if code >= 51 or rain_mm >= 2:
        return 'rain'
    if code <= 2 and rain_mm < 0.5:
        return 'clear'
    return None


def in_region(lat, lon):
    """Poloha uvnitř obdélníku obou krajů. Hráč z Prahy dostane počasí a místo dne jako by o něm nic nevíme."""
    return lat is not None and lon is not None and (
        BBOX['lat'][0] <= lat <= BBOX['lat'][1] and BBOX['lon'][0] <= lon <= BBOX['lon'][1])


def weather_today(lat=DEFAULT_POS[0], lon=DEFAULT_POS[1]):
    """Počasí na dnešek v okolí polohy, po celý den stejné díky cache (místo dne se nesmí měnit pod rukama). Při chybě None."""
    if not settings.WEATHER_ENABLED:
        return None
    lat, lon = (round(v / WEATHER_CELL) * WEATHER_CELL for v in (lat, lon))
    key = f'weather:{timezone.localdate()}:{lat:.2f}:{lon:.2f}'
    w = cache.get(key)
    if w is None:
        try:
            with urllib.request.urlopen(WEATHER_URL.format(lat=lat, lon=lon), timeout=2) as r:
                d = json.load(r)['daily']
            w, ttl = classify_weather(d['weather_code'][0], d['precipitation_sum'][0] or 0) or 'none', 86400
        except Exception:  # síť, JSON i chybějící pole: hra musí běžet dál
            w, ttl = 'none', 300  # po výpadku to za 5 min zkusí znovu
        cache.set(key, w, ttl)
    return None if w == 'none' else w


def daily_place(day=None, lat=None, lon=None, weather=None):
    """Místo dne deterministicky z data: z míst do ~30 km od polohy (když nějaká jsou) a podle počasí."""
    base = Place.objects.filter(is_hazardous=False)
    if lat is not None:
        near = base.filter(lat__range=(lat - NEAR_DEG[0], lat + NEAR_DEG[0]), lon__range=(lon - NEAR_DEG[1], lon + NEAR_DEG[1]))
        base = near if near.exists() else base
    ids = list((base.filter(WEATHER_POOL[weather]) if weather else base).order_by('id').values_list('id', flat=True))
    ids = ids or list(base.order_by('id').values_list('id', flat=True))
    if not ids:
        return None
    day = day or timezone.localdate()
    return Place.objects.get(pk=ids[int(hashlib.sha256(day.isoformat().encode()).hexdigest(), 16) % len(ids)])


def daily_place_for(user, lat=None, lon=None):
    """
    (místo dne, počasí) pro hráče. Poprvé za den se určí podle polohy z prohlížeče, jinak podle posledního razítka,
    a pak drží do půlnoci: razítko na místě dne musí dát bonus, i když hráč mezitím dojel jinam.
    """
    key = f'daily:{timezone.localdate()}:{user.id}' if user.is_authenticated else None
    pinned = key and cache.get(key)
    if pinned:
        return Place.objects.filter(pk=pinned['place']).first(), pinned['weather']
    if not in_region(lat, lon) and user.is_authenticated:
        last = CheckIn.objects.filter(user=user).values('lat', 'lon').first()  # řazení -created_at = poslední
        lat, lon = (last['lat'], last['lon']) if last else (None, None)
    if not in_region(lat, lon):
        lat = lon = None
    # ponytail: pin v cache, ne v DB; po vymazání cache se místo dne přepočítá (stejně, pokud se hráč nepohnul)
    weather = weather_today(lat, lon) if lat is not None else weather_today()
    place = daily_place(lat=lat, lon=lon, weather=weather)
    if key and place:
        cache.set(key, {'place': place.id, 'weather': weather}, 86400)
    return place, weather


def week_start():
    today = timezone.localdate()
    return today - timedelta(days=today.weekday())


# ── Výpravy bez auta ──────────────────────────────────────────────────────────

TRAIL_STOP_M, TRAIL_SIZE = 500, 4


def trails():
    """Výpravy: 3–4 místa u jedné autobusové zastávky (do 500 m od ní), co nejrůznějších druhů. Počítá se z dat, bez tabulky."""
    groups, seen = {}, set()
    qs = (Place.objects.filter(is_hazardous=False, nearest_stop_m__lte=TRAIL_STOP_M)
          .exclude(category='info').exclude(nearest_stop_name='').order_by('nearest_stop_m', 'id'))
    for p in qs:
        key = (p.nearest_stop_name, p.okres)
        if (key, p.name) in seen:  # stejné místo ve dvou vrstvách (např. zámek jako hrad i jako kultura)
            continue
        seen.add((key, p.name))
        groups.setdefault(key, {}).setdefault(p.category, []).append(p)
    out = []
    for (stop, okres), cats in groups.items():
        queues = list(cats.values())
        picked = []
        while len(picked) < TRAIL_SIZE and any(queues):  # po jednom z každého druhu dokola
            for q in queues:
                if q and len(picked) < TRAIL_SIZE:
                    picked.append(q.pop(0))
        if len(picked) >= 3:
            out.append({'id': hashlib.sha1(f'{stop}|{okres}'.encode()).hexdigest()[:8],
                        'stop': stop, 'okres': okres, 'places': picked})
    return sorted(out, key=lambda t: (t['okres'], t['stop']))


def _stamped_ids(user):
    return set(CheckIn.objects.filter(user=user).values_list('place_id', flat=True)) if user.is_authenticated else set()


def trails_for(user):
    stamped = _stamped_ids(user)
    out = []
    for t in trails():
        done = sum(p.id in stamped for p in t['places'])
        out.append({
            'id': t['id'], 'stop': t['stop'], 'okres': t['okres'], 'progress': done, 'target': len(t['places']),
            'done': done == len(t['places']),
            'places': [{'id': p.id, 'name': p.name, 'category': p.category, 'stamped': p.id in stamped} for p in t['places']],
        })
    return out


def trails_done(user):
    return sum(t['done'] for t in trails_for(user))


def trail_finished_by(user, place):
    """Výprava, kterou razítko v `place` dokončí (ostatní místa už v Pasu jsou), jinak None. Volat před uložením razítka."""
    stamped = _stamped_ids(user)
    for t in trails():
        ids = {p.id for p in t['places']}
        if place.id in ids and ids - {place.id} <= stamped:
            return t
    return None


# ── Dobrotový pas ─────────────────────────────────────────────────────────────

FOOD_ALIAS = {'Cukrářské výrobky': 'Pekařské a cukrářské výrobky'}  # dva názvy jedné soutěžní kategorie
FOOD_IGNORE = {'', 'Ostatní'}


def food_categories(place):
    return {FOOD_ALIAS.get(c, c) for pr in place.extra.get('products', []) if (c := pr.get('category', '')) not in FOOD_IGNORE}


def food_pass(user):
    """Druhy oceněných Dobrot kraje a které z nich hráč ochutnal (razítkem u výrobce)."""
    producers, tasted = {}, set()
    for p in Place.objects.filter(category='food'):
        for c in food_categories(p):
            producers.setdefault(c, set()).add(p.id)
    if user.is_authenticated:
        for p in Place.objects.filter(category='food', checkins__user=user):
            tasted |= food_categories(p)
    return [{'name': c, 'producers': len(ids), 'tasted': c in tasted} for c, ids in sorted(producers.items())]


def tasted_count(user):
    return sum(c['tasted'] for c in food_pass(user))


def quests_for(user, lat=None, lon=None):
    place, weather = daily_place_for(user, lat, lon)
    stamps = CheckIn.objects.filter(user=user) if user.is_authenticated else CheckIn.objects.none()
    week = stamps.filter(created_at__date__gte=week_start()).count()
    food = stamps.filter(place__category='food').count()
    daily_done = bool(place) and stamps.filter(place=place).exists()
    hint = WEATHER_HINT.get(weather)
    tasted = tasted_count(user)
    trails_n = trails_done(user)
    return [
        {'code': 'daily', 'title': 'Místo dne', 'reward': 'XP ×2', 'weather': weather,
         'description': (f'{hint}: {place.name} ({place.obec or place.okres}).' if hint
                         else f'Dnes doporučujeme: {place.name} ({place.obec or place.okres}).') if place else 'Žádné místo.',
         'place_id': place and place.id, 'progress': int(daily_done), 'target': 1, 'done': daily_done},
        {'code': 'weekly3', 'title': '3 místa tento týden', 'reward': '+100 XP',
         'description': 'Orazítkuj tři různá místa od pondělí do neděle.', 'progress': min(week, 3), 'target': 3, 'done': week >= 3},
        {'code': 'dobrota', 'title': 'Ochutnej Dobrotu', 'reward': 'PET typu Chuť + odznak',
         'description': 'Navštiv oceněného výrobce Dobroty Karlovarského kraje.', 'progress': min(food, 1), 'target': 1, 'done': food >= 1},
        {'code': 'dobrota3', 'title': 'Dobrotový pas', 'reward': 'odznak Gurmán',
         'description': 'Navštiv výrobce ze 3 různých druhů Dobrot (maso, mléčné, pečivo, nápoje, ovoce a med).',
         'progress': min(tasted, 3), 'target': 3, 'done': tasted >= 3},
        {'code': 'trail', 'title': 'Výprava bez auta', 'reward': 'odznak + tvor o stupeň vzácnější',
         'description': 'Vystup na autobusové zastávce a obejdi všechna místa jedné výpravy.',
         'progress': min(trails_n, 1), 'target': 1, 'done': trails_n >= 1},
    ]
