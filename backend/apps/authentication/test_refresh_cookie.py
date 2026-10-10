import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_refresh_from_cookie_renews_access():
    """Access token v prod žije 15 min: frontend ho obnoví jen přes refresh cookie, bez těla požadavku."""
    User.objects.create_user('kuk', password='Heslo-123456')
    c = APIClient()
    assert c.post('/api/auth/token/', {'username': 'kuk', 'password': 'Heslo-123456'}).status_code == 200
    old = c.cookies['refresh_token'].value
    del c.cookies['access_token']
    assert c.get('/api/auth/status/').data['can_refresh'] is True
    assert APIClient().get('/api/auth/status/').data['can_refresh'] is False   # anonym refresh nezkouší
    r = c.post('/api/auth/token/refresh/')
    assert r.status_code == 200, r.content
    assert c.cookies['access_token'].value and c.cookies['refresh_token'].value != old
    assert c.get('/api/auth/status/').data['authenticated'] is True
    c.cookies['refresh_token'] = old                                    # rotace: starý refresh už neplatí
    assert c.post('/api/auth/token/refresh/').status_code == 401
