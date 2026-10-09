"""Staff demo účty pro prezentaci (tlačítko „Demo razítko“ funguje jen s DEMO_MODE=True)."""
import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from apps.game.models import Profile


class Command(BaseCommand):
    help = 'Vytvoří/aktualizuje staff účty demo1 a demo2 (heslo z DEMO_PASSWORD).'

    def handle(self, *args, **opts):
        password = os.environ.get('DEMO_PASSWORD')
        if not password:
            self.stderr.write('Nastav DEMO_PASSWORD.')
            return
        for name in ('demo1', 'demo2'):
            user, _ = User.objects.get_or_create(username=name, defaults={'email': f'{name}@zapadgo.invalid'})
            user.is_staff = True
            user.set_password(password)
            user.save()
            Profile.objects.get_or_create(user=user, defaults={'nickname': name, 'consent_confirmed': True, 'school': 'Demo tým'})
            self.stdout.write(f'OK {name}')
