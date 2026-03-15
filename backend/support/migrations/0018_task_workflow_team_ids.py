# Generated migration for workflow_team_ids

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0017_taskmodel'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='workflow_team_ids',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
