from django.db import models


class Place(models.Model):
    CATEGORIES = [(c, c) for c in ('castle', 'lookout', 'spring', 'culture', 'nature', 'heritage', 'food', 'info')]
    RARITIES = [(r, r) for r in ('common', 'rare', 'epic', 'legendary')]

    source_item = models.CharField(max_length=40)
    source_layer = models.IntegerField()
    source_object_id = models.CharField(max_length=40)
    name = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=CATEGORIES, db_index=True)
    subtype = models.CharField(max_length=100, blank=True)  # název vrstvy, např. "Rozhledny"
    lat = models.FloatField()
    lon = models.FloatField()
    description = models.TextField(blank=True)
    url = models.URLField(max_length=500, blank=True)
    obec_kod = models.CharField(max_length=10, blank=True)
    obec = models.CharField(max_length=100, blank=True)
    okres = models.CharField(max_length=100, blank=True, db_index=True)
    orp = models.CharField(max_length=100, blank=True)
    rarity = models.CharField(max_length=12, choices=RARITIES, default='common')
    is_hazardous = models.BooleanField(default=False)
    nearest_stop_name = models.CharField(max_length=200, blank=True)
    nearest_stop_m = models.IntegerField(null=True, blank=True)
    license = models.CharField(max_length=50, default='CC0')
    source_url = models.URLField(max_length=500, blank=True)
    extra = models.JSONField(default=dict, blank=True)  # např. produkty u Dobrot

    class Meta:
        constraints = [models.UniqueConstraint(fields=['source_item', 'source_layer', 'source_object_id'], name='uniq_place_source')]
        indexes = [models.Index(fields=['lat', 'lon'])]
        ordering = ['name']

    def __str__(self):
        return self.name
