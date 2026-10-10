"""Demo svět pro video (jen lokální DB): hráči ze škol a týmů s razítky po kraji, Bára s plným Pasem, Ema bez razítek.

Spouští se v kontejneru backendu: docker exec -i web_template-backend-1 python manage.py shell < scripts/world_setup.py
Idempotentní. Úklid všeho: User.objects.filter(username__startswith='demo_').delete()
"""
import json
import random
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.game import badges
from apps.game.models import CheckIn, Pet, Profile, Team, UserBadge
from apps.places.models import Place

rng = random.Random(2026)
now = timezone.now()
SCHOOLS = ['Gymnázium Cheb', 'SPŠ Karlovy Vary', 'Gymnázium Sokolov', 'Gymnázium Ostrov', 'Obchodní akademie Karlovy Vary',
           'ZŠ Mariánské Lázně', 'Gymnázium Aš']
TEAMS = ['3.B Gymnázium Cheb', 'Sokolovští sokoli', 'Vřídelní parta', 'Krušnohorští vlci', 'Lázeňští toulavci', 'Ašští rozhledníci']
NICKS = ['Terka', 'Ondra_KV', 'Matěj', 'Anička', 'Vojta', 'Klára', 'Šimon', 'Natka', 'Adam_Cheb', 'Eliška', 'Kryštof', 'Bety',
         'Honza', 'Verča', 'Dominik', 'Sára', 'Lukáš', 'Majda', 'Filip', 'Amálka', 'Tobiáš', 'Lucka_ML', 'Štěpán', 'Zuzka',
         'Radek', 'Nela', 'Patrik', 'Viki', 'Jirka', 'Markéta', 'Daniel', 'Julča', 'Tadeáš', 'Ráďa', 'Kuba_S', 'Míša', 'Pavel',
         'Hanka', 'Tom', 'Ela']

places = list(Place.objects.exclude(category='info').filter(is_hazardous=False))
CAT_W = {'castle': 3, 'lookout': 3, 'spring': 2.2, 'culture': 1.4, 'nature': 1.6, 'food': 1.4, 'heritage': 0.7}
# ponytail: popularita = váha kategorie × Pareto, ať má žebříček míst výrazné hvězdy i místa, kam nikdo nedošel
pop = {p.id: CAT_W.get(p.category, 1) * rng.paretovariate(1.3) * (0 if rng.random() < 0.18 else 1) for p in places}
STARS = {12: 40, 82: 30, 1: 25, 23: 20, 98: 14}  # Loket, Diana, Cheb, Bečov… (id → extra váha)
for pid, w in STARS.items():
    pop[pid] = pop.get(pid, 0) + w


def stamp(user, place, days_ago, forgotten=False):
    c, created = CheckIn.objects.get_or_create(user=user, place=place, defaults={
        'lat': place.lat, 'lon': place.lon, 'accuracy_m': rng.uniform(5, 25), 'distance_m': rng.randint(15, 250),
        'verified': True, 'exif_status': 'ok', 'forgotten': forgotten})
    if created:
        CheckIn.objects.filter(pk=c.pk).update(created_at=now - timedelta(days=days_ago, hours=rng.uniform(0, 9)))


def player(username, nick, school='', team=None):
    u, _ = User.objects.get_or_create(username=username, defaults={'email': f'{username}@example.com'})
    p, _ = Profile.objects.update_or_create(user=u, defaults={'nickname': nick, 'school': school, 'team': team, 'consent_confirmed': True})
    return u, p


# úklid předchozího běhu (Bára a Kuba zůstávají kvůli souboji, jejich tvorové taky)
User.objects.filter(username__startswith='demo_p').delete()
Team.objects.filter(name__in=TEAMS).delete()
CheckIn.objects.filter(user__username__startswith='demo_', pet__isnull=True).delete()
UserBadge.objects.filter(user__username__startswith='demo_').delete()
ema = User.objects.filter(username='demo_ema').first()
if ema:
    Pet.objects.filter(owner=ema).delete()
    CheckIn.objects.filter(user=ema).delete()

owner, _ = User.objects.get_or_create(username='demo_p_owner', defaults={'email': 'demo_p_owner@example.com'})
teams = [Team.objects.create(name=n, join_code=f'DEMO{i:02d}', owner=owner) for i, n in enumerate(TEAMS)]

# 40 hráčů s razítky po kraji
weights = [pop[p.id] for p in places]
for i, nick in enumerate(NICKS):
    u, prof = player(f'demo_p{i:02d}', nick, rng.choice(SCHOOLS) if rng.random() < 0.8 else '',
                     rng.choice(teams) if rng.random() < 0.7 else None)
    n = min(30, int(rng.paretovariate(1.1) * 4) + 2)
    for pl in set(rng.choices(places, weights=weights, k=n)):
        stamp(u, pl, rng.randint(0, 40), forgotten=pop[pl.id] < 0.8 and rng.random() < 0.5)
    stamps = CheckIn.objects.filter(user=u).count()
    prof.xp = stamps * 60 + rng.randint(0, 150)
    prof.level, prof.wins, prof.rating = 1 + prof.xp // 200, rng.randint(0, stamps), 1000 + rng.randint(-120, 260)
    prof.save()

# Bára: plný Pas (5 hradů, rozhledny, prameny, Dobroty, bez auta, zapomenutá místa)
bara, bprof = player('demo_bara', 'Bára', 'Gymnázium Cheb', teams[0])
kuba, kprof = player('demo_kuba', 'Kuba', 'Gymnázium Cheb', teams[0])
pick = lambda cat, k, **f: list(Place.objects.filter(category=cat, is_hazardous=False, **f).order_by('id')[:k])
plan = (pick('castle', 5) + [Place.objects.get(pk=x) for x in (101, 89, 83, 88)] + pick('spring', 3, okres='Karlovy Vary')
        + pick('food', 3) + pick('nature', 2, okres='Cheb') + pick('culture', 2, okres='Cheb') + pick('heritage', 1, okres='Sokolov'))
for k, pl in enumerate(plan):
    stamp(bara, pl, days_ago=[1, 3][k % 2] if k < 3 else 4 + k * 2, forgotten=k in (8, 12, 15))
for pl in pick('castle', 2, okres='Karlovy Vary') + pick('spring', 2):
    stamp(kuba, pl, rng.randint(1, 20))
bprof.xp, bprof.level = 1240, 7
kprof.xp, kprof.level = 980, 5
bprof.save()
kprof.save()

# Ema: čerstvá hráčka pro záznam razítka na Dianě
ema, _ = player('demo_ema', 'Ema', 'Gymnázium Ostrov')

for u in User.objects.filter(username__startswith='demo_'):
    badges.evaluate(u)
cache.clear()  # žebříčky a statistiky jsou kešované

out = {k: str(RefreshToken.for_user(u).access_token) for k, u in (('bara', bara), ('ema', ema), ('kuba', kuba))}
out['bara_stamps'] = CheckIn.objects.filter(user=bara).count()
out['bara_badges'] = list(UserBadge.objects.filter(user=bara).values_list('badge__code', flat=True))
out['total'] = CheckIn.objects.filter(is_demo=False).count()
print('RESULT ' + json.dumps(out, ensure_ascii=False))
