from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_team'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='notification_prefs',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

