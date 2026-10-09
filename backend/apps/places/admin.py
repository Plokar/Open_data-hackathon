from django.contrib import admin

from .models import Place


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'subtype', 'okres', 'rarity', 'is_hazardous', 'nearest_stop_m')
    list_filter = ('category', 'rarity', 'okres', 'is_hazardous')
    search_fields = ('name', 'obec')
