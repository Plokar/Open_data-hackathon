"""
Django ASGI configuration for WebSocket + HTTP routing.
Hackathon Web Template – supports both HTTP and WebSocket connections.
"""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI application early to populate AppRegistry
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings
from apps.ws.middleware import JWTAuthMiddlewareStack
from apps.ws import routing as ws_routing

application = ProtocolTypeRouter({
    # HTTP requests → standard Django ASGI handler
    "http": django_asgi_app,

    # WebSocket requests → channels URL router
    # Frontend běží na jiné subdoméně (www.*) než API → povolit i CORS originy.
    "websocket": OriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(
                ws_routing.websocket_urlpatterns
            )
        ),
        [*settings.ALLOWED_HOSTS, *settings.CORS_ALLOWED_ORIGINS],
    ),
})
