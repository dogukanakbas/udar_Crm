# Generated manually for station tablet workflow

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0004_productionstepprogress_machine_quantity_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductionOperatorProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pin_hash', models.CharField(blank=True, default='', max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('last_pin_change_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_operator_profiles', to='organizations.organization')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='production_operator_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['user__first_name', 'user__username'],
            },
        ),
        migrations.CreateModel(
            name='ProductionStationTablet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('token', models.CharField(max_length=128, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_station_tablets', to='organizations.organization')),
                ('station', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tablets', to='production.productionstation')),
            ],
            options={
                'ordering': ['station__code', 'name'],
            },
        ),
        migrations.AddField(
            model_name='productionworksession',
            name='slot_index',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='productionworksession',
            name='tablet',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sessions', to='production.productionstationtablet'),
        ),
        migrations.CreateModel(
            name='ProductionSessionBreak',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('started_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('ended_at', models.DateTimeField(blank=True, null=True)),
                ('note', models.TextField(blank=True, default='')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_session_breaks', to='organizations.organization')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='breaks', to='production.productionworksession')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='production_session_breaks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-started_at', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ProductionStationAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('target_type', models.CharField(choices=[('station', 'Istasyon'), ('department', 'Bolum'), ('work_order', 'Is emri')], default='station', max_length=20)),
                ('title', models.CharField(max_length=160)),
                ('message', models.TextField()),
                ('severity', models.CharField(default='info', max_length=20)),
                ('requires_ack', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_production_alerts', to=settings.AUTH_USER_MODEL)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='alerts', to='production.productiondepartment')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_station_alerts', to='organizations.organization')),
                ('station', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='alerts', to='production.productionstation')),
                ('work_order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='station_alerts', to='production.productionworkorder')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ProductionStationAlertAck',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('acknowledged_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('alert', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='acks', to='production.productionstationalert')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_station_alert_acks', to='organizations.organization')),
                ('tablet', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='alert_acks', to='production.productionstationtablet')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='production_alert_acks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-acknowledged_at', '-id'],
                'unique_together': {('alert', 'tablet', 'user')},
            },
        ),
        migrations.AddIndex(
            model_name='productionsessionbreak',
            index=models.Index(fields=['organization', 'ended_at'], name='production__organiz_7cda06_idx'),
        ),
        migrations.AddIndex(
            model_name='productionsessionbreak',
            index=models.Index(fields=['session', 'ended_at'], name='production__session_166528_idx'),
        ),
    ]
