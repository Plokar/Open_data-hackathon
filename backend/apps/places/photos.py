"""
Fotky a popisy míst z Wikipedie a Wikimedia Commons.

Postup pro každé místo:
  1. cs.wikipedia geosearch kolem souřadnic, vybere článek, jehož název sedí s názvem místa
     → hlavní obrázek článku + první věty jako popis.
  2. Když článek nebo jeho obrázek chybí: Commons geosearch, jen soubor, jehož název sedí s místem
     (náhodná fotka domu vedle by uživatele mátla).
Výsledek jde do Place.extra['photo'] a Place.extra['wiki'], soubor do MEDIA_ROOT/places/<id>.jpg.
Licence a autor se ukládají vždy, Commons je CC-BY-SA a vyžaduje uvedení autora.
"""
import html
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

UA = 'ZapadGO/1.0 (hackathon Karlovarskeho kraje; https://www.datazapad.cz)'
WIKI = 'https://cs.wikipedia.org/w/api.php'
COMMONS = 'https://commons.wikimedia.org/w/api.php'
THUMB_WIDTH = 960

# Slova, která samotná nic neidentifikují ("Kostel" je v kraji stovka)
GENERIC = {'hrad', 'zamek', 'zricenina', 'rozhledna', 'vyhlidka', 'pramen', 'kostel', 'kaple', 'muzeum',
           'svateho', 'svate', 'sv', 'pod', 'nad', 'the', 'und', 'der', 'die', 'das', 'mineralni', 'prirodni',
           'pamatka', 'rezervace', 'narodni', 'galerie', 'kulturni', 'centrum', 'informacni'}


# Tvary a synonyma druhu místa: "Zřícenina hradu Kynžvart" je na Wikipedii "Kynžvart (hrad)"
KIND = {'zricenina': 'hrad', 'hradu': 'hrad', 'hradek': 'hrad', 'zamku': 'zamek', 'rozhledny': 'rozhledna',
        'vyhlidky': 'vyhlidka', 'kostela': 'kostel', 'muzea': 'muzeum'}


def tokens(name: str) -> set[str]:
    s = unicodedata.normalize('NFKD', name.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return {KIND.get(t, t) for t in re.split(r'[^a-z0-9]+', s) if len(t) >= 3}


def _same(a: str, b: str) -> bool:
    # ponytail: kmen = první 4 znaky (Cheb ~ Chebský, Lokte ~ Loket nechytí); lepší by byla lemmatizace
    return a == b or (len(a) >= 4 and len(b) >= 4 and a[:4] == b[:4])


def name_score(place: str, candidate: str) -> float:
    """
    Podíl významných slov z názvu místa nalezených v kandidátovi (0..1), plus malý bonus za stejný druh.
    Když název místa říká druh (hrad, rozhledna…) a kandidát ho nesdílí, skóre padá pod práh:
    "Hrad Cheb" nesmí dostat fotku kostela nebo celého města Cheb.
    """
    p, c = tokens(place), tokens(candidate)
    # "Hrad Seeberg (Ostroh)": závorka je jiný název téhož místa, stačí shoda s jednou variantou
    variants = [tokens(v) - GENERIC for v in re.split(r'[()]', place) if tokens(v) - GENERIC] or [p]
    score = max(sum(any(_same(t, x) for x in c) for t in key) / len(key) for key in variants)
    kinds, other = p & GENERIC, (c & GENERIC) - p
    if kinds & c:
        score += 0.25
    elif kinds and other:
        score *= 0.4  # hrad vs. kostel: jiné místo
    elif kinds:
        score *= 0.8  # článek bez druhu: může být místo samo ("Hungerberg"), ale i celé město
    return score


def _get(url: str, params: dict, tries: int = 4) -> dict:
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    req = urllib.request.Request(f'{url}?{q}', headers={'User-Agent': UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                d = json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == tries - 1:
                raise
            # Wikimedia při přetížení vrací 429: počkat, kolik řekne (Retry-After), jinak exponenciálně
            time.sleep(float(e.headers.get('Retry-After') or 5 * 2 ** attempt))
            d = {}
            continue
        if 'query' in d:
            return d
        time.sleep(2 ** attempt)  # API vrací chybu (např. ratelimited) místo dat: chvíli počkat
    raise RuntimeError(f"Wikimedia API: {d.get('error', {}).get('code', d)}")


def _strip_html(s: str) -> str:
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def file_info(title: str) -> dict | None:
    """Náhled, autor a licence souboru z Commons."""
    d = _get(COMMONS, {'action': 'query', 'titles': title, 'prop': 'imageinfo',
                       'iiprop': 'url|extmetadata|mime', 'iiurlwidth': THUMB_WIDTH})
    page = d['query']['pages'][0]
    info = (page.get('imageinfo') or [None])[0]
    if not info or info.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'):
        return None
    meta = info.get('extmetadata', {})
    val = lambda k: _strip_html(meta.get(k, {}).get('value', ''))
    return {
        'thumb': info.get('thumburl') or info['url'],
        'author': val('Artist')[:200],
        'license': val('LicenseShortName') or 'viz zdroj',
        'source': info.get('descriptionurl', ''),
        'caption': val('ImageDescription')[:300],
    }


def find_wiki(name: str, lat: float, lon: float, radius: int) -> dict | None:
    d = _get(WIKI, {'action': 'query', 'list': 'geosearch', 'gscoord': f'{lat}|{lon}',
                    'gsradius': radius, 'gslimit': 20})
    best = max(d['query']['geosearch'], key=lambda g: (name_score(name, g['title']), -g['dist']), default=None)
    if not best or name_score(name, best['title']) < 0.5:
        return None
    p = _get(WIKI, {'action': 'query', 'pageids': best['pageid'], 'prop': 'pageimages|extracts|info',
                    'piprop': 'name', 'exintro': 1, 'explaintext': 1, 'exsentences': 3, 'inprop': 'url'})
    page = p['query']['pages'][0]
    return {'title': page['title'], 'extract': (page.get('extract') or '').strip()[:900],
            'url': page.get('fullurl', ''), 'image': page.get('pageimage')}


def find_commons_file(name: str, lat: float, lon: float, radius: int) -> str | None:
    d = _get(COMMONS, {'action': 'query', 'list': 'geosearch', 'gscoord': f'{lat}|{lon}',
                       'gsradius': radius, 'gslimit': 30, 'gsnamespace': 6})
    files = [g for g in d['query']['geosearch'] if re.search(r'\.(jpe?g|png|webp)$', g['title'], re.I)]
    best = max(files, key=lambda g: (name_score(name, g['title']), -g['dist']), default=None)
    return best['title'] if best and name_score(name, best['title']) >= 0.5 else None


def lookup(name: str, lat: float, lon: float, category: str, commons: str = '') -> tuple[dict | None, dict | None]:
    """Vrátí (wiki, photo). Každé může být None. `commons` = soubor známý předem (Wikidata P18), má přednost."""
    radius = 1500 if category in ('castle', 'lookout', 'nature', 'heritage') else 600
    wiki = find_wiki(name, lat, lon, radius)
    photo = file_info(f'File:{commons}') if commons else None
    if not photo and wiki and wiki['image']:
        photo = file_info(f"File:{wiki['image']}")
    if not photo and category not in ('food', 'info'):  # u výrobců a infocenter nehádáme podle okolí
        title = find_commons_file(name, lat, lon, min(radius, 800))
        photo = file_info(title) if title else None
    time.sleep(0.2)  # slušnost k API Wikimedie
    return wiki, photo


def download(url: str, path) -> None:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        path.write_bytes(r.read())
