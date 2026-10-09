import pytest

from apps.places import importer

CSV = """﻿objekt_id,název,popis,název_okresu,kód_obce,zeměpisná_délka_v_souřadnicovém_systému_WGS84,zeměpisná_šířka_v_souřadnicovém_systému_WGS84
1,Klínovec,<p>Nejvyšší <b>hora</b></p>,Karlovy Vary,555215,12.967892,50.395943
2,Mimo kraj,,Praha,1,14.42,50.08
3,Bez souřadnic,,Cheb,2,,
"""

FOOD = """objekt_ID,název,kategorie,rok_soutěže,výrobce,x_zeměpisná_délka_v_souřadnicovém_systému_WGS84,y_zeměpisná_šířka_v_souřadnicovém_systému_WGS84
1,Paštika,Masné,2017,Statek Bor,12.94,50.26
2,Klobása,Masné,2018,Statek Bor,12.94,50.26
"""


def test_parse_layer_filters_and_cleans():
    places, skipped = importer.parse_layer(importer.read_csv(CSV), 'lookout', 'Rozhledny', 'x', 0, 'rare', False)
    assert skipped == 2
    assert len(places) == 1
    p = places[0]
    assert (p['name'], p['okres'], p['obec_kod'], p['source_object_id']) == ('Klínovec', 'Karlovy Vary', '555215', '1')
    assert p['description'] == 'Nejvyšší hora'
    assert 50.39 < p['lat'] < 50.4 and 12.96 < p['lon'] < 12.97


def test_food_grouped_by_producer():
    places, _ = importer.parse_layer(importer.read_csv(FOOD), 'food', 'Dobroty', 'x', 3, 'common', False)
    assert len(places) == 1
    assert places[0]['name'] == 'Statek Bor'
    assert [x['name'] for x in places[0]['extra']['products']] == ['Paštika', 'Klobása']


def test_layer_without_coordinates_raises():
    with pytest.raises(ValueError):
        importer.parse_layer(importer.read_csv('název,x2,y2\nA,1,2\n'), 'nature', 'Aquaparky', 'x', 0, 'common', False)


@pytest.mark.django_db
def test_stats_are_anonymous_and_skip_demo(api_client):
    from django.contrib.auth.models import User
    from apps.game.models import CheckIn
    from apps.places.models import Place
    p = Place.objects.create(source_item='t', source_layer=0, source_object_id='1', name='Hrad', category='castle', lat=50, lon=12.5, okres='Cheb')
    for i, demo in enumerate([False, True]):
        u = User.objects.create_user(f'tajny_hrac_{i}', password='x')
        CheckIn.objects.create(user=u, place=p, lat=50, lon=12.5, accuracy_m=5, distance_m=0, is_demo=demo)
    r = api_client.get('/api/stats/places/')
    assert r.status_code == 200
    assert r.data['total_stamps'] == 1 and r.data['total_players'] == 1
    assert r.data['top'][0]['stamps'] == 1
    assert r.data['by_okres'] == [{'okres': 'Cheb', 'stamps': 1, 'places': 1}]
    assert 'tajny_hrac' not in str(r.content)


def test_photo_name_matching():
    from apps.places.photos import name_score
    assert name_score('Hrad Cheb', 'Cheb (hrad)') > 1
    assert name_score('Rozhledna Háj', 'Háj (rozhledna, Aš)') > 1
    assert name_score('Hrad Cheb', 'Kostel svatého Jana (Cheb)') < 0.5
    assert name_score('Hrad Cheb', 'Cheb') < name_score('Hrad Cheb', 'Cheb (hrad)')  # hrad má přednost před městem
    assert name_score('Hrad Seeberg (Ostroh)', 'Seeberg') >= 0.5
    assert name_score('Zřícenina hradu Kynžvart', 'Kynžvart (hrad)') > 1
    assert name_score('Krásno', 'Krásno (okres Sokolov)') == 1
    assert name_score('Kostel svatého Mikuláše', 'Kostel svatého Jana (Cheb)') < 0.5  # obecná slova nestačí
    assert name_score('Alena Králová', 'Stružná') == 0
