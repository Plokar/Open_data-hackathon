from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from datetime import timedelta

from django.utils import timezone

from apps.game.models import Pet, Profile
from apps.game.views import are_friends, err, profile_of

from . import bosses, service
from .consumers import group
from .models import Battle


def _pet(request):
    return Pet.objects.filter(pk=request.data.get('pet_id'), owner=request.user).first()


def _created(b):
    return Response({'battle_id': str(b.id), 'status': b.status, 'mode': b.mode}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_battle(request):
    """{mode: practice|friendly|ranked|ffa|team, pet_id} → practice startuje hned, friendly/ffa/team čekají
    na spoluhráče (odkaz/QR), ranked jde do fronty."""
    mode, pet = request.data.get('mode'), _pet(request)
    if not pet:
        return err('NO_PET', 'Vyber svého PETa.')
    try:
        if mode == 'practice':
            return _created(service.create_practice(request.user, pet))
        if mode == 'friendly':
            invited = None
            if request.data.get('invite'):
                friend = Profile.objects.filter(nickname=str(request.data['invite'])).select_related('user').first()
                if not friend or not are_friends(request.user, friend.user):
                    return err('NOT_FRIEND', 'Vyzvat napřímo můžeš jen své přátele.')
                invited = friend.user
            return _created(service.create_waiting(request.user, pet, 'friendly', invited))
        if mode == 'ranked':
            return _queued(service.queue(request.user, pet))
        if mode in ('ffa', 'team'):
            return _created(service.create_waiting(request.user, pet, mode))
    except service.BattleError as e:
        return err(e.code, e.detail)
    return err('BAD_MODE', 'mode = practice | friendly | ranked | ffa | team')


def _queued(b):
    # soupeř nalezen / někdo přibyl do čekárny skupinového souboje → probudit čekající přes WS
    if b.status == 'active' or service.SIZE[b.mode] > 2:
        async_to_sync(get_channel_layer().group_send)(group(b.id), {'type': 'battle.update'})
    return _created(b)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def queue_battle(request):
    pet = _pet(request)
    if not pet:
        return err('NO_PET', 'Vyber svého PETa.')
    try:
        return _queued(service.queue(request.user, pet))
    except service.BattleError as e:
        return err(e.code, e.detail)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_battle(request, pk):
    pet = _pet(request)
    if not pet:
        return err('NO_PET', 'Vyber svého PETa.')
    b = get_object_or_404(Battle, pk=pk)
    if b.mode == 'boss':  # kamarád se přidá jen na místě a jen když s bosem tento týden ještě nebojoval
        from apps.places.models import Place
        error = _boss_position_error(request, Place.objects.get(pk=b.state['boss']['place']))
        if error:
            return error
    try:
        return _queued(service.join(pk, request.user, pet, request.data.get('team') or None))
    except service.BattleError as e:
        return err(e.code, e.detail)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def battle_detail(request, pk):
    b = get_object_or_404(Battle, pk=pk)
    side = service.side_of(b, request.user.id)
    data = service.view(b, side)
    data['log'] = [service.turn_result(e) for e in b.log]
    data['joinable'] = (b.status == 'waiting' and side is None and bool(service.free_slots(b))
                        and b.mode in ('friendly', 'ffa', 'team', 'boss') and b.invited_id in (None, request.user.id))
    data['is_host'] = b.player_a_id == request.user.id
    data['free_teams'] = sorted({service.team_of(b.mode, s) for s in service.free_slots(b)}) if b.mode == 'team' else []
    data['challenger'] = profile_of(b.player_a).nickname
    data['invited'] = b.invited and profile_of(b.invited).nickname
    data['is_participant'] = side is not None
    if b.status == 'finished':
        data['result'] = service.battle_end(b, side)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def challenges(request):
    """Výzvy od přátel, které na mě čekají (posledních 30 min)."""
    qs = (Battle.objects.filter(invited=request.user, status='waiting', created_at__gte=timezone.now() - timedelta(minutes=30))
          .select_related('player_a', 'pet_a'))
    return Response([{'battle_id': str(b.id), 'from': profile_of(b.player_a).nickname, 'created_at': b.created_at,
                      'pet': b.pet_a and {'name': b.pet_a.name, 'type': b.pet_a.type, 'seed': b.pet_a.seed,
                                          'stage': b.pet_a.stage, 'rarity': b.pet_a.rarity, 'level': b.pet_a.level}}
                     for b in qs])


def _boss_json(place, spec, user, week):
    from apps.game.models import BossWin
    mine = BossWin.objects.filter(user=user, place=place, week=week).first() if user.is_authenticated else None
    return {'place': {'id': place.id, 'name': place.name, 'lat': place.lat, 'lon': place.lon, 'category': place.category},
            'boss': {'name': spec['name'], 'species': spec['species'], 'title': spec['title'], 'type': spec['type'],
                     'seed': spec['seed'], 'rarity': 'legendary', 'stage': 3},
            'fought': bool(mine), 'defeated': bool(mine and mine.won),
            'until': (week + timedelta(days=6)).isoformat()}


@api_view(['GET'])
@permission_classes([AllowAny])
def boss_list(request):
    """Bosové tohoto týdne na mapě (každý týden jinde)."""
    week = bosses.week_start()
    return Response([_boss_json(p, s, request.user, week) for p, s in bosses.of_week(week)])


def _boss_position_error(request, place):
    """Hráč musí být u bosse (do 300 m) a s tímhle bosem tento týden ještě nebojovat. Vrací chybovou odpověď nebo None."""
    from django.conf import settings
    from apps.game import anticheat
    from apps.game.views import _parse_ts
    d = request.data
    demo = str(d.get('demo', '')).lower() in ('1', 'true')
    if demo and not (settings.DEMO_MODE and request.user.is_staff):
        return err('DEMO_FORBIDDEN', 'Demo výzva není povolena.', 403)
    try:
        lat, lon, accuracy = float(d['lat']), float(d['lon']), float(d.get('accuracy', 9999))
        client_ts = _parse_ts(d['client_ts'])
    except (KeyError, ValueError, TypeError, OverflowError):
        return err('BAD_REQUEST', 'Na bosse musíš být na místě: chybí poloha nebo čas.')
    try:
        anticheat.check_position(place, lat, lon, accuracy, client_ts, timezone.now(), None, settings.CHECKIN_RADIUS_M, demo)
    except anticheat.Reject as r:
        return err(r.code, r.detail, r.status, **r.extra)
    if bosses.fought(request.user, place, bosses.week_start()):
        return err('BOSS_FOUGHT', 'S tímhle bosem jsi tento týden už bojoval. Příští týden se objeví jinde.', 409)
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def boss_challenge(request, place_id):
    """{pet_ids: [1–3] (nebo pet_id), lat, lon, accuracy, client_ts, solo?, demo?} → souboj s bosem; jako u razítka
    musíš být do 300 m. Sólo se sestavou až 3 tvorů, solo=false otevře čekárnu pro kamarády (s jedním tvorem)."""
    place, spec = bosses.active_at(int(place_id))
    if not place:
        return err('NO_BOSS', 'Tady tento týden žádný boss není.', 404)
    try:
        ids = [int(x) for x in (request.data.get('pet_ids') or [request.data.get('pet_id')])]
    except (TypeError, ValueError):
        return err('NO_PET', 'Vyber svého PETa.')
    owned = Pet.objects.in_bulk(ids, field_name='pk')
    lineup = [owned[i] for i in dict.fromkeys(ids) if i in owned and owned[i].owner_id == request.user.id]
    if not lineup or len(lineup) != len(set(ids)) or len(lineup) > bosses.MAX_LINEUP:
        return err('NO_PET', f'Vyber 1 až {bosses.MAX_LINEUP} své různé tvory.')
    error = _boss_position_error(request, place)
    if error:
        return error
    solo = str(request.data.get('solo', 'true')).lower() in ('1', 'true')
    try:
        return _created(service.create_boss(request.user, lineup, place, spec, bosses.week_start(), solo))
    except service.BattleError as e:
        return err(e.code, e.detail)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_battle(request, pk):
    """Hostitel spustí souboj s bosem (sám nebo s kamarády, kteří se mezitím přidali)."""
    get_object_or_404(Battle, pk=pk)
    try:
        b = service.start_boss(pk, request.user)
    except service.BattleError as e:
        return err(e.code, e.detail)
    async_to_sync(get_channel_layer().group_send)(group(b.id), {'type': 'battle.update'})
    return _created(b)
