from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0013_taskattachment_tags'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='planned_cost',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='task',
            name='planned_hours',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
    ]

