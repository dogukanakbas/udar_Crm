import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('production', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='productionevent',
            name='raw_payload',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='productionevent',
            name='normalized_payload',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='productionevent',
            name='mapping_errors',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name='productionroutetemplate',
            name='product_group_key',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='productionworkorderline',
            name='route',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='work_order_lines',
                to='production.productionroutetemplate',
            ),
        ),
        migrations.CreateModel(
            name='ProductionTemplatePreset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=80, unique=True)),
                ('name', models.CharField(max_length=160)),
                ('description', models.TextField(blank=True, default='')),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['name', 'id']},
        ),
        migrations.CreateModel(
            name='ProductionStationUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('operator', 'Operator'), ('lead', 'Usta basi'), ('observer', 'Izleyici')], default='operator', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_station_users', to='organizations.organization')),
                ('station', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assigned_users', to='production.productionstation')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_station_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['station__code', 'user__username'], 'unique_together': {('organization', 'station', 'user')}},
        ),
        migrations.CreateModel(
            name='ProductionDataField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=80)),
                ('label', models.CharField(max_length=160)),
                ('field_type', models.CharField(choices=[('text', 'Metin'), ('number', 'Sayi'), ('boolean', 'Mantiksal'), ('datetime', 'Tarih saat'), ('json', 'JSON')], default='text', max_length=20)),
                ('source', models.CharField(choices=[('manual', 'Elle'), ('device', 'Cihaz'), ('calculated', 'Hesaplanan'), ('system', 'Sistem')], default='manual', max_length=20)),
                ('unit', models.CharField(blank=True, default='', max_length=40)),
                ('default_value', models.CharField(blank=True, default='', max_length=255)),
                ('config', models.JSONField(blank=True, default=dict)),
                ('is_visible', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_data_fields', to='organizations.organization')),
                ('station', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='data_fields', to='production.productionstation')),
            ],
            options={'ordering': ['station__code', 'order', 'id'], 'unique_together': {('organization', 'station', 'key')}},
        ),
        migrations.CreateModel(
            name='ProductionDevicePayloadMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_path', models.CharField(max_length=255)),
                ('target_key', models.CharField(max_length=80)),
                ('target_type', models.CharField(choices=[('text', 'Metin'), ('number', 'Sayi'), ('boolean', 'Mantiksal'), ('datetime', 'Tarih saat'), ('json', 'JSON')], default='text', max_length=20)),
                ('default_value', models.CharField(blank=True, default='', max_length=255)),
                ('is_required', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('data_field', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payload_maps', to='production.productiondatafield')),
                ('device', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payload_maps', to='production.productiondevice')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_device_maps', to='organizations.organization')),
                ('station', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='payload_maps', to='production.productionstation')),
            ],
            options={'ordering': ['device__name', 'order', 'id']},
        ),
        migrations.CreateModel(
            name='ProductionRuleSet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=160)),
                ('scope', models.CharField(choices=[('global', 'Genel'), ('station', 'Istasyon'), ('route', 'Rota')], default='station', max_length=20)),
                ('trigger_event', models.CharField(choices=[('pi_event', 'RPi verisi'), ('ui_event', 'Konsol islemi'), ('step_completed', 'Istasyon tamamlandi'), ('manual', 'Elle')], default='pi_event', max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_rule_sets', to='organizations.organization')),
                ('route', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rule_sets', to='production.productionroutetemplate')),
                ('station', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rule_sets', to='production.productionstation')),
            ],
            options={'ordering': ['order', 'id']},
        ),
        migrations.CreateModel(
            name='ProductionRuleBlock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('block_type', models.CharField(choices=[('condition', 'Kosul'), ('assign', 'Atama'), ('increment_quantity', 'Adet ekle'), ('change_status', 'Durum degistir'), ('open_next_step', 'Sonraki istasyonu ac'), ('stock_in', 'Depoya giris')], max_length=30)),
                ('config', models.JSONField(blank=True, default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_rule_blocks', to='organizations.organization')),
                ('rule_set', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='blocks', to='production.productionruleset')),
            ],
            options={'ordering': ['rule_set__order', 'order', 'id']},
        ),
    ]
