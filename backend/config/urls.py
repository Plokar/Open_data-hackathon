from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['GET'])
def api_root(request):
    """Root API endpoint s informacemi o dostupných endpointech"""
    return Response({
        "message": "Vítejte v API",
        "version": "1.0.0",
        "endpoints": {
            "authentication": {
                "register": "/api/auth/register/",
                "login": "/api/auth/login/",
                "logout": "/api/auth/logout/",
                "profile": "/api/auth/profile/",
                "change_password": "/api/auth/change-password/",
                "status": "/api/auth/status/"
            },
            "items": "/api/items/",
            "admin": "/admin/"
        }
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api_root, name='api-root'),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/items/', include('apps.items.urls')),
]
