"""Demo souboj pro video: dva hráči s vyvinutými tvory + seed, se kterým naplánované tahy dopadnou efektně.

Spouští se v kontejneru backendu (viz record-battle.mjs), na konci vypíše jeden řádek JSON.
Idempotentní: opakované spuštění tvory vyléčí a staré souboje demo hráčů zruší.
"""
import json

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken

from apps.battles import engine, service
from apps.battles.models import Battle
from apps.game import pets
from apps.game.models import CheckIn, Pet, Profile
from apps.places.models import Place

# (uživatel, přezdívka, místo, typ, seed tvora, jméno, rarita, level, tahy po kolech)
PLAYERS = [
    ('demo_bara', 'Bára', 82, 'view', 419916, 'Vyhlídal', 'legendary', 8,
     ['thunder', 'gust', 'sunbeam', 'thunder', 'sunbeam', 'thunder', 'sunbeam']),
    ('demo_kuba', 'Kuba', 12, 'fortress', 854670, 'Baštoun', 'legendary', 9,
     ['rockfall', 'siege_fire', 'rockfall', 'siege_fire', 'heavy', 'siege_fire', 'siege_fire']),
]

out = {}
fighters = []
for username, nick, place_id, ptype, seed, name, rarity, level, plan in PLAYERS:
    user, _ = User.objects.get_or_create(username=username, defaults={'email': f'{username}@example.com'})
    Profile.objects.update_or_create(user=user, defaults={'nickname': nick, 'level': 5, 'xp': 800, 'consent_confirmed': True})
    place = Place.objects.get(pk=place_id)
    checkin, _ = CheckIn.objects.get_or_create(user=user, place=place, defaults={
        'lat': place.lat, 'lon': place.lon, 'accuracy_m': 8, 'distance_m': 40, 'verified': True, 'exif_status': 'ok'})
    bias = pets.TYPE_BIAS[ptype]
    stats = {k: round(v * pets.RARITY_MULT[rarity] * bias.get(k, 1)) for k, v in pets.BASE_STATS.items()}
    pet, _ = Pet.objects.update_or_create(owner=user, checkin=checkin, defaults={
        'place': place, 'species': name, 'type': ptype, 'name': name, 'rarity': rarity, **stats,
        'level': level, 'xp': pets.xp_for_level(level), 'stage': 3, 'seed': seed, 'verified': True, 'injured_until': None})
    Pet.objects.filter(owner=user).exclude(pk=pet.pk).delete()
    Battle.objects.filter(Q(player_a=user) | Q(player_b=user), status__in=['waiting', 'active']).update(status='abandoned')
    out[username] = {'nick': nick, 'token': str(RefreshToken.for_user(user).access_token), 'plan': plan}
    fighters.append((service._fighter(pet), plan))

(fa, plan_a), (fb, plan_b) = fighters
moves = list(zip(plan_a, plan_b))


def score(seed):
    """Všechna kouzla trefí, Vyhlídal aspoň jednou blesk i paprsek, Baštoun (Pevnost přebíjí Výhled) dorazí Ohnivou střelou."""
    a, b, log, w = engine.replay(fa, fb, moves, seed)
    if w != 'b' or not 5 <= len(log) <= 6:
        return None
    events = [e for turn in log for e in turn]
    if any(e['kind'] == 'magic' and not e['hit'] for e in events):
        return None
    if not {'thunder', 'sunbeam'} <= {e['move'] for e in events if e['hit']}:
        return None
    last = log[-1][-1]
    if last['actor'] != 'b' or last['move'] != 'siege_fire' or last['damage'] < 50:
        return None
    return b['hp'] / b['max_hp']  # čím těsnější výhra, tím líp


best = min(((s, r) for s in range(1, 20000) if (r := score(s)) is not None), key=lambda x: x[1])
out['seed'] = best[0]
_, _, log, _ = engine.replay(fa, fb, moves, best[0])
out['turns'] = len(log)
out['preview'] = [[f"{e['actor']}:{e['move']}:{e.get('damage', 0)}" for e in turn] for turn in log]
print('RESULT ' + json.dumps(out, ensure_ascii=False))
