from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.game.models import Pet
from apps.game.views import err

from . import service
from .consumers import group
from .models import Battle


def _pet(request):
    return Pet.objects.filter(pk=request.data.get('pet_id'), owner=request.user).first()


def _created(b):
    return Response({'battle_id': str(b.id), 'status': b.status, 'mode': b.mode}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_battle(request):
    """{mode: practice|friendly|ranked, pet_id} → practice startuje hned, friendly čeká na join, ranked jde do fronty."""
    mode, pet = request.data.get('mode'), _pet(request)
    if not pet:
        return err('NO_PET', 'Vyber svého PETa.')
    try:
        if mode == 'practice':
            return _created(service.create_practice(request.user, pet))
        if mode == 'friendly':
            return _created(service.create_waiting(request.user, pet, 'friendly'))
        if mode == 'ranked':
            return _queued(service.queue(request.user, pet))
    except service.BattleError as e:
        return err(e.code, e.detail)
    return err('BAD_MODE', 'mode = practice | friendly | ranked')


def _queued(b):
    if b.status == 'active':  # soupeř nalezen → probudit čekajícího hráče přes WS
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
    get_object_or_404(Battle, pk=pk)
    try:
        return _queued(service.join(pk, request.user, pet))
    except service.BattleError as e:
        return err(e.code, e.detail)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def battle_detail(request, pk):
    b = get_object_or_404(Battle, pk=pk)
    side = service.side_of(b, request.user.id)
    data = service.view(b, side or 'a')
    data['log'] = [service.turn_result(e, side or 'a') for e in b.log]
    data['joinable'] = b.status == 'waiting' and b.mode == 'friendly' and side is None
    data['is_participant'] = side is not None
    if b.status == 'finished':
        data['result'] = service.battle_end(b, side or 'a')
    return Response(data)
