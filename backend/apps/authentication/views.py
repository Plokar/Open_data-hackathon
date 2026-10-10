"""
JWT Authentication – Views
Náhrada session auth za stateless JWT tokeny.
Endpoints:
  POST /api/auth/register/       – Registrace, vrátí JWT
  POST /api/auth/token/          – Login (obtain JWT pair)
  POST /api/auth/token/refresh/  – Refresh access tokenu
  POST /api/auth/token/verify/   – Ověření access tokenu
  POST /api/auth/logout/         – Blacklist refresh tokenu
  GET  /api/auth/me/             – Profil přihlášeného uživatele
  PUT  /api/auth/me/             – Aktualizace profilu
  POST /api/auth/change-password/ – Změna hesla
"""
import logging
from django.contrib.auth.models import User
from django.conf import settings
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
)

logger = logging.getLogger(__name__)

# ── Konstanty pro cookie nastavení ────────────────────────────────────────────
COOKIE_SETTINGS = {
    'httponly': settings.SIMPLE_JWT.get('AUTH_COOKIE_HTTP_ONLY', True),
    'secure': settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', not settings.DEBUG),
    'samesite': settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax'),
    'path': settings.SIMPLE_JWT.get('AUTH_COOKIE_PATH', '/'),
    'domain': settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN'),
}


def set_jwt_cookies(response: Response, refresh_token) -> Response:
    """Nastaví JWT tokeny jako httpOnly cookies."""
    access_token = str(refresh_token.access_token)
    refresh_str = str(refresh_token)

    response.set_cookie(
        key=settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token'),
        value=access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        **COOKIE_SETTINGS,
    )
    response.set_cookie(
        key=settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
        value=refresh_str,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        **COOKIE_SETTINGS,
    )
    return response


def clear_jwt_cookies(response: Response) -> Response:
    """Smaže JWT cookies (logout)."""
    domain = settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN')
    response.delete_cookie(settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token'), domain=domain)
    response.delete_cookie(settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'), domain=domain)
    return response


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Registrace nového uživatele – vrátí JWT tokeny.
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        response = Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': 'Registrace proběhla úspěšně.',
        }, status=status.HTTP_201_CREATED)

        set_jwt_cookies(response, refresh)
        logger.info(f"New user registered: {user.username} ({user.email})")
        return response


def resolve_username(ident):
    """Přihlášení přezdívkou, e-mailem nebo přímo username."""
    if User.objects.filter(username=ident).exists():
        return ident
    from django.db.models import Q
    u = User.objects.filter(Q(email__iexact=ident) if '@' in ident else Q(profile__nickname__iexact=ident)).first()
    return u.username if u else ident


class CredentialsView(APIView):
    """
    POST /api/auth/credentials/ {email, password, password2, current_password?}
    Účet ze jména si hráč „pojistí“ e-mailem a heslem (staré náhodné heslo nezná, proto ho nechceme).
    U už pojištěného účtu je potřeba aktuální heslo; heslo je pak nepovinné (jen změna e-mailu).
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        from django.core.validators import validate_email
        from .serializers import is_claimed
        user, d = request.user, request.data
        claimed = is_claimed(user)
        if claimed and not user.check_password(str(d.get('current_password', ''))):
            return Response({'current_password': ['Aktuální heslo nesedí.']}, status=status.HTTP_400_BAD_REQUEST)
        email, pw, pw2 = str(d.get('email', '')).strip().lower(), str(d.get('password', '')), str(d.get('password2', ''))
        errors = {}
        try:
            validate_email(email)
            if email.endswith('@zapadgo.cz') and email.startswith('hrac-'):
                raise ValidationError('Zadej svůj vlastní e-mail.')
        except ValidationError as e:
            errors['email'] = [e.messages[0] if e.messages[0] != 'Enter a valid email address.' else 'Zadej platný e-mail.']
        if 'email' not in errors and User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            errors['email'] = ['Tenhle e-mail už používá jiný účet.']
        if pw or not claimed:
            if pw != pw2:
                errors['password'] = ['Hesla se neshodují.']
            else:
                try:
                    validate_password(pw, user)
                except ValidationError as e:
                    errors['password'] = e.messages
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        user.email = email
        if pw:
            user.set_password(pw)
        user.save()
        logger.info(f"Credentials set for {user.username} (claimed before: {claimed})")
        return Response(UserSerializer(user).data)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/auth/token/
    Login – vrátí JWT access + refresh token (v body i cookies).
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request, *args, **kwargs):
        # Formulář posílá přezdívku (nebo e-mail), ale onboarding zakládá username „prezdivka_ab12cd“
        payload = {'username': resolve_username(str(request.data.get('username', '')).strip()),
                   'password': request.data.get('password', '')}
        serializer = self.get_serializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        data = serializer.validated_data
        user = User.objects.get(username=payload['username'])
        refresh = RefreshToken.for_user(user)

        response_data = {
            'user': UserSerializer(user).data,
            'access': data['access'],
            'refresh': data['refresh'],
        }
        response = Response(response_data, status=status.HTTP_200_OK)
        set_jwt_cookies(response, refresh)

        logger.info(f"User logged in: {user.username}")
        return response


class CustomTokenRefreshView(TokenRefreshView):
    """
    POST /api/auth/token/refresh/
    Refresh access tokenu – přijme refresh z body nebo cookie.
    """
    def post(self, request, *args, **kwargs):
        # Pokud není refresh v body, vzít cookie (request.data se mutovat nedá, prázdné tělo je obyčejný dict)
        refresh_token = request.data.get('refresh') or request.COOKIES.get(
            settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
        )
        serializer = self.get_serializer(data={'refresh': refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e

        response = Response(serializer.validated_data)
        # Po rotaci je v datech nový refresh token, cookies musí dostat ten
        set_jwt_cookies(response, RefreshToken(serializer.validated_data.get('refresh', refresh_token)))
        return response


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklistuje refresh token a smaže cookies.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = (
                request.data.get('refresh')
                or request.COOKIES.get(settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'))
            )
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                logger.info(f"User logged out: {request.user.username}")

            response = Response({'message': 'Odhlášení proběhlo úspěšně.'})
            clear_jwt_cookies(response)
            return response

        except TokenError:
            response = Response({'message': 'Odhlášeno (token již byl invalidován).'})
            clear_jwt_cookies(response)
            return response


class UserProfileView(APIView):
    """
    GET    /api/auth/me/  – Profil přihlášeného uživatele
    PUT    /api/auth/me/  – Aktualizace profilu
    DELETE /api/auth/me/  – Smazání účtu i fotek
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        if 'photo_public' in request.data:  # soukromí fotek z razítek (výchozí: soukromé)
            from apps.game.views import profile_of
            profile = profile_of(request.user)
            profile.photo_public = str(request.data['photo_public']).lower() in ('1', 'true')
            profile.save(update_fields=['photo_public'])
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        """DELETE /api/auth/me/ – smaže účet včetně razítek, PETů a souborů fotek (PROJECT_SPEC 12.4)."""
        for checkin in request.user.checkins.exclude(photo=''):
            checkin.photo.delete(save=False)
        request.user.delete()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_jwt_cookies(response)
        return response


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Změna hesla – invaliduje všechny refresh tokeny uživatele.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Invalidovat všechny refresh tokeny uživatele
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            tokens = OutstandingToken.objects.filter(user=request.user)
            for token in tokens:
                BlacklistedToken.objects.get_or_create(token=token)
        except Exception:
            pass  # Token blacklist nemusí být nainstalován

        response = Response({'message': 'Heslo bylo úspěšně změněno. Přihlaste se znovu.'})
        clear_jwt_cookies(response)
        return response


@api_view(['GET'])
@permission_classes([AllowAny])
def check_auth_status(request):
    """
    GET /api/auth/status/
    Kontrola stavu autentizace (pro client-side auth check).
    """
    if request.user.is_authenticated:
        return Response({
            'authenticated': True,
            'user': UserSerializer(request.user).data,
        })
    # Refresh cookie je httpOnly: klient se tu dozví, jestli má smysl zkusit obnovit prošlý access token
    can_refresh = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token') in request.COOKIES
    return Response({'authenticated': False, 'user': None, 'can_refresh': can_refresh})


class ForgotPasswordView(APIView):
    """
    POST /api/auth/forgot-password/
    Zašle e-mail s resetovacím odkazem do Mailhogu.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email je povinný.'}, status=status.HTTP_400_BAD_REQUEST)

        users = User.objects.filter(email=email)
        if users.exists():
            user = users.first()
            from django.contrib.auth.tokens import default_token_generator
            from django.utils.http import urlsafe_base64_encode
            from django.utils.encoding import force_bytes
            from services.email_service import send_hackathon_email

            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

            subject = "Obnova hesla – ZÁPAD GO"
            body = f"Ahoj {user.username},\n\npro obnovu hesla klikni na odkaz:\n{reset_url}\n\nOdkaz je platný 24 hodin."
            html_body = f"""
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Obnova hesla</h2>
              <p>Ahoj <b>{user.username}</b>,</p>
              <p>obdrželi jsme žádost o obnovu tvého hesla v ZÁPAD GO.</p>
              <p><a href="{reset_url}" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Nastavit nové heslo</a></p>
              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Pokud jsi o změnu nežádal/a, tento email ignoruj.</p>
            </div>
            """
            send_hackathon_email(to=email, subject=subject, body=body, html_body=html_body)

        return Response({
            'message': 'Pokud je zadaný e-mail v systému, poslali jsme na něj odkaz pro obnovu hesla.'
        })


class ResetPasswordView(APIView):
    """
    POST /api/auth/reset-password/
    Nastaví nové heslo na základě tokenu.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        new_password2 = request.data.get('new_password2')

        if not all([uidb64, token, new_password]):
            return Response({'error': 'Chybí povinné parametry (uid, token, new_password).'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != new_password2:
            return Response({'error': 'Hesla se neshodují.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'Heslo musí mít alespoň 8 znaků.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from django.contrib.auth.tokens import default_token_generator
            from django.utils.http import urlsafe_base64_decode
            from django.utils.encoding import force_str

            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Neplatný uživatel nebo token.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Token je neplatný nebo již expiroval.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Heslo bylo úspěšně nastaveno. Nyní se můžete přihlásit.'})

