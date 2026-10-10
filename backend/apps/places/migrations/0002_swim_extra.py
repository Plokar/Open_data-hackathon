import json
from pathlib import Path

from django.db import migrations

FIXTURE = Path(__file__).resolve().parent.parent / 'fixtures' / 'places.json'


def add_swim(apps, schema_editor):
    """Koupací místa dostala v `extra` druh a vybavení. Do už naplněné DB se doplní sloučením,
    protože `loaddata places` by přepsal `extra` a smazal fotky z fetch_place_photos."""
    if not FIXTURE.exists():
        return
    Place = apps.get_model('places', 'Place')
    for row in json.loads(FIXTURE.read_text(encoding='utf-8')):
        f = row['fields']
        if 'swim' not in f['extra']:
            continue
        for p in Place.objects.filter(source_item=f['source_item'], source_layer=f['source_layer'],
                                      source_object_id=f['source_object_id']):
            p.extra = {**p.extra, 'swim': f['extra']['swim']}
            p.save(update_fields=['extra'])


class Migration(migrations.Migration):

    dependencies = [('places', '0001_initial')]

    operations = [migrations.RunPython(add_swim, migrations.RunPython.noop)]
