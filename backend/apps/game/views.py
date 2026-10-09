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

from apps.places.models import Place

from . import ai_hooks, anticheat, badges, pets, quests
from .models import Badge, CheckIn, Pet, Profile, Team, UserBadge

XP_BY_RARITY = {'common': 50, 'rare': 75, 'epic': 100, 'legendary': 150}


def err(code, detail, status=400, **extra):
    return Response({'error_code': code, 'detail': detail, **extra}, status=status)


def profile_of(user):
    return Profile.objects.get_or_create(user=user, defaults={'nickname': user.username[:30]})[0]


def pet_json(p):
    return {
        'id': p.id, 'name': p.name, 'species': p.species, 'type': p.type, 'rarity': p.rarity,
        'hp': p.hp, 'atk': p.atk, 'defense': p.defense, 'spd': p.spd, 'level': p.level, 'xp': p.xp,
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
                    verified=verified, is_demo=demo)
                spec = pets.generate(place.id, place.category, place.rarity, info['sha256'], user.id)
                pet = Pet.objects.create(owner=user, place=place, checkin=ci, verified=verified,
                                         lore=ai_hooks.generate_lore(spec, place), **spec)
                profile = profile_of(user)
                xp_gain = XP_BY_RARITY[place.rarity]
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
            'level': profile.level, 'new_badges': [{'code': b.code, 'name': b.name, 'icon': b.icon} for b in new_badges],
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


@api_view(['GET'])
@permission_classes([AllowAny])
def badge_list(request):
    return Response([badge_json(b, request.user) for b in Badge.objects.order_by('id')])


@api_view(['GET'])
@permission_classes([AllowAny])
def public_profile(request, nickname):
    prof = get_object_or_404(Profile.objects.select_related('user'), nickname=nickname)
    u = prof.user
    return Response({
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


def team_json(t):
    return {'name': t.name, 'join_code': t.join_code, 'owner': profile_of(t.owner).nickname,
            'members': [{'nickname': p.nickname, 'level': p.level} for p in t.members.order_by('-xp')]}


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
