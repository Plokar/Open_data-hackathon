"""WebSocket URL routing"""
from django.urls import re_path
from . import consumers
from apps.battles.consumers import BattleConsumer

websocket_urlpatterns = [
    re_path(r'^ws/echo/$', consumers.EchoConsumer.as_asgi()),
    re_path(r'^ws/room/(?P<room_name>[a-zA-Z0-9_-]+)/$', consumers.RoomConsumer.as_asgi()),
    re_path(r'^ws/battle/(?P<battle_id>[0-9a-f-]{36})/$', BattleConsumer.as_asgi()),
]
