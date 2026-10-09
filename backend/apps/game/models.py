from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.db import models

from apps.places.models import Place


def private_storage():
    """Fotky z check-inů leží mimo MEDIA_ROOT a servíruje je jen endpoint s kontrolou vlastníka."""
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)


class Team(models.Model):
    name = models.CharField(max_length=60, unique=True)
    join_code = models.CharField(max_length=8, unique=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_teams')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    nickname = models.CharField(max_length=30, unique=True)
    age_group = models.CharField(max_length=10, choices=[('under18', 'under18'), ('adult', 'adult')], default='adult')
    consent_confirmed = models.BooleanField(default=False)
    school = models.CharField(max_length=120, blank=True, db_index=True)
    xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    rating = models.IntegerField(default=1000)
    wins = models.IntegerField(default=0)
    photo_public = models.BooleanField(default=False)
    # ponytail: členství jako FK na profilu (1 tým na hráče) místo tabulky TeamMember
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')

    def __str__(self):
        return self.nickname

    def add_xp(self, amount):
        """Přičte XP, vrátí True při level-upu."""
        old = self.level
        self.xp += amount
        self.level = 1 + self.xp // 200
        return self.level > old


class CheckIn(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='checkins')
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='checkins')
    lat = models.FloatField()
    lon = models.FloatField()
    accuracy_m = models.FloatField()
    distance_m = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    photo = models.ImageField(upload_to='checkins/%Y/%m/', storage=private_storage, blank=True)
    photo_sha256 = models.CharField(max_length=64, blank=True, db_index=True)
    photo_phash = models.CharField(max_length=16, blank=True)
    exif_status = models.CharField(max_length=10, default='missing')  # ok / missing / mismatch
    trust = models.IntegerField(default=100)
    verified = models.BooleanField(default=False)
    is_demo = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'place'], name='uniq_checkin_user_place')]
        ordering = ['-created_at']


class Pet(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pets')
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='pets')
    checkin = models.OneToOneField(CheckIn, on_delete=models.CASCADE, related_name='pet')
    species = models.CharField(max_length=40)
    type = models.CharField(max_length=20)
    name = models.CharField(max_length=40)
    rarity = models.CharField(max_length=12)
    hp = models.IntegerField()
    atk = models.IntegerField()
    defense = models.IntegerField()
    spd = models.IntegerField()
    level = models.IntegerField(default=1)
    xp = models.IntegerField(default=0)
    seed = models.BigIntegerField()
    lore = models.TextField(blank=True)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Badge(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=300)
    rule = models.JSONField()
    icon = models.CharField(max_length=8, default='🏅')


class UserBadge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE)
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'badge'], name='uniq_user_badge')]
