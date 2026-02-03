from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0003_purchaseorder'),
    ]

    operations = [
        migrations.RenameField(
            model_name='stockmovement',
            old_name='qty',
            new_name='quantity',
        ),
        migrations.RenameField(
            model_name='stockmovement',
            old_name='direction',
            new_name='movement_type',
        ),
        migrations.AlterField(
            model_name='stockmovement',
            name='movement_type',
            field=models.CharField(choices=[('IN', 'IN'), ('OUT', 'OUT'), ('TRANSFER', 'TRANSFER')], default='IN', max_length=20),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='location_from',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='location_to',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='reference',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='note',
            field=models.TextField(blank=True, default=''),
        ),
    ]

