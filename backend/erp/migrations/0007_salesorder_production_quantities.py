from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0006_vehicle'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesorder',
            name='order_quantity',
            field=models.PositiveIntegerField(default=0, help_text='Sipariş adedi (üretim takibi)'),
        ),
        migrations.AddField(
            model_name='salesorder',
            name='quantity_produced',
            field=models.PositiveIntegerField(default=0, help_text='Raporlanan tamamlanan adet'),
        ),
    ]
