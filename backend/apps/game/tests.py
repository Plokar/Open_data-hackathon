import io
import time
from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone
from PIL import Image

from apps.places.models import Place

from . import anticheat, pets

PLACE = SimpleNamespace(lat=50.0794, lon=12.3706)  # Chebský hrad


def _photo(color=(200, 30, 30), size=(64, 48)):
    buf = io.BytesIO()
    img = Image.new('RGB', size, color)
    for x in range(size[0] // 2):  # trochu struktury, ať se liší dHash
        img.putpixel((x, x % size[1]), (color[2], color[0], color[1]))
    img.save(buf, 'JPEG')
    buf.seek(0)
    buf.name = 'p.jpg'
    return buf


def test_position_rules():
    now = timezone.now()
    assert anticheat.check_position(PLACE, 50.0800, 12.3710, 20, now, now) < 300
    cases = [
        ((50.09, 12.3706, 20, now, now), 'TOO_FAR'),                      # ~1,2 km
        ((50.0794, 12.3706, 500, now, now), 'LOW_ACCURACY'),
        ((50.0794, 12.3706, 20, now - timedelta(minutes=5), now), 'CLOCK_SKEW'),
        ((50.0794, 12.3706, 20, now, now, SimpleNamespace(lat=50.0794, lon=12.3706, created_at=now - timedelta(seconds=10))), 'COOLDOWN'),
        ((50.0794, 12.3706, 20, now, now, SimpleNamespace(lat=50.2300, lon=12.8700, created_at=now - timedelta(minutes=5))), 'TOO_FAST'),
    ]
    for args, code in cases:
        with pytest.raises(anticheat.Reject) as e:
            anticheat.check_position(PLACE, *args)
        assert e.value.code == code
    # DEMO_MODE přeskočí vzdálenost a přesnost, ne ostatní pravidla
    assert anticheat.check_position(PLACE, 50.2, 12.8, 500, now, now, demo=True) > 300


def test_photo_checks():
    info = anticheat.analyze_photo(_photo().read(), PLACE, timezone.now())
    assert info['exif_status'] == 'missing' and info['trust_penalty'] == 20 and len(info['phash']) == 16
    with pytest.raises(anticheat.Reject):
        anticheat.analyze_photo(b'not an image', PLACE, timezone.now())


def test_pet_is_deterministic():
    a = pets.generate(1, 'castle', 'rare', 'abc', 7)
    assert a == pets.generate(1, 'castle', 'rare', 'abc', 7)
    assert a['type'] == 'fortress' and a['species'] in pets.SPECIES['fortress']
    assert 100 * 1.15 * 0.9 <= a['hp'] <= 100 * 1.15 * 1.1 + 1
    assert pets.generate(1, 'castle', 'rare', 'abd', 7)['seed'] != a['seed']


@pytest.mark.django_db
def test_checkin_flow(api_client):
    from django.core.management import call_command
    call_command('loaddata', 'badges', verbosity=0)
    p1 = Place.objects.create(source_item='t', source_layer=0, source_object_id='1', name='Hrad Cheb',
                              category='castle', lat=PLACE.lat, lon=PLACE.lon, okres='Cheb', rarity='rare')
    p2 = Place.objects.create(source_item='t', source_layer=0, source_object_id='2', name='Daleko',
                              category='lookout', lat=50.39, lon=12.96, okres='Karlovy Vary')

    r = api_client.post('/api/auth/register/', {'username': 'hrac1', 'email': 'h@x.cz', 'password': 'Tajne-heslo-123',
                                                'password2': 'Tajne-heslo-123', 'age_group': 'adult', 'consent_confirmed': True})
    assert r.status_code == 201, r.data
    assert r.data['user']['profile']['nickname'] == 'hrac1'

    ts = int(time.time() * 1000)
    r = api_client.post('/api/checkins/', {'place': p2.id, 'lat': PLACE.lat, 'lon': PLACE.lon, 'accuracy': 10,
                                           'client_ts': ts, 'photo': _photo()}, format='multipart')
    assert r.status_code == 403 and r.data['error_code'] == 'TOO_FAR' and r.data['distance_m'] > 40000

    r = api_client.post('/api/checkins/', {'place': p1.id, 'lat': PLACE.lat, 'lon': PLACE.lon, 'accuracy': 10,
                                           'client_ts': ts, 'photo': _photo()}, format='multipart')
    assert r.status_code == 201, r.data
    assert r.data['pet']['type'] == 'fortress' and r.data['pet']['verified'] is True
    from .quests import daily_place
    assert r.data['xp_gain'] == 75 * (2 if daily_place() == p1 else 1)
    assert [b['code'] for b in r.data['new_badges']] == ['first']

    r = api_client.post('/api/checkins/', {'place': p1.id, 'lat': PLACE.lat, 'lon': PLACE.lon, 'accuracy': 10,
                                           'client_ts': ts, 'photo': _photo((0, 90, 200))}, format='multipart')
    assert r.data['error_code'] == 'ALREADY_STAMPED'

    assert len(api_client.get('/api/pets/me/').data) == 1
    badges = {b['code']: b for b in api_client.get('/api/badges/').data}
    assert badges['first']['awarded'] and badges['castle_lord']['progress'] == 1
    assert api_client.get('/api/leaderboard/').data[0]['stamps'] == 1
    assert api_client.get(f'/api/places/{p1.id}/').data['stamped'] is True

    from .models import CheckIn
    photo = CheckIn.objects.get().photo
    assert photo.storage.exists(photo.name)
    assert api_client.delete('/api/auth/me/').status_code == 204
    assert not photo.storage.exists(photo.name) and not CheckIn.objects.exists()


@pytest.mark.django_db
def test_daily_quest_and_teams(api_client):
    from datetime import date
    from django.contrib.auth.models import User
    from . import quests
    for i in range(5):
        Place.objects.create(source_item='t', source_layer=0, source_object_id=str(i), name=f'M{i}', category='nature',
                             lat=PLACE.lat + i * 0.01, lon=PLACE.lon)
    d = date(2026, 10, 10)
    assert quests.daily_place(d) == quests.daily_place(d)               # stejné místo pro stejný den

    daily = quests.daily_place()
    u = User.objects.create_user('q', password='x')
    api_client.force_authenticate(u)
    r = api_client.post('/api/checkins/', {'place': daily.id, 'lat': daily.lat, 'lon': daily.lon, 'accuracy': 10,
                                           'client_ts': int(time.time() * 1000), 'photo': _photo()}, format='multipart')
    assert r.status_code == 201 and r.data['xp_gain'] == 100              # common 50 × 2
    assert {q['code']: q for q in api_client.get('/api/quests/').data}['daily']['done']

    code = api_client.post('/api/teams/', {'name': 'Chebští vlci'}, format='json').data['team']['join_code']
    v = User.objects.create_user('v', password='x')
    api_client.force_authenticate(v)
    assert len(api_client.post('/api/teams/join/', {'join_code': code.lower()}, format='json').data['team']['members']) == 2
    assert api_client.get('/api/leaderboard/?scope=team').data[0] == {'name': 'Chebští vlci', 'stamps': 1, 'wins': 0, 'players': 2}


def test_ai_hooks_fallbacks(settings):
    from . import ai_hooks
    assert [ai_hooks.verdict_delta(a) for a in ('ANO.', 'ne', '', None, 'nevím')] == [10, -30, 0, 0, 0]
    settings.AI_VISION_VERIFY = settings.AI_LORE = False
    assert ai_hooks.vision_trust_delta(b'x', 'castle') == 0
    place = SimpleNamespace(name='Hrad Cheb', obec='Cheb', subtype='Hrady')
    spec = pets.generate(1, 'castle', 'rare', 'a', 1)
    assert ai_hooks.generate_lore(spec, place) == pets.template_lore(spec, place)
