from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('support', '0015_task_fixed_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='current_team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tasks_current', to='accounts.team'),
        ),
        migrations.AddField(
            model_name='task',
            name='handover_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='handover_history',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='task',
            name='handover_reason',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='tasktimeentry',
            name='section',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='tasktimeentry',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.team'),
        ),
    ]

