from django.contrib import admin

from .models import Battle

admin.site.register(Battle, list_display=('id', 'mode', 'status', 'player_a', 'player_b', 'winner', 'created_at'))
