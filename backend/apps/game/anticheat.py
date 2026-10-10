"""Ověření check-inu na serveru (PROJECT_SPEC 8.1). Bez DB, testovatelné samostatně."""
import hashlib
import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from PIL import Image, UnidentifiedImageError

from apps.places.geo import haversine_m

MAX_ACCURACY_M = 100
MAX_SPEED_KMH = 130
MAX_CLOCK_SKEW_S = 120
MAX_PHOTO_BYTES = 8 * 1024 * 1024
EXIF_MAX_DIST_M = 1000
EXIF_MAX_AGE = timedelta(minutes=15)
PHASH_MAX_DISTANCE = 6


class Reject(Exception):
    def __init__(self, code, detail, status=400, **extra):
        super().__init__(detail)
        self.code, self.detail, self.status, self.extra = code, detail, status, extra


def check_position(place, lat, lon, accuracy, client_ts, now, last=None, radius=300, demo=False):
    """Pravidla 1–4 a 6. `last` je poslední check-in uživatele (lat, lon, created_at). Vrací vzdálenost v m."""
    distance = round(haversine_m(place.lat, place.lon, lat, lon))
    if last is not None:
        # Bez cooldownu jde orazítkovat víc blízkých míst hned za sebou. Skok GPS do MAX_ACCURACY_M se nepočítá,
        # jinak by dvě razítka během pár sekund vyšla jako „nereálně rychlý přesun“.
        dt = max(1, (now - last.created_at).total_seconds())
        moved_m = max(0, haversine_m(last.lat, last.lon, lat, lon) - MAX_ACCURACY_M)
        if moved_m / 1000 / (dt / 3600) > MAX_SPEED_KMH:
            raise Reject('TOO_FAST', 'Od posledního razítka ses přesunul nereálně rychle.', 403)
    if abs((now - client_ts).total_seconds()) > MAX_CLOCK_SKEW_S:
        raise Reject('CLOCK_SKEW', 'Čas v telefonu nesedí se serverem.')
    if demo:
        return distance  # DEMO_MODE přeskočí jen přesnost a vzdálenost
    if accuracy > MAX_ACCURACY_M:
        raise Reject('LOW_ACCURACY', 'Poloha je nepřesná, počkej na lepší signál GPS.', accuracy_m=round(accuracy))
    if distance > radius:
        raise Reject('TOO_FAR', f'Jsi příliš daleko od místa (limit {radius} m).', 403, distance_m=distance)
    return distance


def _dhash(img):
    # ponytail: dHash přes Pillow místo knihovny imagehash (numpy+scipy); stačí na odhalení přeposlaných fotek
    g = img.convert('L').resize((9, 8), Image.LANCZOS)
    px = g.tobytes()
    bits = ''.join('1' if px[r * 9 + c] > px[r * 9 + c + 1] else '0' for r in range(8) for c in range(8))
    return f'{int(bits, 2):016x}'


def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count('1')


def _gps(ifd):
    def deg(v, ref):
        d = float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
        return -d if ref in ('S', 'W') else d
    try:
        return deg(ifd[2], ifd[1]), deg(ifd[4], ifd[3])
    except (KeyError, IndexError, TypeError, ZeroDivisionError):
        return None


def analyze_photo(data, place, now, tz='Europe/Prague'):
    """Pravidla 7–8. Vrací dict se sha256, phash, exif_status a trust_penalty."""
    if len(data) > MAX_PHOTO_BYTES:
        raise Reject('PHOTO_TOO_LARGE', 'Fotka je větší než 8 MB.')
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise Reject('BAD_PHOTO', 'Soubor není platná fotka.')
    if img.format not in ('JPEG', 'PNG', 'WEBP'):
        raise Reject('BAD_PHOTO', 'Podporujeme jen JPEG, PNG a WebP.')

    exif = img.getexif()
    gps = _gps(exif.get_ifd(0x8825)) if exif else None
    taken = exif.get_ifd(0x8769).get(0x9003) if exif else None
    status = 'missing'
    if gps or taken:
        status = 'ok'
        if gps and haversine_m(place.lat, place.lon, *gps) > EXIF_MAX_DIST_M:
            status = 'mismatch'
        if taken:
            try:
                t = datetime.strptime(str(taken), '%Y:%m:%d %H:%M:%S').replace(tzinfo=ZoneInfo(tz))
                if now - t > EXIF_MAX_AGE:
                    status = 'mismatch'
            except ValueError:
                pass
    # Chybějící EXIF je běžný (prohlížeč ho maže) → jen mírná penalizace; nesoulad → neověřené razítko.
    penalty = {'ok': 0, 'missing': 20, 'mismatch': 60}[status]
    return {'sha256': hashlib.sha256(data).hexdigest(), 'phash': _dhash(img), 'exif_status': status, 'trust_penalty': penalty}


def trust_score(photo_penalty, accuracy, ai_delta=0):
    return max(0, min(100, 100 - photo_penalty - (10 if accuracy > 50 else 0) + ai_delta))
