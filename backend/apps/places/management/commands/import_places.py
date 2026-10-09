"""
Stáhne vrstvy z DATA ZÁPAD a uloží je jako Place.

  python manage.py import_places                 # z API
  python manage.py import_places --from-dir DIR  # z uložených CSV <item>_<layer>.csv
  python manage.py dumpdata places --indent 1 -o apps/places/fixtures/places.json   # aktualizace fixture
"""
import urllib.request
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.places import importer
from apps.places.geo import haversine_m
from apps.places.models import Place


class Command(BaseCommand):
    help = 'Import míst z otevřených dat Karlovarského kraje (DATA ZÁPAD)'

    def add_arguments(self, parser):
        parser.add_argument('--from-dir', help='Adresář s CSV soubory <item>_<layer>.csv místo stahování')

    def _load(self, item, layer, from_dir):
        if from_dir:
            return importer.read_csv((Path(from_dir) / f'{item}_{layer}.csv').read_text(encoding='utf-8-sig'))
        url = importer.CSV_URL.format(item=item, layer=layer)
        with urllib.request.urlopen(url, timeout=120) as r:
            return importer.read_csv(r.read().decode('utf-8-sig'))

    def handle(self, *args, from_dir=None, **opts):
        total, failed = 0, []
        with transaction.atomic():
            for category, label, item, layer, rarity, hazardous in importer.LAYERS:
                try:
                    places, skipped = importer.parse_layer(self._load(item, layer, from_dir), category, label, item, layer, rarity, hazardous)
                except Exception as e:  # jedna rozbitá vrstva nesmí shodit celý import
                    failed.append(label)
                    self.stderr.write(self.style.WARNING(f'!! PŘESKOČENO {label}: {e}'))
                    continue
                for p in places:
                    key = {k: p.pop(k) for k in ('source_item', 'source_layer', 'source_object_id')}
                    Place.objects.update_or_create(**key, defaults=p)
                total += len(places)
                self.stdout.write(f'{label}: {len(places)} míst, přeskočeno řádků {skipped}')

            stops = importer.parse_stops(self._load(*importer.STOPS, from_dir))
            # ponytail: brute force ~600 × 1840, PostGIS/KD-strom až při desetitisících bodů
            for p in Place.objects.all():
                d, name = min((haversine_m(p.lat, p.lon, lat, lon), n) for n, lat, lon in stops)
                p.nearest_stop_name, p.nearest_stop_m = name, round(d)
                p.save(update_fields=['nearest_stop_name', 'nearest_stop_m'])

        self.stdout.write(self.style.SUCCESS(f'Hotovo: {total} míst, {len(stops)} zastávek.'))
        if failed:
            self.stderr.write(self.style.WARNING(f'Přeskočené vrstvy: {", ".join(failed)}'))
