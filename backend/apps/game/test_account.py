import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APIClient

from apps.places.models import Place

from . import pets, rating
from .models import Badge, CheckIn, Pet, Profile, UserBadge


def _onboarded(name):
    """Účet jako z onboardingu: jen jméno, vygenerovaný e-mail a heslo, které hráč nezná."""
    u = User.objects.create_user(f'{name}_ab12cd', email=f'hrac-ab12cd{name}@zapadgo.cz', password='nahodne-heslo-xyz')
    Profile.objects.create(user=u, nickname=name)
    return u


@pytest.fixture
def place(db):
    return Place.objects.create(source_item='t', source_layer=0, source_object_id='1', name='Hrad', category='castle',
                                lat=50, lon=12.5, rarity='epic')


def test_rating_counts_exploration_pets_and_badges(place):
    u = _onboarded('ondra')
    assert rating.compute(u) == 0
    ci = CheckIn.objects.create(user=u, place=place, lat=0, lon=0, accuracy_m=5, distance_m=0, forgotten=True)
    Pet.objects.create(owner=u, place=place, checkin=ci, level=3, stage=2, **pets.generate(place.id, 'castle', 'epic', 'x', u.id))
    UserBadge.objects.create(user=u, badge=Badge.objects.create(code='b', name='B', description='', rule={}))
    expected = (rating.STAMP_POINTS['epic'] + rating.FORGOTTEN_BONUS + 2 * rating.PET_LEVEL_POINTS
                + rating.EVOLUTION_POINTS + rating.BADGE_POINTS)
    assert rating.refresh(u) == expected and Profile.objects.get(user=u).rating == expected


@pytest.mark.django_db
def test_claim_account_then_login_by_nickname_or_email():
    u = _onboarded('jana')
    c = APIClient()
    c.force_authenticate(u)
    assert c.get('/api/auth/me/').data['profile']['account_claimed'] is False
    bad = c.post('/api/auth/credentials/', {'email': 'jana@example.cz', 'password': 'Krusnehory2026', 'password2': 'jine'})
    assert bad.status_code == 400 and 'password' in bad.data
    ok = c.post('/api/auth/credentials/', {'email': 'Jana@Example.cz', 'password': 'Krusnehory2026', 'password2': 'Krusnehory2026'})
    assert ok.status_code == 200 and ok.data['profile']['account_claimed'] is True
    # pojištěný účet už bez aktuálního hesla nezměníš
    assert c.post('/api/auth/credentials/', {'email': 'x@example.cz'}).status_code == 400
    anon = APIClient()
    for ident in ('jana', 'JANA', 'jana@example.cz'):
        assert anon.post('/api/auth/token/', {'username': ident, 'password': 'Krusnehory2026'}).status_code == 200, ident
    assert anon.post('/api/auth/token/', {'username': 'jana', 'password': 'spatne'}).status_code == 401
    other = _onboarded('petr')
    c.force_authenticate(other)
    taken = c.post('/api/auth/credentials/', {'email': 'jana@example.cz', 'password': 'Slavkovsky1', 'password2': 'Slavkovsky1'})
    assert taken.status_code == 400 and 'email' in taken.data


@override_settings(ADMIN_PANEL_USERNAME='spravce', ADMIN_PANEL_PASSWORD='tajne-heslo')
def test_admin_panel(place):
    u = _onboarded('karel')
    ci = CheckIn.objects.create(user=u, place=place, lat=0, lon=0, accuracy_m=5, distance_m=0)
    pet = Pet.objects.create(owner=u, place=place, checkin=ci, **pets.generate(place.id, 'castle', 'common', 'k', u.id))
    Badge.objects.create(code='first', name='První', description='', rule={})
    c = APIClient()
    assert c.get('/api/panel/users/').status_code in (401, 403)
    assert c.post('/api/panel/login/', {'username': 'spravce', 'password': 'spatne'}).status_code == 401
    token = c.post('/api/panel/login/', {'username': 'spravce', 'password': 'tajne-heslo'}).data['token']
    c.credentials(HTTP_AUTHORIZATION=f'Panel {token}')
    assert [r['nickname'] for r in c.get('/api/panel/users/', {'q': 'kar'}).data] == ['karel']
    d = c.patch(f'/api/panel/users/{u.id}/', {'password': 'noveheslo', 'xp': 450, 'nickname': 'Karel2'}).data
    assert d['level'] == 3 and d['nickname'] == 'Karel2'
    assert APIClient().post('/api/auth/token/', {'username': 'Karel2', 'password': 'noveheslo'}).status_code == 200
    d = c.post(f'/api/panel/users/{u.id}/badges/', {'code': 'first'}).data
    assert next(b for b in d['badges'] if b['code'] == 'first')['owned']
    d = c.patch(f'/api/panel/pets/{pet.id}/', {'level': 7, 'stage': 3, 'rarity': 'legendary', 'heal': True}).data
    assert (d['pets'][0]['level'], d['pets'][0]['stage'], d['pets'][0]['rarity']) == (7, 3, 'legendary')
    assert pets.level_for_xp(Pet.objects.get(pk=pet.id).xp) == 7
    assert c.delete(f'/api/panel/users/{u.id}/').status_code == 204 and not User.objects.filter(pk=u.id).exists()
    c.credentials(HTTP_AUTHORIZATION='Panel podvrh')
    assert c.get('/api/panel/stats/').status_code in (401, 403)



def test_merge_success_and_failure(place, monkeypatch):
    import random
    u = _onboarded('chovatel')
    other = Place.objects.create(source_item='t', source_layer=0, source_object_id='2', name='Pramen', category='spring', lat=50, lon=12.5)

    def mk(pl, cat, seed):
        return Pet.objects.create(owner=u, place=pl, checkin=None, level=2, xp=50, **pets.generate(pl.id, cat, 'rare', seed, u.id))

    c = APIClient()
    c.force_authenticate(u)
    a, b = mk(place, 'castle', 'a'), mk(other, 'spring', 'b')
    odds = c.get('/api/pets/merge/preview/', {'a': a.id, 'b': b.id}).data
    assert odds['hybrid'] and odds['success'] == 0.6
    assert c.post('/api/pets/merge/', {'a': a.id, 'b': a.id}).data['error_code'] == 'BAD_PAIR'
    strong = mk(place, 'castle', 'silny')
    strong.level = 4  # a, b mají level 2: rozdíl 2 je moc
    strong.save()
    assert c.post('/api/pets/merge/', {'a': a.id, 'b': strong.id}).data['error_code'] == 'LEVEL_GAP'
    assert c.get('/api/pets/merge/preview/', {'a': a.id, 'b': strong.id}).data['error_code'] == 'LEVEL_GAP'
    strong.delete()
    # nepovede se a rodiče přežijí: jsou vyčerpaní a hned znovu to nejde
    monkeypatch.setattr(random, 'SystemRandom', lambda: type('R', (), {'random': lambda self: 0.99})())
    r = c.post('/api/pets/merge/', {'a': a.id, 'b': b.id}).data
    assert r['success'] is False and r['lost'] is False and Pet.objects.filter(owner=u).count() == 2
    assert c.post('/api/pets/merge/', {'a': a.id, 'b': b.id}).data['error_code'] == 'PET_INJURED'
    Pet.objects.filter(owner=u).update(injured_until=None)
    monkeypatch.setattr(random, 'SystemRandom', lambda: random.Random(1))
    r = c.post('/api/pets/merge/', {'a': a.id, 'b': b.id}).data
    assert r['success'] and Pet.objects.filter(owner=u).count() == 1
    child = r['pet']
    assert child['type2'] in ('spring', 'fortress') and child['type2'] != child['type'] and child['is_demo'] is False
    assert any(m['id'] in ('jet', 'rockfall') and m['type'] == child['type2'] for m in child['moves'])  # kouzlo druhého typu



def test_failed_merge_can_lose_both_parents(place, monkeypatch):
    import random
    u = _onboarded('smolar')
    pets_ = [Pet.objects.create(owner=u, place=place, checkin=None, **pets.generate(place.id, 'castle', 'common', s, u.id)) for s in 'xy']
    rolls = iter([0.99, 0.1])  # neúspěch šlechtění, pak ztráta (0.1 < MERGE_LOSS)
    monkeypatch.setattr(random, 'SystemRandom', lambda: type('R', (), {'random': lambda self: next(rolls)})())
    c = APIClient()
    c.force_authenticate(u)
    r = c.post('/api/pets/merge/', {'a': pets_[0].id, 'b': pets_[1].id}).data
    assert r == {'success': False, 'lost': True, 'parents': sorted(p.id for p in pets_)}
    assert not Pet.objects.filter(owner=u).exists()
    assert c.get('/api/pets/merge/preview/', {'a': 1, 'b': 2}).status_code == 400  # už nemá co šlechtit
