"""Koupací místa v importu a návštěvnost jako otevřená data (CSV)."""
import pytest
from django.contrib.auth.models import User

from apps.game.models import CheckIn
from apps.places import importer
from apps.places.models import Place

BATH = """objekt_id,název,specifikace_místa,popis,vybavenost,webová_stránka_KHS,název_okresu,x_zeměpisná_délka_v_souřadnicovém_systému_WGS84,y_zeměpisná_šířka_v_souřadnicovém_systému_WGS84
1,Koupaliště Rolava,Přírodní koupaliště,Popis,"WC, sprchy",http://khs.example/rolava,Karlovy Vary,12.845,50.236
"""


def test_swimming_spot_keeps_amenities_and_khs_link():
    places, _ = importer.parse_layer(importer.read_csv(BATH), 'nature', 'Koupací místa s kontrolou kvality vody', 'x', 0, 'common', False)
    assert places[0]['extra'] == {'swim': {'spec': 'Přírodní koupaliště', 'amenities': 'WC, sprchy'}}
    assert places[0]['url'] == 'http://khs.example/rolava'                     # změřená kvalita vody je jen na webu KHS


@pytest.mark.django_db
def test_stats_csv_hides_small_counts_and_demo(api_client):
    def mk(i):
        return Place.objects.create(source_item='t', source_layer=0, source_object_id=str(i), name=f'Místo {i}',
                                    category='castle', lat=50, lon=12.5, okres='Cheb')
    big, small, empty = mk(1), mk(2), mk(3)
    users = [User.objects.create_user(f'tajny_{i}', password='x') for i in range(6)]
    for u in users[:5]:
        CheckIn.objects.create(user=u, place=big, lat=50, lon=12.5, accuracy_m=5, distance_m=0)
    CheckIn.objects.create(user=users[5], place=small, lat=50, lon=12.5, accuracy_m=5, distance_m=0, forgotten=True)
    CheckIn.objects.create(user=users[5], place=empty, lat=50, lon=12.5, accuracy_m=5, distance_m=0, is_demo=True)

    r = api_client.get('/api/stats/places.csv')
    assert r.status_code == 200 and r['Content-Type'].startswith('text/csv')
    rows = r.content.decode('utf-8-sig').splitlines()
    assert rows[0].startswith('id,nazev') and len(rows) == 4
    assert [row.split(',')[7] for row in rows[1:]] == ['5', '<5', '0']         # 1 razítko skryto, demo se nepočítá
    assert 'tajny_' not in r.content.decode()
    assert api_client.get('/api/stats/places/').data['forgotten_stamps'] == 1
