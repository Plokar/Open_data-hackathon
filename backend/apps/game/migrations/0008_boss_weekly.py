from django.db import migrations, models


class Migration(migrations.Migration):
    """Bosové týdne: záznam = pokus o souboj (jednou za týden), výhra se jen označí."""

    dependencies = [
        ("game", "0007_breeding_bosses"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="bosswin", name="uniq_boss_win"),
        migrations.RenameField(model_name="bosswin", old_name="day", new_name="week"),
        migrations.AddField(model_name="bosswin", name="won", field=models.BooleanField(default=False)),
        # dosavadní záznamy byly výhry
        migrations.RunSQL("UPDATE game_bosswin SET won = true", migrations.RunSQL.noop),
        migrations.AddConstraint(
            model_name="bosswin",
            constraint=models.UniqueConstraint(fields=("user", "place", "week"), name="uniq_boss_win"),
        ),
    ]
