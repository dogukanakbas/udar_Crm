# Generated manually for dynamic production shift schedules.

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0008_alter_productioncountingwindow_line_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductionShiftSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('weekdays', models.JSONField(blank=True, default=list)),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('crosses_midnight', models.BooleanField(default=False)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shift_schedules', to='production.productiondepartment')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_shift_schedules', to='organizations.organization')),
            ],
            options={
                'ordering': ['department__order', 'order', 'start_time', 'id'],
            },
        ),
        migrations.CreateModel(
            name='ProductionShiftBreak',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('requires_checkpoint', models.BooleanField(default=True)),
                ('lock_type', models.CharField(choices=[('break_locked', 'Planli mola'), ('checkpoint_only', 'Sadece checkpoint')], default='break_locked', max_length=30)),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shift_breaks', to='production.productiondepartment')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_shift_breaks', to='organizations.organization')),
                ('schedule', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='breaks', to='production.productionshiftschedule')),
            ],
            options={
                'ordering': ['department__order', 'order', 'start_time', 'id'],
            },
        ),
        migrations.CreateModel(
            name='ProductionShiftOccurrence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('report_date', models.DateField(db_index=True)),
                ('starts_at', models.DateTimeField(db_index=True)),
                ('ends_at', models.DateTimeField(db_index=True)),
                ('status', models.CharField(choices=[('active', 'Aktif'), ('closed', 'Kapandi')], default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shift_occurrences', to='production.productiondepartment')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_shift_occurrences', to='organizations.organization')),
                ('schedule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='occurrences', to='production.productionshiftschedule')),
            ],
            options={
                'ordering': ['-starts_at', '-id'],
                'unique_together': {('organization', 'schedule', 'report_date', 'starts_at')},
            },
        ),
        migrations.AlterField(
            model_name='productioncountingwindow',
            name='close_reason',
            field=models.CharField(blank=True, choices=[('login', 'Yeni kisi girisi'), ('break_start', 'Mola baslangici'), ('break_end', 'Mola donusu'), ('logout', 'Cikis'), ('work_complete', 'Is emri tamamlandi'), ('shift_end', 'Vardiya sonu'), ('scheduled_break', 'Planli mola'), ('manual', 'Manuel checkpoint')], default='', max_length=30),
        ),
        migrations.CreateModel(
            name='ProductionShiftCheckpoint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(choices=[('shift_end', 'Vardiya sonu'), ('scheduled_break', 'Planli mola'), ('manual', 'Manuel')], default='manual', max_length=30)),
                ('participant_totals', models.JSONField(blank=True, default=dict)),
                ('official_delta', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('break_row', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='checkpoints', to='production.productionshiftbreak')),
                ('occurrence', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='checkpoints', to='production.productionshiftoccurrence')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_shift_checkpoints', to='organizations.organization')),
                ('station', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='shift_checkpoints', to='production.productionstation')),
                ('tablet', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='shift_checkpoints', to='production.productionstationtablet')),
                ('window', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='shift_checkpoints', to='production.productioncountingwindow')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='productionshiftschedule',
            index=models.Index(fields=['organization', 'is_active'], name='production__organiz_c4887f_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftschedule',
            index=models.Index(fields=['department', 'is_active'], name='production__departm_e79d2b_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftbreak',
            index=models.Index(fields=['organization', 'is_active'], name='production__organiz_e75cd1_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftbreak',
            index=models.Index(fields=['department', 'is_active'], name='production__departm_7e0255_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftbreak',
            index=models.Index(fields=['schedule', 'is_active'], name='production__schedul_9ccd79_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftoccurrence',
            index=models.Index(fields=['organization', 'report_date'], name='production__organiz_6828ee_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftoccurrence',
            index=models.Index(fields=['department', 'starts_at', 'ends_at'], name='production__departm_7c412f_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftcheckpoint',
            index=models.Index(fields=['organization', 'created_at'], name='production__organiz_6d5029_idx'),
        ),
        migrations.AddIndex(
            model_name='productionshiftcheckpoint',
            index=models.Index(fields=['station', 'created_at'], name='production__station_d9701d_idx'),
        ),
    ]
