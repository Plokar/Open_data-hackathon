import csv

from django.core.cache import cache
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Place

GEOJSON_PROPS = ('id', 'name', 'category', 'subtype', 'rarity', 'okres', 'is_hazardous')


@api_view(['GET'])
@permission_classes([AllowAny])
def places_geojson(request):
    """Všechna místa jako GeoJSON. ETag/304 řeší ConditionalGetMiddleware."""
    category, okres = request.GET.get('category', ''), request.GET.get('okres', '')
    key = f'places_geojson:{category}:{okres}'
    data = cache.get(key)
    if data is None:
        qs = Place.objects.all()
        if category:
            qs = qs.filter(category=category)
        if okres:
            qs = qs.filter(okres=okres)
        data = {'type': 'FeatureCollection', 'features': [
            {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [p['lon'], p['lat']]},
             'properties': {k: p[k] for k in GEOJSON_PROPS}}
            for p in qs.values('lat', 'lon', *GEOJSON_PROPS)
        ]}
        cache.set(key, data, 600)
    resp = Response(data)
    resp['Cache-Control'] = 'public, max-age=300'
    return resp


@api_view(['GET'])
@permission_classes([AllowAny])
def place_detail(request, pk):
    p = get_object_or_404(Place, pk=pk)
    data = {f.name: getattr(p, f.name) for f in Place._meta.fields}
    mine = request.user.is_authenticated and p.pets.filter(owner=request.user).first()
    data['stamped'] = bool(mine)
    data['my_pet'] = mine and {'id': mine.id, 'name': mine.name, 'type': mine.type, 'seed': mine.seed,
                               'stage': mine.stage, 'rarity': mine.rarity, 'level': mine.level}
    # Detail místa počítá i demo razítka (jinak po demo claimu svítí „nikdo tu nebyl“); žebříčky a statistiky kraje dál ne.
    data['stamp_count'] = p.checkins.count()
    data['forgotten'] = p.is_forgotten  # bonus XP za málo navštěvované místo
    if p.category == 'food':  # Dobrotový pas: druhy Dobrot tohoto výrobce a které hráč už ochutnal jinde
        from apps.game import quests
        tasted = {k['name'] for k in quests.food_pass(request.user) if k['tasted']}
        data['food_kinds'] = [{'name': c, 'tasted': c in tasted} for c in sorted(quests.food_categories(p))]
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def place_stats(request):
    """Anonymní agregace návštěvnosti pro kraj (PROJECT_SPEC 6.4). Žádná identita hráčů, bez demo razítek."""
    data = cache.get('place_stats')
    if data is None:
        real = Q(checkins__is_demo=False)
        qs = Place.objects.annotate(stamps=Count('checkins', filter=real))
        row = lambda p: {'id': p.id, 'name': p.name, 'category': p.category, 'okres': p.okres, 'stamps': p.stamps}
        group = lambda field: [
            {field: r[field], 'stamps': r['stamps'], 'places': r['places']}
            for r in Place.objects.exclude(**{field: ''}).values(field)
            .annotate(stamps=Count('checkins', filter=real), places=Count('id', distinct=True)).order_by('-stamps', field)
        ]
        totals = Place.objects.aggregate(stamps=Count('checkins', filter=real),
                                         players=Count('checkins__user', filter=real, distinct=True),
                                         forgotten=Count('checkins', filter=real & Q(checkins__forgotten=True)))
        data = {
            'total_stamps': totals['stamps'], 'total_players': totals['players'],
            # kolik razítek zamířilo na málo navštěvovaná místa (měřítko rozložení turismu po kraji)
            'forgotten_stamps': totals['forgotten'],
            'top': [row(p) for p in qs.filter(stamps__gt=0).order_by('-stamps', 'name')[:10]],
            # nejméně navštěvovaná = tipy, kam vyrazit (rozložení turismu mimo centra)
            'least': [row(p) for p in qs.filter(is_hazardous=False).order_by('stamps', '?')[:10]],
            'visited': [{'id': p.id, 'lat': p.lat, 'lon': p.lon, 'category': p.category, 'name': p.name, 'stamps': p.stamps}
                        for p in qs.filter(stamps__gt=0)],
            'by_okres': group('okres'),
            'by_category': group('category'),
        }
        cache.set('place_stats', data, 60)
    return Response(data)


CSV_MIN_COUNT = 5  # menší počty se v CSV neuvádějí, aby výstup byl agregát a ne stopa jednotlivce


@api_view(['GET'])
@permission_classes([AllowAny])
def place_stats_csv(request):
    """Otevřená data zpět: návštěvnost míst jako CSV pod CC0 (PROJECT_SPEC 6.4). Bez identity hráčů a bez demo razítek."""
    resp = HttpResponse(content_type='text/csv; charset=utf-8')
    resp['Content-Disposition'] = 'attachment; filename="zapad-go-navstevnost.csv"'
    resp.write('﻿')  # BOM, ať CSV v Excelu drží diakritiku
    w = csv.writer(resp)
    w.writerow(['id', 'nazev', 'kategorie', 'okres', 'obec', 'lat', 'lon', 'razitek', 'licence'])
    qs = Place.objects.annotate(stamps=Count('checkins', filter=Q(checkins__is_demo=False))).order_by('id')
    for p in qs:
        shown = p.stamps if p.stamps >= CSV_MIN_COUNT or p.stamps == 0 else f'<{CSV_MIN_COUNT}'
        w.writerow([p.id, p.name, p.category, p.okres, p.obec, p.lat, p.lon, shown, 'CC0'])
    return resp
