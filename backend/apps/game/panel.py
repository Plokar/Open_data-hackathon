"""Admin „cheat“ panel (/panel na frontendu): správa hráčů, tvorů a odznaků.

Přístup jen přes jméno a heslo z .env (ADMIN_PANEL_USERNAME / ADMIN_PANEL_PASSWORD, výchozí admin/admin).
Po přihlášení dostane prohlížeč podepsaný token (django.core.signing, platí 12 h), který posílá
v hlavičce `Authorization: Panel <token>`. Na hráčské účty a JWT to nesahá.
"""
import hmac

from django.conf import settings
from django.contrib.auth.models import User
from django.core import signing
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.battles.models import Battle

from . import pets, rating
from .models import Badge, CheckIn, Pet, Profile, UserBadge
from .views import err, profile_of

SALT = 'zapadgo-panel'
TOKEN_AGE = 12 * 3600


class PanelToken(BasePermission):
    def has_permission(self, request, view):
        kind, _, token = request.headers.get('Authorization', '').partition(' ')
        if kind != 'Panel':
            return False
        try:
            return signing.loads(token, salt=SALT, max_age=TOKEN_AGE) == {'panel': settings.ADMIN_PANEL_USERNAME}
        except signing.BadSignature:
            return False


def panel_view(methods):
    """Panel endpoint: bez JWT/session autentizace, jen token panelu, bez obecného throttlingu."""
    def wrap(fn):
        fn = permission_classes([PanelToken])(fn)
        fn = authentication_classes([])(fn)
        fn = throttle_classes([])(fn)
        return api_view(methods)(fn)
    return wrap


class PanelLoginThrottle(ScopedRateThrottle):
    scope = 'panel_login'


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PanelLoginThrottle])
def login(request):
    ok_user = hmac.compare_digest(str(request.data.get('username', '')), settings.ADMIN_PANEL_USERNAME)
    ok_pass = hmac.compare_digest(str(request.data.get('password', '')), settings.ADMIN_PANEL_PASSWORD)
    if not (ok_user and ok_pass):
        return err('BAD_LOGIN', 'Špatné jméno nebo heslo panelu.', 401)
    return Response({'token': signing.dumps({'panel': settings.ADMIN_PANEL_USERNAME}, salt=SALT),
                     'default_credentials': settings.ADMIN_PANEL_PASSWORD == 'admin'})


@panel_view(['GET'])
def stats(request):
    return Response({
        'users': User.objects.count(), 'pets': Pet.objects.count(),
        'checkins': CheckIn.objects.filter(is_demo=False).count(), 'demo_checkins': CheckIn.objects.filter(is_demo=True).count(),
        'battles': Battle.objects.filter(status='finished').count(),
        'injured': Pet.objects.filter(injured_until__gt=timezone.now()).count(),
    })


def _user_row(u):
    from apps.authentication.serializers import is_claimed
    p = profile_of(u)
    return {'id': u.id, 'username': u.username, 'nickname': p.nickname, 'first_name': u.first_name, 'email': u.email,
            'claimed': is_claimed(u), 'is_staff': u.is_staff, 'level': p.level, 'xp': p.xp, 'wins': p.wins,
            'rating': p.rating, 'school': p.school, 'stamps': getattr(u, 'n_stamps', None), 'pets': getattr(u, 'n_pets', None),
            'date_joined': u.date_joined, 'last_login': u.last_login}


@panel_view(['GET'])
def users(request):
    q = request.GET.get('q', '').strip()
    qs = User.objects.select_related('profile').annotate(n_stamps=Count('checkins', distinct=True), n_pets=Count('pets', distinct=True))
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) | Q(profile__nickname__icontains=q) | Q(first_name__icontains=q))
    return Response([_user_row(u) for u in qs.order_by('-date_joined')[:200]])


def _pet_row(p):
    return {'id': p.id, 'name': p.name, 'species': p.species, 'type': p.type, 'rarity': p.rarity, 'seed': p.seed,
            'level': p.level, 'xp': p.xp, 'stage': p.stage, 'place': p.place.name,
            'injured': bool(p.injured_until and p.injured_until > timezone.now())}


def _detail(u):
    rating.refresh(u)
    u = User.objects.annotate(n_stamps=Count('checkins', distinct=True), n_pets=Count('pets', distinct=True)).get(pk=u.pk)
    owned = set(u.badges.values_list('badge__code', flat=True))
    return {**_user_row(u),
            'pets': [_pet_row(p) for p in u.pets.select_related('place').order_by('-level')],
            'badges': [{'code': b.code, 'name': b.name, 'icon': b.icon, 'owned': b.code in owned} for b in Badge.objects.order_by('id')]}


@panel_view(['GET', 'PATCH', 'DELETE'])
def user_detail(request, pk):
    u = get_object_or_404(User, pk=pk)
    if request.method == 'DELETE':
        for c in u.checkins.exclude(photo=''):
            c.photo.delete(save=False)
        u.delete()
        return Response(status=204)
    if request.method == 'PATCH':
        d, prof = request.data, profile_of(u)
        if 'nickname' in d:
            nick = str(d['nickname']).strip()
            if not 2 <= len(nick) <= 30:
                return err('BAD_NICKNAME', 'Přezdívka musí mít 2–30 znaků.')
            if Profile.objects.filter(nickname__iexact=nick).exclude(pk=prof.pk).exists():
                return err('NICKNAME_TAKEN', 'Přezdívka je obsazená.')
            prof.nickname = nick
        if 'email' in d:
            email = str(d['email']).strip().lower()
            if email and User.objects.filter(email__iexact=email).exclude(pk=u.pk).exists():
                return err('EMAIL_TAKEN', 'E-mail už používá jiný účet.')
            u.email = email
        for f in ('first_name',):
            if f in d:
                setattr(u, f, str(d[f])[:150])
        if 'is_staff' in d:
            u.is_staff = bool(d['is_staff'])
        if 'school' in d:
            prof.school = str(d['school'])[:120]
        for f in ('xp', 'wins'):
            if f in d:
                try:
                    setattr(prof, f, max(0, int(d[f])))
                except (TypeError, ValueError):
                    return err('BAD_NUMBER', f'{f} musí být číslo.')
        prof.level = 1 + prof.xp // 200  # stejně jako Profile.add_xp
        if d.get('password'):
            if len(str(d['password'])) < 6:
                return err('SHORT_PASSWORD', 'Heslo musí mít aspoň 6 znaků.')
            u.set_password(str(d['password']))
        u.save()
        prof.save()
    return Response(_detail(u))


@panel_view(['POST'])
def user_badge(request, pk):
    u = get_object_or_404(User, pk=pk)
    badge = get_object_or_404(Badge, code=request.data.get('code'))
    if request.data.get('award', True):
        UserBadge.objects.get_or_create(user=u, badge=badge)
    else:
        UserBadge.objects.filter(user=u, badge=badge).delete()
    return Response(_detail(u))


@panel_view(['PATCH', 'DELETE'])
def pet_detail(request, pk):
    p = get_object_or_404(Pet.objects.select_related('owner'), pk=pk)
    owner = p.owner
    if request.method == 'DELETE':
        p.delete()
        return Response(_detail(owner))
    d = request.data
    if 'name' in d and 1 <= len(str(d['name']).strip()) <= 40:
        p.name = str(d['name']).strip()
    if 'level' in d:
        p.level = min(pets.MAX_LEVEL, max(1, int(d['level'])))
        p.xp = pets.xp_for_level(p.level)  # XP na začátek levelu, ať level a XP sedí
    if 'stage' in d:
        p.stage = min(3, max(1, int(d['stage'])))
    if d.get('rarity') in pets.RARITY_MULT:
        p.rarity = d['rarity']
    if d.get('heal'):
        p.injured_until = None
    p.save()
    return Response(_detail(owner))


@panel_view(['POST'])
def action(request):
    """Hromadné cheaty: vyléčit všechny tvory, přepočítat hodnocení."""
    kind = request.data.get('action')
    if kind == 'heal_all':
        n = Pet.objects.filter(injured_until__gt=timezone.now()).update(injured_until=None)
        return Response({'message': f'Vyléčeno tvorů: {n}.'})
    if kind == 'recompute_ratings':
        for u in User.objects.all():
            rating.refresh(u)
        return Response({'message': 'Hodnocení přepočítáno.'})
    return err('BAD_ACTION', 'Neznámá akce.')
