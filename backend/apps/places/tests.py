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


def _wd(qid, label, typ, coord='Point(13.3 49.6)', **kw):
    b = {'item': f'http://www.wikidata.org/entity/{qid}', 'itemLabel': label, 'type': f'http://www.wikidata.org/entity/{typ}',
         'coord': coord, 'okresLabel': 'okres Plzeň-jih', 'obecLabel': 'Nebílovy', **kw}
    return {k: {'value': v} for k, v in b.items()}


def test_wikidata_plzen_dedupes_types_and_maps_rarity():
    rows = [
        _wd('Q1', 'Zámek Nebílovy', 'Q33506'),                                    # muzeum…
        _wd('Q1', 'Zámek Nebílovy', 'Q751876', nkp='1',                           # …i zámek: vyhraje zámek
            img='http://commons.wikimedia.org/wiki/Special:FilePath/Neb%C3%ADlovy%20z%C3%A1mek.jpg'),
        _wd('Q2', 'Q2', 'Q16970'),                                                # bez názvu
        _wd('Q3', 'Hradiště Věžka', 'Q744099', coord='Point(16.6 49.2)'),          # mimo kraj
        _wd('Q4', 'hradiště Hradec', 'Q744099'),
        _wd('Q5', 'Kostel svatého Mikuláše', 'Q16970', obecLabel='Čečovice'),
        _wd('Q6', 'Kostel svatého Mikuláše', 'Q16970', obecLabel='Kašperské Hory'),
    ]
    places, skipped = importer.parse_wikidata(rows)
    assert skipped == 2
    zamek, hradiste, *kostely = sorted(places, key=lambda p: p['source_object_id'])
    assert hradiste['name'] == 'Hradiště Hradec'
    assert [k['name'] for k in kostely] == ['Kostel svatého Mikuláše (Čečovice)', 'Kostel svatého Mikuláše (Kašperské Hory)']
    assert (zamek['category'], zamek['subtype'], zamek['rarity'], zamek['okres']) == ('castle', 'Zámky', 'epic', 'Plzeň-jih')
    assert zamek['extra'] == {'commons': 'Nebílovy zámek.jpg'} and zamek['source_object_id'] == 'Q1'
    assert (hradiste['category'], hradiste['rarity'], hradiste['is_hazardous']) == ('heritage', 'common', True)


def test_osm_stops_merge_both_directions():
    data = {'elements': [{'lat': 49.74751, 'lon': 13.37761, 'tags': {'name': 'Plzeň, Hlavní nádraží'}},
                         {'lat': 49.74760, 'lon': 13.37770, 'tags': {'name': 'Plzeň, Hlavní nádraží'}},
                         {'lat': 49.7, 'lon': 13.3, 'tags': {}}]}
    assert importer.parse_osm_stops(data) == [('Plzeň, Hlavní nádraží', 49.74751, 13.37761)]


@pytest.mark.django_db
def test_reimport_keeps_fetched_photo():
    from apps.places.management.commands.import_places import Command
    from apps.places.models import Place
    places, _ = importer.parse_wikidata([_wd('Q4', 'Hradiště Hradec', 'Q744099')])
    Command()._save([dict(p) for p in places])
    Place.objects.update(extra={'photo': {'url': '/media/places/1.jpg'}, 'photo_checked': True})
    Command()._save([{**p, 'name': 'Hradiště Hradec u Plzně'} for p in places])
    p = Place.objects.get()
    assert p.name == 'Hradiště Hradec u Plzně' and p.extra['photo_checked'] and 'photo' in p.extra


def test_duplicate_xy_columns_take_wgs84():
    # Aquaparky: x,y nejdřív ve WGS84, pak znovu v Web Mercatoru
    rows = importer.read_csv('objekt_id,název,název_okresu,x,y,x,y\n1,Aquaforum,Cheb,12.35,50.12,1374736.1,6458321.4\n')
    places, skipped = importer.parse_layer(rows, 'nature', 'Aquaparky, koupaliště a bazény', 'x', 0, 'common', False)
    assert skipped == 0 and (places[0]['lon'], places[0]['lat']) == (12.35, 50.12)


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
