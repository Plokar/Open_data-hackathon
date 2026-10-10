import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken

from apps.game import pets
from apps.game.models import CheckIn, Pet, Profile
from apps.places.models import Place

from . import engine, service


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
        me = next(f for f in state['fighters'] if f['me'])
        move = 'heavy' if me['sp'] >= engine.MOVES['heavy']['cost'] else 'attack'  # bez výdrže server tah ignoruje
        await ws.send_json_to({'type': 'move', 'turn': state['turn'], 'move': move})
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
    battle.state['fighters']['b']['hp'] = 1
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


def test_channel_layer_outlives_blocking_read():
    # redis-py 8 má výchozí socket_timeout 5 s = BZPOPMIN timeout channels_redis → WS padaly po 5 s
    from channels_redis.core import RedisChannelLayer
    from config import settings as base
    assert base.CHANNEL_LAYERS['default']['CONFIG']['hosts'][0]['socket_timeout'] > RedisChannelLayer.brpop_timeout


def test_friends_and_direct_challenge(place):
    from rest_framework.test import APIClient
    a, pa = _player('eva', place)
    b, pb = _player('filip', place)
    c, pc = _player('gita', place)
    ca, cb = APIClient(), APIClient()
    ca.force_authenticate(a)
    cb.force_authenticate(b)
    assert ca.post('/api/battles/', {'mode': 'friendly', 'pet_id': pa.id, 'invite': 'filip'}).data['error_code'] == 'NOT_FRIEND'
    req = ca.post('/api/friends/', {'nickname': 'FILIP'}).data['outgoing'][0]
    assert cb.get('/api/users/eva/').data['friendship'] == {'id': req['id'], 'state': 'incoming'}
    assert cb.post(f'/api/friends/{req["id"]}/accept/').data['friends'][0]['nickname'] == 'eva'
    bid = ca.post('/api/battles/', {'mode': 'friendly', 'pet_id': pa.id, 'invite': 'filip'}).data['battle_id']
    assert cb.get('/api/battles/challenges/').data[0]['from'] == 'eva'
    with pytest.raises(service.BattleError):
        service.join(bid, c, pc)                                      # cizí výzvu nepřijme
    assert cb.post(f'/api/battles/{bid}/join/', {'pet_id': pb.id}).data['status'] == 'active'



def _finish_off(battle, *slots):
    """Nechá v boji naplno jen zadané sloty (ostatním 1 HP) – rychlý konec souboje v testu."""
    for slot, f in battle.state['fighters'].items():
        if slot not in slots:
            f['hp'] = 1
    battle.save()


def test_ffa_three_players_one_winner(place):
    (a, pa), (b, pb), (c, pc) = (_player(n, place) for n in ('ffa1', 'ffa2', 'ffa3'))
    battle = service.create_waiting(a, pa, 'ffa')
    battle = service.join(battle.id, b, pb)
    assert battle.status == 'waiting' and service.free_slots(battle) == ['c']
    with pytest.raises(service.BattleError):
        service.join(battle.id, b, pb)                                # dvakrát do stejného souboje nesmí
    battle = service.join(battle.id, c, pc)
    assert battle.status == 'active' and {f['team'] for f in battle.state['fighters'].values()} == {'a', 'b', 'c'}
    v = service.view(battle, 'b')
    assert v['me'] == 'b' and len(v['fighters']) == 3 and v['waiting_for_you'] and 'sp' not in v['fighters'][0]
    _finish_off(battle, 'a')
    battle.state['fighters']['a']['spd'] = 999                       # a je nejrychlejší, dorazí c dřív, než stihne útočit
    battle.save()
    assert service.submit_move(battle.id, a.id, 1, 'attack', 'c')
    assert service.submit_move(battle.id, b.id, 1, 'attack', 'a')
    battle.refresh_from_db()
    assert battle.status == 'active' and service.view(battle, 'c')['waiting_for'] == ['ffa3']
    assert service.submit_move(battle.id, c.id, 1, 'attack', 'a')
    battle.refresh_from_db()
    ev = battle.log[0]['events']
    assert next(e for e in ev if e['actor'] == 'a')['target'] == 'c'
    assert battle.state['fighters']['c']['hp'] == 0
    assert not any(e['actor'] == 'c' for e in ev)                     # padlý už neútočí


def test_team_2v2_red_wins(place):
    players = [_player(n, place) for n in ('t1', 't2', 't3', 't4')]
    battle = service.create_waiting(*players[0], 'team')
    battle = service.join(battle.id, *players[1], team='red')         # vybraný tým
    assert battle.state['fighters']['c']['team'] == 'red'
    battle = service.join(battle.id, *players[2])
    battle = service.join(battle.id, *players[3])
    assert battle.status == 'active'
    fs = battle.state['fighters']
    assert sorted(f['team'] for f in fs.values()) == ['blue', 'blue', 'red', 'red']
    v = service.view(battle, 'a')
    assert [f['ally'] for f in v['fighters']] == [True, False, True, False] and 'sp' in v['fighters'][2]
    for f in fs.values():
        if f['team'] == 'blue':
            f.update(hp=1, defense=1, spd=0)
    battle.save()
    for u, _ in players:
        service.submit_move(battle.id, u.id, 1, 'attack')
    battle.refresh_from_db()
    assert battle.status == 'finished' and battle.winner == 'red'
    red = next(s for s, f in fs.items() if f['team'] == 'red')
    end = service.battle_end(battle, red)
    assert end['winner'] == 'you' and len(end['winners']) == 2


def test_boss_needs_position_and_rewards_legendary(place):
    from django.utils import timezone
    from rest_framework.test import APIClient
    from apps.game.models import Badge, BossWin
    Badge.objects.create(code='boss_slayer', name='Přemožitel', description='', rule={'type': 'boss', 'n': 1})
    u, pet = _player('lovec', place)
    c = APIClient()
    c.force_authenticate(u)
    boss = c.get('/api/battles/bosses/').data
    assert boss[0]['place']['id'] == place.id and boss[0]['boss']['rarity'] == 'legendary'
    far = {'pet_id': pet.id, 'lat': 50.1, 'lon': 12.5, 'accuracy': 5, 'client_ts': int(timezone.now().timestamp() * 1000)}
    assert c.post(f'/api/battles/bosses/{place.id}/', far).data['error_code'] == 'TOO_FAR'
    r = c.post(f'/api/battles/bosses/{place.id}/', {**far, 'lat': 50.0005})
    assert r.status_code == 201 and r.data['mode'] == 'boss'
    battle = service.Battle.objects.get(pk=r.data['battle_id'])
    boss_f = battle.state['fighters']['b']
    assert boss_f['boss'] and boss_f['hp'] > battle.state['fighters']['a']['hp']
    boss_f.update(hp=1, defense=1, spd=0)
    battle.save()
    assert service.submit_move(battle.id, u.id, 1, 'attack')
    battle.refresh_from_db()
    assert battle.status == 'finished' and battle.winner == 'party'
    reward = service.battle_end(battle, 'a')['reward']
    assert reward['pet']['rarity'] == 'legendary' and reward['badges'][0]['code'] == 'boss_slayer'
    assert BossWin.objects.filter(user=u, won=True).count() == 1
    assert c.post(f'/api/battles/bosses/{place.id}/', {**far, 'lat': 50.0005}).data['error_code'] == 'BOSS_FOUGHT'
    assert c.get('/api/battles/bosses/').data[0]['defeated']


def test_boss_with_friends_on_site(place):
    """Hostitel otevře čekárnu, kamarád na místě se přidá, vzdálený ne; boss sílí s partou; prohra = pokus na celý týden."""
    from django.utils import timezone
    from rest_framework.test import APIClient
    from apps.game.models import BossWin
    (h, ph), (f, pf), (far_u, pfar) = (_player(n, place) for n in ('host', 'friend', 'daleko'))
    clients = {}
    for u in (h, f, far_u):
        clients[u] = APIClient()
        clients[u].force_authenticate(u)
    here = {'lat': 50.0005, 'lon': 12.5, 'accuracy': 5, 'client_ts': int(timezone.now().timestamp() * 1000)}
    solo_hp = service.Battle.objects.get(pk=clients[h].post(f'/api/battles/bosses/{place.id}/', {**here, 'pet_id': ph.id}).data['battle_id']).state['fighters']['b']['hp']
    BossWin.objects.all().delete()  # sólo pokus výš byl jen pro porovnání síly
    r = clients[h].post(f'/api/battles/bosses/{place.id}/', {**here, 'pet_id': ph.id, 'solo': False})
    bid = r.data['battle_id']
    assert r.data['status'] == 'waiting'
    detail = clients[f].get(f'/api/battles/{bid}/').data
    assert detail['joinable'] and not detail['is_host']
    assert clients[far_u].post(f'/api/battles/{bid}/join/', {**here, 'lat': 50.1, 'pet_id': pfar.id}).data['error_code'] == 'TOO_FAR'
    assert clients[f].post(f'/api/battles/{bid}/join/', {'pet_id': pf.id}).data['error_code'] == 'BAD_REQUEST'  # bez polohy ne
    assert clients[f].post(f'/api/battles/{bid}/join/', {**here, 'pet_id': pf.id}).status_code == 201
    assert clients[f].post(f'/api/battles/{bid}/start/').data['error_code'] == 'NOT_HOST'
    assert clients[h].post(f'/api/battles/{bid}/start/').status_code == 201
    battle = service.Battle.objects.get(pk=bid)
    fs = battle.state['fighters']
    assert battle.status == 'active' and sorted(fs) == ['a', 'b', 'c'] and fs['c']['team'] == 'party'
    assert fs['b']['hp'] > solo_hp                                    # boss pro dva má víc životů
    assert BossWin.objects.filter(won=False).count() == 2            # oba využili týdenní pokus
    fs['b'].update(hp=1, defense=1, spd=0)
    battle.save()
    service.submit_move(bid, h.id, 1, 'attack')
    assert service.Battle.objects.get(pk=bid).status == 'active'      # čeká se i na kamaráda
    service.submit_move(bid, f.id, 1, 'attack')
    battle.refresh_from_db()
    assert battle.status == 'finished' and battle.winner == 'party'
    assert service.battle_end(battle, 'c')['reward']['pet']['rarity'] == 'legendary'
    assert BossWin.objects.filter(won=True).count() == 2


def test_boss_lineup_swaps_and_splits_xp(place):
    """Sólo sestava 3 tvorů: padlého nahradí další, XP se dělí podle zranění, padlí se 30 min léčí."""
    from django.utils import timezone
    from rest_framework.test import APIClient
    u, p1 = _player('sestava', place)
    p2, p3 = (Pet.objects.create(owner=u, place=place, verified=True, **pets.generate(place.id, 'castle', 'rare', s, u.id)) for s in 'yz')
    c = APIClient()
    c.force_authenticate(u)
    here = {'lat': 50.0005, 'lon': 12.5, 'accuracy': 5, 'client_ts': int(timezone.now().timestamp() * 1000)}
    assert c.post(f'/api/battles/bosses/{place.id}/', {**here, 'pet_ids': [p1.id, 999999]}, format='json').data['error_code'] == 'NO_PET'  # cizí / neexistující tvor
    r = c.post(f'/api/battles/bosses/{place.id}/', {**here, 'pet_ids': [p1.id, p2.id, p3.id]}, format='json')
    battle = service.Battle.objects.get(pk=r.data['battle_id'])
    assert battle.status == 'active' and [f['pet'] for f in battle.state['reserve']['a']] == [p2.id, p3.id]
    assert service.view(battle, 'a')['reserve']['a'][0]['name'] == p2.name
    fs = battle.state['fighters']
    fs['a'].update(hp=1, defense=1, spd=999)    # první dá ránu a padne
    fs['b'].update(hp=500, max_hp=500, spd=500, defense=1000, moves=['attack'])  # boss vždy zaútočí a netrefí vedle
    battle.save()
    service.submit_move(battle.id, u.id, 1, 'attack')
    battle.refresh_from_db()
    swap = next(e for e in battle.log[0]['events'] if e['move'] == 'swap')
    assert swap['fighter']['name'] == p2.name and battle.state['fighters']['a']['pet'] == p2.id
    assert battle.state['fallen']['a'] == [p1.id] and battle.state['dmg'][str(p1.id)] >= 1
    battle.state['fighters']['b'].update(hp=1, defense=1, spd=0)   # druhý bosse dorazí
    battle.save()
    service.submit_move(battle.id, u.id, 2, 'attack')
    battle.refresh_from_db()
    assert battle.status == 'finished' and battle.winner == 'party'
    end = service.battle_end(battle, 'a')
    by_id = {x['id']: x for x in end['pets']}
    assert set(by_id) == {p1.id, p2.id}                               # třetí nebojoval
    assert sum(x['xp'] for x in end['pets']) <= service.XP['boss'][0] and all(x['xp'] > 0 for x in end['pets'])
    assert by_id[p1.id]['injured'] and not by_id[p2.id]['injured']    # padlý se léčí, vítěz ne
    assert end['player_xp'] == service.PLAYER_XP[0]
    p3.refresh_from_db()
    assert p3.xp == 0 and p3.injured_until is None


def test_loser_still_gets_player_xp(place):
    from apps.game.models import Profile
    a, pa = _player('prohra1', place)
    b, pb = _player('prohra2', place)
    battle = service.join(service.create_waiting(a, pa, 'friendly').id, b, pb)
    battle.state['fighters']['b']['hp'] = 1
    battle.save()
    service.submit_move(battle.id, a.id, 1, 'attack')
    service.submit_move(battle.id, b.id, 1, 'attack')
    battle.refresh_from_db()
    loser_slot = 'b' if battle.winner == 'a' else 'a'
    end = service.battle_end(battle, loser_slot)
    assert end['winner'] == 'opp' and end['player_xp'] == service.PLAYER_XP[1] > 0 and end['xp'] > 0
    loser = b if loser_slot == 'b' else a
    assert Profile.objects.get(user=loser).xp == service.PLAYER_XP[1]
