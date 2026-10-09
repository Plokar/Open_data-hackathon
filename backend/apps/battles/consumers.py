"""WebSocket souboje: /ws/battle/<id>/ (protokol PROJECT_SPEC 10). Server je jediný zdroj stavu."""
import asyncio
from datetime import datetime

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from . import service
from .models import Battle

GRACE_S = 20


def group(battle_id):
    return f'battle_{battle_id}'


class BattleConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        self.battle_id = self.scope['url_route']['kwargs']['battle_id']
        self.timer = None
        self.sent_turns = 0
        b = await self._load()
        self.side = b and user.is_authenticated and service.side_of(b, user.id)
        if not self.side:
            await self.close(code=4403)
            return
        await self.channel_layer.group_add(group(self.battle_id), self.channel_name)
        await self.accept()
        self.sent_turns = len(b.log)  # po reconnectu jen aktuální stav, ne staré tahy
        await self._push(b)

    async def disconnect(self, code):
        if getattr(self, 'side', None):
            if self.timer:
                self.timer.cancel()
            await self.channel_layer.group_send(group(self.battle_id), {'type': 'battle.left', 'side': self.side})
            await self.channel_layer.group_discard(group(self.battle_id), self.channel_name)

    async def receive_json(self, content):
        kind = content.get('type')
        if kind == 'ready':
            await self._push(await self._load())
        elif kind == 'move':
            ok = await database_sync_to_async(service.submit_move)(
                self.battle_id, self.scope['user'].id, content.get('turn'), content.get('move'))
            if ok:
                await self.channel_layer.group_send(group(self.battle_id), {'type': 'battle.update'})

    async def battle_update(self, event):
        await self._push(await self._load())

    async def battle_left(self, event):
        if event['side'] != self.side:
            await self.send_json({'type': 'opponent_disconnected', 'grace_s': GRACE_S})

    @database_sync_to_async
    def _load(self):
        return Battle.objects.filter(pk=self.battle_id).select_related('player_a', 'player_b').first()

    async def _push(self, b):
        for entry in b.log[self.sent_turns:]:
            await self.send_json(service.turn_result(entry, self.side))
        self.sent_turns = len(b.log)
        await self.send_json(service.view(b, self.side))
        if b.status == 'finished':
            await self.send_json(service.battle_end(b, self.side))
        elif b.status == 'active':
            self._arm_timer(b.state['turn'], b.state['deadline'])

    def _arm_timer(self, turn, deadline):
        """Po vypršení tahu doplní server Útok za hráče, který nehrál (i za odpojeného)."""
        if self.timer:
            self.timer.cancel()

        async def fire():
            await asyncio.sleep(max(0, (datetime.fromisoformat(deadline) - timezone.now()).total_seconds()) + 0.3)
            if await database_sync_to_async(service.timeout)(self.battle_id, turn):
                await self.channel_layer.group_send(group(self.battle_id), {'type': 'battle.update'})

        self.timer = asyncio.ensure_future(fire())
