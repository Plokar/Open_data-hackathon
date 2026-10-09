from django.contrib import admin

from .models import Badge, CheckIn, Pet, Profile, UserBadge

admin.site.register(Profile, list_display=('nickname', 'user', 'level', 'xp', 'school', 'age_group'))
admin.site.register(CheckIn, list_display=('user', 'place', 'distance_m', 'trust', 'verified', 'is_demo', 'created_at'))
admin.site.register(Pet, list_display=('name', 'species', 'type', 'rarity', 'owner', 'verified'))
admin.site.register(Badge, list_display=('code', 'name', 'icon'))
admin.site.register(UserBadge)
