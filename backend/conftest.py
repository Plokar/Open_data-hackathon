import pytest


@pytest.fixture(autouse=True)
def _clear_cache():
    """Leaderboard a statistiky se cachují 60 s; bez čištění si testy přes cache přetékaly."""
    from django.core.cache import cache
    cache.clear()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()
