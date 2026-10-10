"""AI příběhy pro tvory, kteří vznikli dřív než AI_LORE. Vyšlechtění a trofeje z bosů mají vlastní text, ty se nechávají."""
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.game import ai_hooks, pets
from apps.game.models import Pet


class Command(BaseCommand):
    help = 'Vygeneruje AI příběh tvorům z razítek, kteří mají jen šablonový (AI_LORE=True, AI_PROVIDER=gemini, GEMINI_API_KEY).'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true', help='Přepsat i příběhy, které už AI napsala')
        parser.add_argument('--delay', type=float, default=0, help='Pauza mezi dotazy v s (free tier Gemini má limit za minutu)')

    def handle(self, all, delay, **_):
        if not settings.AI_LORE:
            self.stderr.write('Nastav AI_LORE=True.')
            return
        done = failed = 0
        for p in Pet.objects.filter(checkin__isnull=False).select_related('place'):
            spec = {'species': p.species, 'type': p.type}
            template = pets.template_lore(spec, p.place)
            if not all and p.lore != template:
                continue
            p.lore = ai_hooks.generate_lore(spec, p.place)
            p.save(update_fields=['lore'])
            done, failed = done + (p.lore != template), failed + (p.lore == template)
            time.sleep(delay)
        self.stdout.write(f'Hotovo: {done} nových příběhů, {failed} selhalo (zůstala šablona, stačí spustit znovu).')
