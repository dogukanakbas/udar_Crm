from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0012_rename_production__organiz_996969_idx_production__organiz_d0c291_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='productionstation',
            name='default_daily_target',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
    ]
