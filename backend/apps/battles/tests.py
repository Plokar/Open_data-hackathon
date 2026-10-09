import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken

from apps.game import pets
from apps.game.models import CheckIn, Pet, Profile
from apps.places.models import Place

from . import service


def _player(name, place):
    u = User.objects.create_user(name, password='x')
    Profile.objects.create(user=u, nickname=name)
    ci = CheckIn.objects.create(user=u, place=place, lat=0, lon=0, accuracy_m=5, distance_m=0, verified=True)
    pet = Pet.objects.create(owner=u, place=place, checkin=ci, verified=True, **pets.generate(place.id, 'castle', 'rare', name, u.id))
    return u, pet


@pytest.fixture
def place(db):
    return Place.objects.create(source_item='t', source_layer=0, source_object_id='1', name='Hrad', category='castle', lat=50, lon=12.5)


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_practice_over_websocket(place):
    from config.asgi import application
    u, pet = await database_sync_to_async(_player)('hrac', place)
    b = await database_sync_to_async(service.create_practice)(u, pet)
    ws = WebsocketCommunicator(application, f'/ws/battle/{b.id}/?token={AccessToken.for_user(u)}',
                               headers=[(b'origin', b'http://localhost:3000')])
    assert (await ws.connect())[0]
    state = await ws.receive_json_from()
    assert state['type'] == 'state' and state['turn'] == 1 and state['is_bot']
    end = None
    while not end:
        await ws.send_json_to({'type': 'move', 'turn': state['turn'], 'move': 'heavy'})
        while True:
            msg = await ws.receive_json_from(timeout=5)
            if msg['type'] == 'battle_end':
                end = msg
                break
            if msg['type'] == 'state':
                state = msg
                if state['status'] == 'finished':
                    continue
                break
    assert end['winner'] in ('you', 'opp', 'draw') and end['xp'] > 0
    await ws.disconnect()


def test_friendly_join_and_ranked_rules(place):
    a, pa = _player('anna', place)
    b, pb = _player('bob', place)
    battle = service.create_waiting(a, pa, 'friendly')
    battle = service.join(battle.id, b, pb)
    assert battle.status == 'active'
    assert service.submit_move(battle.id, a.id, 1, 'attack')
    assert not service.submit_move(battle.id, a.id, 1, 'heavy')      # duplicitní tah se ignoruje
    assert service.submit_move(battle.id, b.id, 1, 'guard')
    battle.refresh_from_db()
    assert battle.state['turn'] == 2 and len(battle.log) == 1

    pb.verified = False
    pb.save()
    with pytest.raises(service.BattleError):
        service.queue(b, pb)                                          # neověřený PET do ranked nesmí


def test_loser_gets_injured(place):
    from django.utils import timezone
    a, pa = _player('cyril', place)
    b, pb = _player('dana', place)
    battle = service.join(service.create_waiting(a, pa, 'friendly').id, b, pb)
    battle.state['b']['hp'] = 1
    battle.save()
    assert service.submit_move(battle.id, a.id, 1, 'attack') and service.submit_move(battle.id, b.id, 1, 'attack')
    battle.refresh_from_db()
    assert battle.status == 'finished'
    loser = pb if battle.winner == 'a' else pa
    loser.refresh_from_db()
    assert loser.injured_until > timezone.now()
    with pytest.raises(service.BattleError) as e:
        service.create_practice(loser.owner, loser)
    assert e.value.code == 'PET_INJURED'
    assert not service.submit_move(battle.id, a.id, 2, 'attack')     # po konci už nic
