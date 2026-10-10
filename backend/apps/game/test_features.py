"""Zapomenutá místa, počasí, výpravy bez auta, Dobrotový pas, koupání a soukromí fotek."""
import io
import json
import time
import urllib.request
from datetime import timedelta

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone

from apps.places.models import Place

from . import badges, quests
from .models import CheckIn
from .tests import PLACE, _photo


def _place(i, category='nature', **kw):
    return Place.objects.create(source_item='t', source_layer=0, source_object_id=str(i), name=f'M{i}', category=category,
                                lat=PLACE.lat, lon=PLACE.lon, **kw)


def _stamp(user, place, **kw):
    """Razítko rovnou do DB; zestárne o den, ať další přes API nenarazí na COOLDOWN."""
    ci = CheckIn.objects.create(user=user, place=place, lat=place.lat, lon=place.lon, accuracy_m=5, distance_m=5, **kw)
    CheckIn.objects.filter(pk=ci.pk).update(created_at=timezone.now() - timedelta(days=1))
    return ci


def _checkin(api_client, place):
    return api_client.post('/api/checkins/', {'place': place.id, 'lat': place.lat, 'lon': place.lon, 'accuracy': 10,
                                              'client_ts': int(time.time() * 1000), 'photo': _photo()}, format='multipart')


@pytest.mark.django_db
def test_forgotten_bonus_fades_with_visits(api_client):
    quiet, busy = _place(1), _place(2)
    for i in range(3):
        _stamp(User.objects.create_user(f'o{i}', password='x'), busy)
    assert quiet.is_forgotten and not busy.is_forgotten
    assert not _place(3, is_hazardous=True).is_forgotten                      # nebezpečná místa bonus nemají
    _stamp(User.objects.create_user('demo', password='x'), quiet, is_demo=True)
    assert quiet.is_forgotten                                                  # demo razítka se nepočítají

    me = User.objects.create_user('me', password='x')
    api_client.force_authenticate(me)
    r = _checkin(api_client, busy)
    assert r.status_code == 201 and r.data['forgotten'] is False
    assert r.data['xp_gain'] == 50 * (2 if quests.daily_place_for(me)[0] == busy else 1)
    _stamp(me, quiet, forgotten=True)
    assert badges.progress({'type': 'forgotten', 'n': 3}, me) == (1, 3)
    assert api_client.get(f'/api/places/{quiet.id}/').data['forgotten'] is True


def test_weather_classification_and_cache(settings, monkeypatch):
    assert [quests.classify_weather(*a) for a in ((0, 0), (3, 0), (61, 0), (2, 5), (1, 1))] == ['clear', None, 'rain', 'rain', None]

    settings.WEATHER_ENABLED = True
    calls = []

    def offline(*a, **k):
        calls.append(1)
        raise OSError('offline')
    monkeypatch.setattr(urllib.request, 'urlopen', offline)
    assert quests.weather_today() is None and quests.weather_today() is None
    assert len(calls) == 1                                                     # po výpadku se hned nezkouší znovu

    cache.clear()
    body = json.dumps({'daily': {'weather_code': [63], 'precipitation_sum': [4.2]}}).encode()
    urls = []
    monkeypatch.setattr(urllib.request, 'urlopen', lambda url, **k: urls.append(url) or io.BytesIO(body))
    assert quests.weather_today(50.08, 12.37) == 'rain'                        # Cheb
    assert 'latitude=50.00&longitude=12.25' in urls[0]                         # Open-Meteo dostane jen buňku ~25 km
    quests.weather_today(50.02, 12.30)
    assert len(urls) == 1                                                      # stejná buňka = stejná předpověď z cache


@pytest.mark.django_db
def test_daily_place_follows_weather(monkeypatch):
    museum = _place(1, 'culture', subtype='Muzea a galerie')
    lookout = _place(2, 'lookout', subtype='Rozhledny')
    castle = _place(3, 'castle', subtype='Hrady a zříceniny')
    assert quests.daily_place(weather='rain') == museum
    assert quests.daily_place(weather='clear') == lookout
    lookout.delete()
    assert quests.daily_place(weather='clear') in (museum, castle)             # prázdný výběr → celý kraj


@pytest.mark.django_db
def test_daily_place_near_player_and_pinned_for_the_day(api_client, monkeypatch):
    cheb = _place(1, 'castle')                                                 # Cheb
    plzen = Place.objects.create(source_item='t', source_layer=0, source_object_id='2', name='Plzeň', category='castle',
                                 lat=49.7475, lon=13.3776)                     # ~75 km od Chebu
    near_plzen = (49.73, 13.40)
    assert quests.daily_place(lat=PLACE.lat, lon=PLACE.lon) == cheb
    assert quests.daily_place(lat=near_plzen[0], lon=near_plzen[1]) == plzen
    assert quests.daily_place(lat=48.0, lon=17.0) in (cheb, plzen)             # nic v okolí → celý kraj

    seen = []
    monkeypatch.setattr(quests, 'weather_today', lambda *a: seen.append(a))
    me = User.objects.create_user('me', password='x')
    api_client.force_authenticate(me)
    daily = {q['code']: q for q in api_client.get(f'/api/quests/?lat={near_plzen[0]}&lon={near_plzen[1]}').data}['daily']
    assert daily['place_id'] == plzen.id and seen == [near_plzen]              # počasí z polohy hráče
    assert quests.daily_place_for(me, PLACE.lat, PLACE.lon)[0] == plzen        # dojel do Chebu: místo dne drží
    assert quests.daily_place_for(User.objects.create_user('praha', password='x'), 50.08, 14.42)[0] in (cheb, plzen)
    assert seen[-1] == ()                                                      # mimo kraj → výchozí bod, ne Praha


@pytest.mark.django_db
def test_trail_reward(api_client):
    call_command('loaddata', 'badges', verbosity=0)
    stop = dict(nearest_stop_name='Cheb, Náměstí', nearest_stop_m=100, okres='Cheb')
    a, b, c = _place(1, 'castle', **stop), _place(2, 'spring', **stop), _place(3, 'culture', **stop)
    _place(4, 'info', **stop)
    _place(5, 'lookout', is_hazardous=True, **stop)                           # info a nebezpečná místa výprava nebere
    _place(6, 'castle', nearest_stop_name='Daleko', nearest_stop_m=900, okres='Cheb')
    t = quests.trails()
    assert len(t) == 1 and {p.id for p in t[0]['places']} == {a.id, b.id, c.id}

    u = User.objects.create_user('t', password='x')
    _stamp(u, a)
    _stamp(u, b)
    api_client.force_authenticate(u)
    assert api_client.get('/api/trails/').data[0]['progress'] == 2
    r = _checkin(api_client, c)
    assert r.status_code == 201, r.data
    assert r.data['trail_done']['stop'] == 'Cheb, Náměstí'
    assert r.data['pet']['rarity'] == 'rare'                                   # common místo → tvor o stupeň vzácnější
    assert 'trail_1' in [x['code'] for x in r.data['new_badges']]
    assert api_client.get('/api/trails/').data[0]['done'] is True


@pytest.mark.django_db
def test_food_pass_and_gourmet_badge(api_client):
    def prods(*cats):
        return {'products': [{'name': 'x', 'category': c, 'year': '2020'} for c in cats]}
    f1 = _place(1, 'food', extra=prods('Masné výrobky', 'Ostatní'))
    f2 = _place(2, 'food', extra=prods('Cukrářské výrobky'))
    f3 = _place(3, 'food', extra=prods('Pekařské a cukrářské výrobky', 'Mléčné výrobky'))
    f4 = _place(4, 'food', extra=prods('Masné výrobky'))
    u = User.objects.create_user('g', password='x')
    api_client.force_authenticate(u)

    rows = api_client.get('/api/food-pass/').data
    assert [(r['name'], r['producers'], r['tasted']) for r in rows] == [      # „Ostatní“ pryč, cukrářské = pekařské
        ('Masné výrobky', 2, False), ('Mléčné výrobky', 1, False), ('Pekařské a cukrářské výrobky', 2, False)]
    _stamp(u, f1)
    _stamp(u, f4)
    assert quests.tasted_count(u) == 1                                         # dva výrobci stejného druhu = jeden druh
    _stamp(u, f2)
    _stamp(u, f3)
    assert badges.progress({'type': 'food_kinds', 'n': 3}, u) == (3, 3)
    assert all(r['tasted'] for r in api_client.get('/api/food-pass/').data)


@pytest.mark.django_db
def test_swimmer_counts_only_bathing_spots():
    u = User.objects.create_user('s', password='x')
    for i in range(3):
        _stamp(u, _place(i, subtype='Koupací místa s kontrolou kvality vody'))
    _stamp(u, _place(9, subtype='Solné jeskyně'))
    CheckIn.objects.update(created_at=timezone.now().replace(month=7, day=1))
    rule = {'type': 'season', 'months': [6, 7, 8], 'category': 'nature', 'subtype': 'Koupací', 'n': 3}
    assert badges.progress(rule, u) == (3, 3)


@pytest.mark.django_db
def test_photo_public_toggle(api_client):
    api_client.force_authenticate(User.objects.create_user('p', password='x'))
    assert api_client.get('/api/auth/me/').data['profile']['photo_public'] is False
    r = api_client.put('/api/auth/me/', {'photo_public': True}, format='json')
    assert r.status_code == 200 and r.data['profile']['photo_public'] is True
