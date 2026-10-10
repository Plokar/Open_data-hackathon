"""
Stáhne místa Karlovarského kraje (DATA ZÁPAD) a Plzeňského kraje (Wikidata) a uloží je jako Place.

  python manage.py import_places                 # z API
  python manage.py import_places --from-dir DIR  # z uložených souborů <item>_<layer>.csv, wikidata.json, osm_stops.json
  python manage.py dumpdata places --indent 1 -o apps/places/fixtures/places.json   # aktualizace fixture

Opakovaný import nesmaže fotky a popisy, které do Place.extra doplnil fetch_place_photos.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.places import importer
from apps.places.geo import haversine_m
from apps.places.models import Place
from apps.places.photos import UA


class Command(BaseCommand):
    help = 'Import míst z otevřených dat Karlovarského (DATA ZÁPAD) a Plzeňského kraje (Wikidata)'

    def add_arguments(self, parser):
        parser.add_argument('--from-dir', help='Adresář s uloženými soubory místo stahování')

    def _fetch(self, url, data=None, tries=4):
        req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': 'application/json'})
        for attempt in range(tries):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    body = r.read().decode('utf-8-sig')
                # DATA ZÁPAD občas místo CSV vrátí {"status":"InProgress"}: export se teprve generuje
                if '"InProgress"' not in body[:300]:
                    return body
            except (urllib.error.URLError, TimeoutError):  # Overpass a WDQS při zátěži vrací 429/504
                if attempt == tries - 1:
                    raise
            time.sleep(10 * (attempt + 1))
        raise RuntimeError(f'zdroj stále generuje export: {url}')

    def _load(self, item, layer, from_dir):
        if from_dir:
            return importer.read_csv((Path(from_dir) / f'{item}_{layer}.csv').read_text(encoding='utf-8-sig'))
        return importer.read_csv(self._fetch(importer.CSV_URL.format(item=item, layer=layer)))

    def _load_json(self, name, from_dir, url, data=None):
        if from_dir:
            return json.loads((Path(from_dir) / name).read_text(encoding='utf-8'))
        return json.loads(self._fetch(url, data))

    def _save(self, places):
        for p in places:
            key = {k: p.pop(k) for k in ('source_item', 'source_layer', 'source_object_id')}
            old = Place.objects.filter(**key).values_list('extra', flat=True).first()
            if old:  # fotka a popis z Wikipedie zůstanou, import přepíše jen svoje klíče
                p['extra'] = {**old, **p['extra']}
            Place.objects.update_or_create(**key, defaults=p)

    def handle(self, *args, from_dir=None, **opts):
        total, failed = 0, []
        warn = lambda label, e: (failed.append(label), self.stderr.write(self.style.WARNING(f'!! PŘESKOČENO {label}: {e}')))
        with transaction.atomic():
            for category, label, item, layer, rarity, hazardous in importer.LAYERS:
                try:
                    places, skipped = importer.parse_layer(self._load(item, layer, from_dir), category, label, item, layer, rarity, hazardous)
                except Exception as e:  # jedna rozbitá vrstva nesmí shodit celý import
                    warn(label, e)
                    continue
                self._save(places)
                total += len(places)
                self.stdout.write(f'{label}: {len(places)} míst, přeskočeno řádků {skipped}')

            try:
                url = f"{importer.WIKIDATA_SPARQL}?{urllib.parse.urlencode({'query': importer.WIKIDATA_QUERY, 'format': 'json'})}"
                places, skipped = importer.parse_wikidata(self._load_json('wikidata.json', from_dir, url)['results']['bindings'])
            except Exception as e:
                warn('Plzeňský kraj (Wikidata)', e)
            else:
                self._save(places)
                total += len(places)
                self.stdout.write(f'Plzeňský kraj (Wikidata): {len(places)} míst, přeskočeno {skipped}')

            kv_stops, pk_stops = [], []
            try:
                kv_stops = importer.parse_stops(self._load(*importer.STOPS, from_dir))
            except Exception as e:
                warn('Zastávky Karlovarského kraje', e)
            try:
                body = urllib.parse.urlencode({'data': importer.OSM_STOPS_QUERY}).encode()
                pk_stops = importer.parse_osm_stops(self._load_json('osm_stops.json', from_dir, importer.OVERPASS, body))
            except Exception as e:
                warn('Zastávky Plzeňského kraje (OSM)', e)
            # Bez zastávek jednoho kraje by jeho místa dostala „nejbližší“ zastávku z druhého kraje: nechat jim staré
            stops, todo = kv_stops + pk_stops, Place.objects.all()
            if not kv_stops:
                todo = todo.filter(source_item=importer.WIKIDATA_SOURCE)
            if not pk_stops:
                todo = todo.exclude(source_item=importer.WIKIDATA_SOURCE)
            # ponytail: brute force ~1 500 míst × ~4 500 zastávek (pár sekund), PostGIS/KD-strom až při desetitisících
            for p in todo:
                d, name = min((haversine_m(p.lat, p.lon, lat, lon), n) for n, lat, lon in stops)
                p.nearest_stop_name, p.nearest_stop_m = name, round(d)
                p.save(update_fields=['nearest_stop_name', 'nearest_stop_m'])

        self.stdout.write(self.style.SUCCESS(f'Hotovo: {total} míst, {len(stops)} zastávek.'))
        if failed:
            self.stderr.write(self.style.WARNING(f'Přeskočené zdroje: {", ".join(failed)}'))
