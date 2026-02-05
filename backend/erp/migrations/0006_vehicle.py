from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('erp', '0005_product_stock_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Vehicle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('plate', models.CharField(max_length=64, unique=True)),
                ('driver', models.CharField(blank=True, default='', max_length=255)),
                ('status', models.CharField(default='Yolda', max_length=64)),
                ('last_update', models.DateTimeField(auto_now=True)),
                ('location_city', models.CharField(blank=True, default='', max_length=128)),
                ('location_lat', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('location_lng', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('distance_today', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('avg_speed', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('idle_minutes', models.IntegerField(default=0)),
                ('stops', models.IntegerField(default=0)),
                ('eta', models.DateTimeField(blank=True, null=True)),
                ('temperature', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vehicles', to='organizations.organization')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]


