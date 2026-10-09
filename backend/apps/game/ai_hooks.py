"""Volitelné AI v check-inu (PROJECT_SPEC 8.1 bod 9, 11). Vždy s fallbackem – AI nikdy sama neblokuje razítko."""
import re

from django.conf import settings

from services.ai_service import gemini_vision, get_ai_provider

from . import pets

CATEGORY_HINT = {
    'castle': 'hrad, zámek nebo zřícenina', 'lookout': 'rozhledna nebo vyhlídka', 'spring': 'pramen, studánka nebo kolonáda',
    'culture': 'muzeum, památka, kostel nebo divadlo', 'nature': 'příroda, park, skála nebo vodní plocha',
    'heritage': 'technická nebo archeologická památka', 'food': 'obchod, farma, výrobna nebo jídlo', 'info': 'informační centrum nebo budova',
}


def verdict_delta(answer):
    """ANO → +10, NE → −30, cokoli jiného (nejisté, chyba) → 0."""
    m = re.match(r'(ANO|NE)\b', (answer or '').strip().upper())
    return {'ANO': 10, 'NE': -30}[m.group(1)] if m else 0


def vision_trust_delta(photo_bytes, category):
    if not settings.AI_VISION_VERIFY:
        return 0
    return verdict_delta(gemini_vision(
        f'Je na fotce místo typu „{CATEGORY_HINT[category]}“ (ne jen obrazovka, selfie nebo interiér auta)? Odpověz jen ANO nebo NE.',
        photo_bytes))


def generate_lore(spec, place):
    fallback = pets.template_lore(spec, place)
    if not settings.AI_LORE:
        return fallback
    r = get_ai_provider().generate(
        f'Napiš 2 krátké vtipné věty (česky, pro děti) o tvorovi „{spec["species"]}“ typu {pets.TYPE_LABEL[spec["type"]]}, '
        f'který se zrodil u místa „{place.name}“ ({place.subtype}, {place.obec}). Bez úvodu.',
        temperature=0.9, max_tokens=120)
    text = (r.get('response') or '').strip() if r.get('status') == 'success' and not r.get('is_mock') else ''
    return text[:500] or fallback
