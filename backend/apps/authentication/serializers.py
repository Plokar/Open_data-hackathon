"""
JWT Authentication – Serializers
"""
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Rozšířený JWT serializer – přidá user data do tokenu."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Přidat custom claims do JWT payload
        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        return token


def is_claimed(user):
    """Onboarding zakládá účet jen se jménem: e-mail hrac-…@zapadgo.cz a náhodné heslo, které hráč nezná.
    Dokud si v profilu nenastaví vlastní e-mail a heslo, z jiného zařízení se k účtu nevrátí."""
    return not (user.email.startswith('hrac-') and user.email.endswith('@zapadgo.cz'))


class UserSerializer(serializers.ModelSerializer):
    """Serializer pro čtení dat uživatele."""
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'date_joined', 'profile']
        read_only_fields = ['id', 'is_staff', 'date_joined']

    def get_profile(self, user):
        from apps.game.views import profile_of
        p = profile_of(user)
        return {'nickname': p.nickname, 'level': p.level, 'xp': p.xp, 'school': p.school,
                'age_group': p.age_group, 'photo_public': p.photo_public, 'wins': p.wins,
                'account_claimed': is_claimed(user)}


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer pro registraci nového uživatele."""
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            message="Uživatel s tímto e-mailem již existuje."
        )]
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        label='Potvrzení hesla'
    )

    nickname = serializers.RegexField(r'^[\w.-]{3,30}$', required=False,
                                      error_messages={'invalid': 'Přezdívka: 3–30 znaků, písmena, čísla, . _ -'})
    age_group = serializers.ChoiceField(choices=['under18', 'adult'])
    consent_confirmed = serializers.BooleanField()
    school = serializers.CharField(required=False, allow_blank=True, max_length=120)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name',
                  'nickname', 'age_group', 'consent_confirmed', 'school']
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, attrs):
        from apps.game.models import Profile
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Hesla se neshodují."})
        if not attrs['consent_confirmed']:
            raise serializers.ValidationError({"consent_confirmed": "Bez souhlasu (u nezletilých zákonného zástupce) se nelze registrovat."})
        attrs['nickname'] = attrs.get('nickname') or attrs['username'][:30]
        if Profile.objects.filter(nickname__iexact=attrs['nickname']).exists():
            raise serializers.ValidationError({"nickname": "Přezdívka je obsazená."})
        return attrs

    def create(self, validated_data):
        from apps.game.models import Profile
        validated_data.pop('password2')
        profile = {k: validated_data.pop(k, '') for k in ('nickname', 'age_group', 'consent_confirmed', 'school')}
        user = User.objects.create_user(**validated_data)
        Profile.objects.create(user=user, **profile)
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer pro změnu hesla."""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password]
    )
    new_password2 = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Nesprávné aktuální heslo.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Nová hesla se neshodují."})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
