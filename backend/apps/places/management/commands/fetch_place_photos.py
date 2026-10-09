from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.places import photos
from apps.places.models import Place


def fetch(p: Place, out: Path):
    """Síťová část (běží ve vlákně): najde a stáhne fotku. Do DB nesahá."""
    wiki, photo = photos.lookup(p.name, p.lat, p.lon, p.category)
    if photo:
        ext = '.png' if photo['thumb'].lower().endswith('.png') else '.jpg'
        photos.download(photo['thumb'], out / f'{p.id}{ext}')
        photo['url'] = f'{settings.MEDIA_URL}places/{p.id}{ext}'
    return wiki, photo


class Command(BaseCommand):
    help = 'Stáhne fotky a popisy míst z Wikipedie/Commons do MEDIA_ROOT/places a Place.extra.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Znovu i u míst, která už prošla')
        parser.add_argument('--limit', type=int, default=0)
        parser.add_argument('--category', default='')
        # ponytail: 4 souběžné dotazy jsou k API Wikimedie ještě slušné; víc jen s jejich svolením
        parser.add_argument('--workers', type=int, default=4)

    def handle(self, force, limit, category, workers, **_):
        out = Path(settings.MEDIA_ROOT) / 'places'
        out.mkdir(parents=True, exist_ok=True)
        qs = Place.objects.order_by('id')
        if category:
            qs = qs.filter(category=category)
        if not force:
            qs = qs.exclude(extra__has_key='photo_checked')
        places = list(qs[:limit] if limit else qs)

        found = 0
        with ThreadPoolExecutor(max_workers=workers) as pool:
            jobs = {pool.submit(fetch, p, out): p for p in places}
            for i, job in enumerate(as_completed(jobs), 1):
                p = jobs[job]
                try:
                    wiki, photo = job.result()
                except Exception as e:  # síť, výpadek API: místo přeskočit, příští běh ho zkusí znovu
                    self.stderr.write(f'{p.id} {p.name}: {e}')
                    continue
                extra = {k: v for k, v in p.extra.items() if k not in ('photo', 'wiki')}
                if photo:
                    extra['photo'] = photo
                    found += 1
                if wiki and wiki['extract']:
                    extra['wiki'] = {k: wiki[k] for k in ('title', 'extract', 'url')}
                extra['photo_checked'] = True
                p.extra = extra
                p.save(update_fields=['extra'])
                self.stdout.write(f"{i:4}/{len(places)} {'foto' if photo else '    '} {'popis' if wiki else '     '} {p.name}")
        self.stdout.write(self.style.SUCCESS(f'Hotovo, fotka u {found} z {len(places)} míst.'))
