import secrets
import uuid
from datetime import datetime, timezone as dt_tz

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.battles import engine
from apps.places.models import Place

from . import ai_hooks, anticheat, badges, pets, quests, rating
from .models import Badge, CheckIn, Friendship, Pet, Profile, Team, UserBadge

XP_BY_RARITY = {'common': 50, 'rare': 75, 'epic': 100, 'legendary': 150}
FORGOTTEN_XP_MULT = 1.5  # bonus za málo navštěvované místo (rozkládá turisty po kraji)


def err(code, detail, status=400, **extra):
    return Response({'error_code': code, 'detail': detail, **extra}, status=status)


def profile_of(user):
    return Profile.objects.get_or_create(user=user, defaults={'nickname': user.username[:30]})[0]


def pet_json(p):
    injured = p.injured_until if p.injured_until and p.injured_until > timezone.now() else None
    return {
        'id': p.id, 'name': p.name, 'species': p.species, 'type': p.type, 'rarity': p.rarity,
        'hp': p.hp, 'atk': p.atk, 'defense': p.defense, 'spd': p.spd, 'mag': p.mag, 'stamina': p.stamina,
        # ponytail: bez bonusu za razítka stejného typu (to by byl dotaz na každého PETa), ten se přičte až v boji
        'stats': pets.effective_stats(p),
        'level': p.level, 'xp': p.xp, 'xp_level': pets.xp_for_level(p.level),
        'xp_next': pets.xp_for_level(p.level + 1) if p.level < pets.MAX_LEVEL else None,
        'stage': p.stage, 'stage_label': pets.STAGES[p.stage][0], 'can_evolve': pets.can_evolve(p),
        'evolve_level': pets.EVOLVE_LEVEL.get(p.stage + 1), 'injured_until': injured,
        'moves': [{'id': m, **engine.MOVES[m]} for m in engine.moves_for(p.type, p.stage)],
        'seed': p.seed, 'lore': p.lore, 'verified': p.verified, 'is_demo': p.checkin.is_demo,
        'place': {'id': p.place_id, 'name': p.place.name, 'category': p.place.category},
        'created_at': p.created_at,
    }


def checkin_json(c):
    return {
        'id': c.id, 'created_at': c.created_at, 'distance_m': c.distance_m, 'trust': c.trust,
        'verified': c.verified, 'is_demo': c.is_demo, 'exif_status': c.exif_status,
        'place': {'id': c.place_id, 'name': c.place.name, 'category': c.place.category,
                  'okres': c.place.okres, 'rarity': c.place.rarity},
    }


def badge_json(b, user):
    done, target = badges.progress(b.rule, user) if user.is_authenticated else (0, None)
    return {'code': b.code, 'name': b.name, 'description': b.description, 'icon': b.icon,
            'progress': done, 'target': target,
            'awarded': user.is_authenticated and UserBadge.objects.filter(user=user, badge=b).exists()}


def _parse_ts(v):
    try:
        return datetime.fromtimestamp(float(v) / 1000, tz=dt_tz.utc)  # epoch ms z Date.now()
    except ValueError:
        t = datetime.fromisoformat(str(v).replace('Z', '+00:00'))
        return t if t.tzinfo else t.replace(tzinfo=dt_tz.utc)


class CheckInView(APIView):
    """POST /api/checkins/ – razítko. Vše se ověřuje na serveru (PROJECT_SPEC 8.1)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'checkin'

    def post(self, request):
        d, user = request.data, request.user
        try:
            place = Place.objects.get(pk=int(d['place']))
            lat, lon, accuracy = float(d['lat']), float(d['lon']), float(d.get('accuracy', 9999))
            client_ts = _parse_ts(d['client_ts'])
        except (KeyError, ValueError, TypeError, OverflowError, Place.DoesNotExist):
            return err('BAD_REQUEST', 'Chybí nebo je neplatné místo, poloha nebo čas.')
        demo = str(d.get('demo', '')).lower() in ('1', 'true')
        if demo and not (settings.DEMO_MODE and user.is_staff):
            return err('DEMO_FORBIDDEN', 'Demo razítko není povoleno.', 403)
        photo = request.FILES.get('photo')
        if not photo:
            return err('PHOTO_REQUIRED', 'K razítku je potřeba fotka místa.')

        now = timezone.now()
        try:
            if CheckIn.objects.filter(user=user, place=place).exists():
                raise anticheat.Reject('ALREADY_STAMPED', 'Toto místo už máš v Pasu.', 409)
            last = CheckIn.objects.filter(user=user).first()
            distance = anticheat.check_position(place, lat, lon, accuracy, client_ts, now, last,
                                                settings.CHECKIN_RADIUS_M, demo)
            data = photo.read()
            info = anticheat.analyze_photo(data, place, now, settings.TIME_ZONE)
            if CheckIn.objects.filter(photo_sha256=info['sha256']).exists():
                raise anticheat.Reject('DUPLICATE_PHOTO', 'Tahle fotka už byla použita.')
            others = CheckIn.objects.filter(place=place).exclude(user=user).exclude(photo_phash='')
            if any(anticheat.hamming(h, info['phash']) <= anticheat.PHASH_MAX_DISTANCE
                   for h in others.values_list('photo_phash', flat=True)):
                raise anticheat.Reject('DUPLICATE_PHOTO', 'Fotka je skoro stejná jako fotka jiného hráče.')
        except anticheat.Reject as r:
            return err(r.code, r.detail, r.status, **r.extra)

        forgotten = not demo and place.is_forgotten                # počítá se před uložením tohoto razítka
        trail = quests.trail_finished_by(user, place)               # výprava, kterou toto razítko dokončí
        ai_delta = ai_hooks.vision_trust_delta(data, place.category)
        trust = anticheat.trust_score(info['trust_penalty'], 0 if demo else accuracy, ai_delta)
        verified = trust >= 50 and not demo
        ext = photo.name.rsplit('.', 1)[-1].lower()[:4] if '.' in photo.name else 'jpg'
        try:
            with transaction.atomic():
                ci = CheckIn.objects.create(
                    user=user, place=place, lat=lat, lon=lon, accuracy_m=accuracy, distance_m=distance,
                    photo=ContentFile(data, name=f'{uuid.uuid4().hex}.{ext}'), photo_sha256=info['sha256'],
                    photo_phash=info['phash'], exif_status=info['exif_status'], trust=trust,
                    verified=verified, is_demo=demo, forgotten=forgotten)
                rarity = pets.next_rarity(place.rarity) if trail else place.rarity  # odměna za dokončenou výpravu
                spec = pets.generate(place.id, place.category, rarity, info['sha256'], user.id)
                pet = Pet.objects.create(owner=user, place=place, checkin=ci, verified=verified,
                                         lore=ai_hooks.generate_lore(spec, place), **spec)
                profile = profile_of(user)
                xp_gain = XP_BY_RARITY[place.rarity]
                if forgotten:
                    xp_gain = round(xp_gain * FORGOTTEN_XP_MULT)
                daily = quests.daily_place()
                if daily and daily.id == place.id:
                    xp_gain *= 2  # quest „Místo dne“
                # quest „3 místa tento týden“ – razítka jsou unikátní, takže == 3 nastane jednou za týden
                if CheckIn.objects.filter(user=user, created_at__date__gte=quests.week_start()).count() == 3:
                    xp_gain += 100
                level_up = profile.add_xp(xp_gain)
                profile.save()
                new_badges = badges.evaluate(user)
        except IntegrityError:
            return err('ALREADY_STAMPED', 'Toto místo už máš v Pasu.', 409)
        return Response({
            'checkin': checkin_json(ci), 'pet': pet_json(pet), 'xp_gain': xp_gain, 'level_up': level_up,
            'level': profile.level, 'forgotten': forgotten,
            'trail_done': trail and {'id': trail['id'], 'stop': trail['stop']},
            'new_badges': [{'code': b.code, 'name': b.name, 'icon': b.icon} for b in new_badges],
        }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_checkins(request):
    qs = CheckIn.objects.filter(user=request.user).select_related('place')
    return Response([checkin_json(c) for c in qs])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkin_photo(request, pk):
    c = get_object_or_404(CheckIn, pk=pk)
    if c.user_id != request.user.id and not profile_of(c.user).photo_public:
        return err('FORBIDDEN', 'Fotka je soukromá.', 403)
    return FileResponse(c.photo.open('rb'))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_pets(request):
    qs = Pet.objects.filter(owner=request.user).select_related('place', 'checkin')
    return Response([pet_json(p) for p in qs])


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def pet_detail(request, pk):
    p = get_object_or_404(Pet.objects.select_related('place', 'checkin'), pk=pk)
    if request.method == 'PATCH':
        if p.owner_id != request.user.id:
            return err('FORBIDDEN', 'Tohle není tvůj PET.', 403)
        name = str(request.data.get('name', '')).strip()
        if not 1 <= len(name) <= 40:
            return err('BAD_NAME', 'Jméno musí mít 1–40 znaků.')
        p.name = name
        p.save(update_fields=['name'])
    return Response(pet_json(p))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pet_evolve(request, pk):
    with transaction.atomic():
        p = get_object_or_404(Pet.objects.select_for_update().select_related('place', 'checkin'), pk=pk, owner=request.user)
        if not pets.can_evolve(p):
            need = pets.EVOLVE_LEVEL.get(p.stage + 1)
            return err('CANNOT_EVOLVE', f'Evoluce je možná od levelu {need}.' if need else 'Tvor je už plně vyvinutý.')
        p.stage += 1
        p.save(update_fields=['stage'])
    return Response(pet_json(p))


@api_view(['GET'])
@permission_classes([AllowAny])
def badge_list(request):
    return Response([badge_json(b, request.user) for b in Badge.objects.order_by('id')])


def top_pet(user):
    p = user.pets.order_by('-level', '-stage', '-xp').first()
    return p and {'name': p.name, 'type': p.type, 'seed': p.seed, 'stage': p.stage, 'rarity': p.rarity, 'level': p.level}


def person_json(user):
    prof = profile_of(user)
    return {'nickname': prof.nickname, 'level': prof.level, 'rating': rating.refresh(user), 'top_pet': top_pet(user)}


def friendship_between(a, b):
    return Friendship.objects.filter(Q(from_user=a, to_user=b) | Q(from_user=b, to_user=a)).first()


def are_friends(a, b):
    f = friendship_between(a, b)
    return bool(f and f.accepted)


def friendship_json(f, me):
    if not f:
        return {'id': None, 'state': 'none'}
    state = 'friends' if f.accepted else 'outgoing' if f.from_user_id == me.id else 'incoming'
    return {'id': f.id, 'state': state}


def friends_payload(me):
    out = {'friends': [], 'incoming': [], 'outgoing': []}
    for f in Friendship.objects.filter(Q(from_user=me) | Q(to_user=me)).select_related('from_user', 'to_user').order_by('-created_at'):
        other = f.to_user if f.from_user_id == me.id else f.from_user
        out[friendship_json(f, me)['state']].append({'id': f.id, **person_json(other)})
    return out


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def friends(request):
    """GET → přátelé a žádosti, POST {nickname} → poslat žádost (když už protistrana žádala, rovnou přátelé)."""
    me = request.user
    if request.method == 'POST':
        other = Profile.objects.filter(nickname__iexact=str(request.data.get('nickname', '')).strip()).first()
        if not other:
            return err('NOT_FOUND', 'Hráč s touto přezdívkou neexistuje.', 404)
        if other.user_id == me.id:
            return err('SELF', 'Sám sebe si do přátel nepřidáš.')
        f = friendship_between(me, other.user)
        if f is None:
            Friendship.objects.get_or_create(from_user=me, to_user=other.user)
        elif not f.accepted and f.to_user_id == me.id:
            f.accepted = True
            f.save(update_fields=['accepted'])
    return Response(friends_payload(me))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def friend_accept(request, pk):
    f = get_object_or_404(Friendship, pk=pk, to_user=request.user)
    f.accepted = True
    f.save(update_fields=['accepted'])
    return Response(friends_payload(request.user))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def friend_remove(request, pk):
    """Odmítnout žádost, zrušit svou žádost nebo odebrat přítele."""
    get_object_or_404(Friendship.objects.filter(Q(from_user=request.user) | Q(to_user=request.user)), pk=pk).delete()
    return Response(friends_payload(request.user))


@api_view(['GET'])
@permission_classes([AllowAny])
def public_profile(request, nickname):
    prof = get_object_or_404(Profile.objects.select_related('user'), nickname=nickname)
    u = prof.user
    me = request.user if request.user.is_authenticated and request.user.id != u.id else None
    return Response({
        'friendship': me and friendship_json(friendship_between(me, u), me),
        'friends_count': Friendship.objects.filter(Q(from_user=u) | Q(to_user=u), accepted=True).count(),
        'rating': rating.refresh(u), 'top_pet': top_pet(u),
        'nickname': prof.nickname, 'level': prof.level, 'xp': prof.xp, 'school': prof.school, 'wins': prof.wins,
        'team': prof.team.name if prof.team else None,
        'stamps': u.checkins.filter(is_demo=False).count(),
        'badges': [{'code': ub.badge.code, 'name': ub.badge.name, 'icon': ub.badge.icon, 'awarded_at': ub.awarded_at}
                   for ub in u.badges.select_related('badge')],
        'pets': [pet_json(p) for p in u.pets.select_related('place', 'checkin')],
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def leaderboard(request):
    scope, metric = request.GET.get('scope', 'global'), request.GET.get('metric', 'stamps')
    if scope not in ('global', 'school', 'team') or metric not in ('stamps', 'wins'):
        return err('BAD_REQUEST', 'scope=global|school|team, metric=stamps|wins')
    key = f'leaderboard:{scope}:{metric}'
    rows = cache.get(key)
    if rows is None:
        # demo razítka se do žebříčků nepočítají (8.3)
        profiles = Profile.objects.annotate(stamps=Count('user__checkins', filter=Q(user__checkins__is_demo=False)))
        if scope == 'global':
            rows = [{'name': p.nickname, 'level': p.level, 'stamps': p.stamps, 'wins': p.wins}
                    for p in profiles.order_by(f'-{metric}', 'nickname')[:50]]
        else:
            # ponytail: agregace škol/týmů v Pythonu, stačí do tisíců hráčů
            schools = {}
            members = profiles.exclude(school='') if scope == 'school' else profiles.filter(team__isnull=False).select_related('team')
            for p in members:
                key = p.school if scope == 'school' else p.team.name
                s = schools.setdefault(key, {'name': key, 'stamps': 0, 'wins': 0, 'players': 0})
                s['stamps'] += p.stamps
                s['wins'] += p.wins
                s['players'] += 1
            rows = sorted(schools.values(), key=lambda r: -r[metric])[:50]
        cache.set(key, rows, 60)
    return Response(rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def quest_list(request):
    return Response(quests.quests_for(request.user))


@api_view(['GET'])
@permission_classes([AllowAny])
def trail_list(request):
    return Response(quests.trails_for(request.user))


@api_view(['GET'])
@permission_classes([AllowAny])
def food_pass(request):
    return Response(quests.food_pass(request.user))


def team_json(t):
    # týdenní výzva: každý člen přispěje třemi razítky (jako osobní quest), počítá se jen od pondělí a bez demo
    week = dict(CheckIn.objects.filter(user__profile__team=t, is_demo=False, created_at__date__gte=quests.week_start())
                .order_by().values_list('user__profile__nickname').annotate(n=Count('id')))
    members = list(t.members.order_by('-xp'))
    return {'name': t.name, 'join_code': t.join_code, 'owner': profile_of(t.owner).nickname,
            'members': [{'nickname': p.nickname, 'level': p.level, 'week': week.get(p.nickname, 0)} for p in members],
            'challenge': {'progress': sum(week.values()), 'target': 3 * len(members)}}


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def teams(request):
    """GET → můj tým, POST {name} → založit tým a vstoupit do něj."""
    prof = profile_of(request.user)
    if request.method == 'POST':
        name = str(request.data.get('name', '')).strip()
        if not 3 <= len(name) <= 60:
            return err('BAD_NAME', 'Název týmu musí mít 3–60 znaků.')
        if Team.objects.filter(name__iexact=name).exists():
            return err('NAME_TAKEN', 'Tým s tímto názvem už existuje.')
        prof.team = Team.objects.create(name=name, owner=request.user, join_code=secrets.token_hex(3).upper())
        prof.save(update_fields=['team'])
    return Response({'team': prof.team and team_json(prof.team)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def team_join(request):
    team = Team.objects.filter(join_code=str(request.data.get('join_code', '')).strip().upper()).first()
    if not team:
        return err('BAD_CODE', 'Tým s tímto kódem neexistuje.', 404)
    prof = profile_of(request.user)
    prof.team = team
    prof.save(update_fields=['team'])
    return Response({'team': team_json(team)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def team_leave(request):
    prof = profile_of(request.user)
    prof.team = None
    prof.save(update_fields=['team'])
    return Response({'team': None})
