import uuid

from django.contrib.auth.models import User
from django.db import models

from apps.game.models import Pet


class Battle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='battles_a')
    player_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='battles_b', null=True, blank=True)  # null = bot
    pet_a = models.ForeignKey(Pet, on_delete=models.SET_NULL, null=True, related_name='+')
    pet_b = models.ForeignKey(Pet, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    invited = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='battle_invites')  # výzva příteli
    mode = models.CharField(max_length=10, choices=[(m, m) for m in ('ranked', 'friendly', 'practice')])
    status = models.CharField(max_length=10, default='waiting', db_index=True,
                              choices=[(s, s) for s in ('waiting', 'active', 'finished', 'abandoned')])
    seed = models.BigIntegerField()
    winner = models.CharField(max_length=5, blank=True)  # a / b / draw
    # state: {"a": fighter, "b": fighter, "turn": n, "pending": {"a": move, "b": move}, "deadline": iso, "start": {...}}
    state = models.JSONField(default=dict)
    log = models.JSONField(default=list)  # [{"turn", "moves": {"a","b"}, "events": [...]}]
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
