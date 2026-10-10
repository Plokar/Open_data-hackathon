"""
Normalizace otevřených dat na slovníky pro model Place. Čistý Python, bez DB.
Karlovarský kraj: CSV vrstvy z DATA ZÁPAD. Plzeňský kraj: Wikidata (krajský katalog památek nemá souřadnice)
a zastávky z OpenStreetMap (DATA ZÁPAD má jen karlovarské).
"""
import csv
import io
import re
import urllib.parse
from collections import Counter

from django.utils.html import strip_tags

CSV_URL = 'https://www.datazapad.cz/api/download/v1/items/{item}/csv?layers={layer}'
BBOX = {'lon': (12.0, 14.0), 'lat': (48.9, 50.5)}  # Karlovarský + Plzeňský kraj

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
    f = io.StringIO(text.lstrip('﻿'))
    # Aquaparky mají x,y dvakrát (WGS84, pak Web Mercator); DictReader by nechal ten druhý. Opakovaný sloupec dostane _2.
    names, seen = [], Counter()
    for h in next(csv.reader(f), []):
        seen[h] += 1
        names.append(h if seen[h] == 1 else f'{h}_{seen[h]}')
    return list(csv.DictReader(f, fieldnames=names))


def columns(rows):
    cols = list(rows[0].keys()) if rows else []
    return {
        'lon': _find(cols, r'zeměpisná.*délka') or _find(cols, r'^x$'),
        'lat': _find(cols, r'zeměpisná.*šířka') or _find(cols, r'^y$'),
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


# ── Plzeňský kraj: Wikidata ───────────────────────────────────────────────────
WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
WIKIDATA_SOURCE = 'wikidata-plzensky-kraj'
NKP = 'Q649434'  # národní kulturní památka → epic, jako vrstva NKP v DATA ZÁPAD
# (typ P31, kategorie, podtyp, rarita, nebezpečné). Pořadí = přednost, když má položka víc typů (zámek s muzeem je zámek).
WIKIDATA_TYPES = [
    ('Q23413', 'castle', 'Hrady', 'rare', False),
    ('Q17715832', 'castle', 'Zříceniny hradů', 'rare', False),
    ('Q751876', 'castle', 'Zámky', 'rare', False),
    ('Q1408475', 'castle', 'Tvrze', 'rare', False),
    ('Q1440300', 'lookout', 'Rozhledny', 'rare', False),
    ('Q44613', 'culture', 'Kláštery', 'common', False),
    ('Q33506', 'culture', 'Muzea', 'common', False),
    ('Q34627', 'culture', 'Synagogy', 'common', False),
    ('Q16970', 'culture', 'Kostely', 'common', False),
    ('Q846659', 'culture', 'Židovské hřbitovy', 'common', False),
    ('Q21101734', 'nature', 'Přírodní rezervace', 'common', False),
    ('Q21100463', 'nature', 'Přírodní památky', 'common', False),
    ('Q34038', 'nature', 'Vodopády', 'common', False),
    ('Q744099', 'heritage', 'Hradiště', 'common', True),  # archeologie jako v DATA ZÁPAD: nebezpečné (12.5)
]
# Shora dolů: kraj → okresy → obce (→ části obcí) → místa. Opačně by SPARQL procházel všechny kostely světa a padal
# na 60s limitu. Jen místa s článkem na cs.wikipedii (měřítko „stojí za výlet“ a zdroj popisu), u rozhleden
# a vodopádů stačí položka.
WIKIDATA_QUERY = '''
SELECT ?item ?itemLabel ?itemDescription ?type ?coord ?okresLabel ?obecLabel ?obecKod ?img ?wp ?nkp WHERE {
  hint:Query hint:optimizer "None" .
  ?okres wdt:P131 wd:Q46070 ; wdt:P31 wd:Q548611 .
  ?obec wdt:P131 ?okres ; wdt:P7606 ?obecKod .  # kód obce ČSÚ: jen obce, ne správní obvody ORP
  { ?item wdt:P131 ?obec } UNION { ?cast wdt:P131 ?obec . ?item wdt:P131 ?cast }
  ?item wdt:P31 ?type .
  FILTER(?type IN (%s))
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?wp schema:about ?item; schema:isPartOf <https://cs.wikipedia.org/> }
  OPTIONAL { ?item wdt:P1435 wd:%s . BIND(1 AS ?nkp) }
  FILTER(BOUND(?wp) || ?type IN (wd:Q1440300, wd:Q34038))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "cs,en". }
}''' % (', '.join(f'wd:{t[0]}' for t in WIKIDATA_TYPES), NKP)


def parse_wikidata(bindings):
    """SPARQL JSON výsledky → (places, skipped). Jedna položka může přijít ve víc řádcích (víc typů, obcí, fotek)."""
    val = lambda b, k: b.get(k, {}).get('value', '')
    qid = lambda b: val(b, 'item').rsplit('/', 1)[-1]
    rank = {t[0]: i for i, t in enumerate(WIKIDATA_TYPES)}
    nkp = {qid(b) for b in bindings if 'nkp' in b}
    best = {}  # QID → řádek s typem nejvyšší přednosti; místo ve dvou obcích dostane tu s nižším kódem (stabilní mezi importy)
    for b in bindings:
        b['rank'] = (rank[val(b, 'type').rsplit('/', 1)[-1]], val(b, 'obecKod'))
        if qid(b) not in best or b['rank'] < best[qid(b)]['rank']:
            best[qid(b)] = b
    places, skipped = [], 0
    for item, b in best.items():
        m = re.match(r'Point\(([-\d.]+) ([-\d.]+)\)', val(b, 'coord'))
        lon, lat = (float(m[1]), float(m[2])) if m else (None, None)
        name = val(b, 'itemLabel')
        if lat is None or not (BBOX['lat'][0] <= lat <= BBOX['lat'][1] and BBOX['lon'][0] <= lon <= BBOX['lon'][1]) or name == item:
            skipped += 1  # bez souřadnic, mimo kraj nebo bez českého i anglického názvu
            continue
        _, category, subtype, rarity, hazardous = WIKIDATA_TYPES[b['rank'][0]]
        img = urllib.parse.unquote(val(b, 'img').rsplit('/', 1)[-1]) if val(b, 'img') else ''
        places.append({
            'source_item': WIKIDATA_SOURCE, 'source_layer': 0, 'source_object_id': item,
            'name': name[:1].upper() + name[1:300],  # Wikidata píše „zámek Cebiv“, v DATA ZÁPAD je „Hrad Cheb“
            'category': category, 'subtype': subtype, 'lat': lat, 'lon': lon,
            'description': ' '.join(val(b, 'itemDescription').split())[:4000], 'url': val(b, 'wp')[:500],
            'okres': re.sub(r'^okres\s+', '', val(b, 'okresLabel')), 'obec': val(b, 'obecLabel')[:100],
            'obec_kod': val(b, 'obecKod')[:10], 'orp': '', 'rarity': 'epic' if item in nkp else rarity, 'is_hazardous': hazardous,
            'license': 'CC0', 'source_url': f'https://www.wikidata.org/wiki/{item}',
            # fotka z Wikidat (P18) je vybraná ručně, fetch_place_photos ji vezme přednostně
            'extra': {'commons': img} if img else {},
        })
    # „Kostel svatého Mikuláše“ je v kraji víckrát: doplnit obec jako Wikipedie, ať se dají rozlišit v seznamech
    seen = Counter(p['name'] for p in places)
    for p in places:
        if seen[p['name']] > 1 and p['obec'] and p['obec'] not in p['name']:
            p['name'] = f"{p['name']} ({p['obec']})"[:300]
    return places, skipped


# ── Zastávky mimo DATA ZÁPAD: OpenStreetMap (ODbL, uvedeno v patičce) ─────────────
OVERPASS = 'https://overpass-api.de/api/interpreter'
# area 3600442466 = OSM relace 442466 (Plzeňský kraj). Část zastávek je v OSM jen jako stop_position, v Plzni tramvaje.
OSM_STOPS_QUERY = ('[out:json][timeout:180];(node["highway"="bus_stop"]["name"](area:3600442466);'
                   'node["public_transport"="stop_position"]["bus"="yes"]["name"](area:3600442466);'
                   'node["railway"="tram_stop"]["name"](area:3600442466););out;')


def parse_osm_stops(data):
    """Overpass JSON → [(název, lat, lon)]. Sloupky obou směrů jedné zastávky sloučí."""
    seen = {}
    for e in data.get('elements', []):
        name = (e.get('tags') or {}).get('name', '').strip()
        if name and 'lat' in e:
            seen.setdefault((name, round(e['lat'], 3), round(e['lon'], 3)), (name, e['lat'], e['lon']))
    return list(seen.values())
