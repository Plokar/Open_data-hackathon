"""Normalizace CSV vrstev z DATA ZÁPAD na slovníky pro model Place. Čistý Python, bez DB."""
import csv
import io
import re

from django.utils.html import strip_tags

CSV_URL = 'https://www.datazapad.cz/api/download/v1/items/{item}/csv?layers={layer}'
BBOX = {'lon': (12.0, 13.5), 'lat': (49.9, 50.5)}

# (kategorie, název vrstvy, item, layer, rarita, nebezpečné) – PROJECT_SPEC 5.1, 7.2, 12.5
LAYERS = [
    ('castle', 'Hrady a zříceniny', 'c3a42c283f0649248326a0bbd7dc5cc3', 0, 'rare', False),
    ('castle', 'Zámky', '464108d64a93430083119bfb0845af3c', 3, 'rare', False),
    ('lookout', 'Rozhledny', '2fe4d27ac10341f6bd2b4ea6380a2599', 0, 'rare', False),
    ('spring', 'Přístupné prameny', '92327bf761e14d3c8cd169b7d65fa418', 3, 'common', False),
    ('culture', 'Památky UNESCO', '135900efd11e4df1865987b57428eb9f', 3, 'legendary', False),
    ('culture', 'Národní kulturní památky', 'c0ae279455b34b5fb4a929ef98675a5b', 3, 'epic', False),
    ('culture', 'Muzea a galerie', '5aa3b9fe8da6474786ff2b9c81b006cb', 0, 'common', False),
    ('culture', 'Muzea v přírodě a skanzeny', '6be3423787fd4c1fa19a70b025e2eb64', 3, 'common', False),
    ('culture', 'Divadla', '805a0267da9e45eea0c20a2e3123189f', 3, 'common', False),
    ('culture', 'Náboženské památky', '2c9bd5558c4a495c8424a84bc6b370e2', 3, 'common', False),
    ('culture', 'Vojenské a pietní památky', '142875a7b4ba49769393c8a3b80cca6d', 3, 'common', False),
    ('nature', 'Přírodní pozoruhodnosti', '037f7b55d2d34fa88fd63bf2d2903839', 3, 'common', False),
    ('nature', 'Botanické zahrady a arboreta', '8ae1f28fc17f4918a0dba74bb11797ff', 0, 'common', False),
    ('nature', 'Solné jeskyně', '197c67d6a8604a78a57335fcabe4b4d2', 0, 'common', False),
    ('nature', 'Koupací místa s kontrolou kvality vody', '239805159c8649609d1bd40a30439623', 0, 'common', False),
    ('nature', 'Aquaparky, koupaliště a bazény', '98d26c1b1c8f4bd49850af82a19a7f58', 0, 'common', False),
    ('heritage', 'Hornické a technické památky', '3727aefc159e47fd8cb9d70432ab7397', 3, 'common', True),
    ('heritage', 'Archeologické památky', '5b6083d1a59d46c59d26717b31e991d1', 0, 'common', True),
    ('heritage', 'Jiné atraktivity', '1e64adf22f8448a693f638c9f1334dc9', 3, 'common', False),
    ('food', 'Dobroty Karlovarského kraje', '5767506f1df649098991f462da16d497', 3, 'common', False),
    ('info', 'Turistická informační centra', '785fbd982147426ca275496791930eb8', 0, 'common', False),
]
STOPS = ('979283f4b7ec4b778b8eed7aab6917c3', 0)


def _norm(col):
    return re.sub(r'\s+', '_', col.strip().lower())


def _find(cols, pattern):
    """Vrátí první sloupec, jehož normalizovaný název odpovídá regexu."""
    return next((c for c in cols if re.search(pattern, _norm(c))), None)


def _float(v):
    try:
        return float(str(v).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def read_csv(text):
    return list(csv.DictReader(io.StringIO(text.lstrip('﻿'))))


def columns(rows):
    cols = list(rows[0].keys()) if rows else []
    return {
        'lon': _find(cols, r'zeměpisná.*délka'),
        'lat': _find(cols, r'zeměpisná.*šířka'),
        'name': _find(cols, r'^(název|nazev)$'),
        'oid': _find(cols, r'^obje[ck]t_?id$'),
        'desc': _find(cols, r'^popis$') or _find(cols, r'^stručný_popis$') or _find(cols, r'^poznámka$'),
        'url': _find(cols, r'^webová_stránka'),
        'okres': _find(cols, r'^název_okresu$'),
        'obec': _find(cols, r'^název_obce$'),
        'obec_kod': _find(cols, r'^kód_obce($|_dle)'),
        'orp': _find(cols, r'^název_(správního_obvodu_)?obce_s_rozšířenou'),
    }


def parse_layer(rows, category, label, item, layer, rarity, hazardous):
    """Vrátí (places, skipped). Při chybějících souřadnicových sloupcích vyhodí ValueError."""
    c = columns(rows)
    if not (c['lon'] and c['lat'] and c['name']):
        raise ValueError(f'{label}: nenalezeny sloupce se souřadnicemi/názvem')
    get = lambda row, k: (row.get(c[k]) or '').strip() if c[k] else ''
    places, skipped = {}, 0
    for i, row in enumerate(rows):
        lat, lon = _float(row[c['lat']]), _float(row[c['lon']])
        if lat is None or lon is None or not (BBOX['lat'][0] <= lat <= BBOX['lat'][1] and BBOX['lon'][0] <= lon <= BBOX['lon'][1]):
            skipped += 1
            continue
        name = get(row, 'name')
        oid = get(row, 'oid') or str(i + 1)
        extra = {}
        if label.startswith('Koupací'):
            # Vrstva nenese změřenou kvalitu vody (ta je jen na webu KHS, odkaz je v `url`), jen druh místa a vybavení.
            extra = {'swim': {'spec': (row.get(_find(rows[0].keys(), r'^specifikace_místa$')) or '').strip(),
                              'amenities': (row.get(_find(rows[0].keys(), r'^vybavenost$')) or '').strip()}}
        if category == 'food':
            # Vrstva Dobrot je po produktech – místo ke sbírání je provozovna výrobce.
            producer = (row.get(_find(rows[0].keys(), r'^výrobce$')) or name).strip()
            product = {'name': name, 'category': (row.get(_find(rows[0].keys(), r'^kategorie$')) or '').strip(),
                       'year': (row.get(_find(rows[0].keys(), r'^rok_soutěže$')) or '').strip()}
            key = f'{lat:.4f},{lon:.4f}|{producer}'
            if key in places:
                places[key]['extra']['products'].append(product)
                continue
            oid, name, extra = key, producer, {'products': [product]}
        places[oid] = {
            'source_item': item, 'source_layer': layer, 'source_object_id': oid[:40],
            'name': name[:300], 'category': category, 'subtype': label, 'lat': lat, 'lon': lon,
            'description': strip_tags(get(row, 'desc'))[:4000], 'url': get(row, 'url')[:500],
            'okres': get(row, 'okres'), 'obec': get(row, 'obec'), 'obec_kod': get(row, 'obec_kod'),
            'orp': get(row, 'orp'), 'rarity': rarity, 'is_hazardous': hazardous, 'license': 'CC0',
            'source_url': CSV_URL.format(item=item, layer=layer), 'extra': extra,
        }
    return list(places.values()), skipped


def parse_stops(rows):
    c = columns(rows)
    return [(r[c['name']].strip(), _float(r[c['lat']]), _float(r[c['lon']]))
            for r in rows if _float(r[c['lat']]) is not None and _float(r[c['lon']]) is not None]
