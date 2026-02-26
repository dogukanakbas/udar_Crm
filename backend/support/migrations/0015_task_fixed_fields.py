from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('support', '0014_task_planning'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='mode',
            field=models.CharField(choices=[('manual', 'manual'), ('fixed', 'fixed')], default='manual', max_length=20),
        ),
        migrations.AddField(
            model_name='task',
            name='model_code',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='task',
            name='variant',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='task',
            name='quantity',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='task',
            name='model_duration_minutes',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name='task',
            name='total_planned_minutes',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='task',
            name='model_blade_depth',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='task',
            name='model_sizes',
            field=models.JSONField(blank=True, default=list),
        ),
    ]

