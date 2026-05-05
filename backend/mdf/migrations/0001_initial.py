# Generated manually for mdf app

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('organizations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MdfSku',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('thickness_mm', models.PositiveSmallIntegerField()),
                ('width_cm', models.PositiveSmallIntegerField()),
                ('height_cm', models.PositiveSmallIntegerField()),
                ('min_threshold', models.PositiveIntegerField(default=10)),
                ('quantity', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='mdf_skus',
                        to='organizations.organization',
                    ),
                ),
            ],
            options={
                'ordering': ['thickness_mm', 'width_cm', 'height_cm'],
            },
        ),
        migrations.CreateModel(
            name='MdfMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('in', 'Giriş'), ('out', 'Çıkış')], max_length=8)),
                ('quantity', models.PositiveIntegerField()),
                ('movement_date', models.DateField(db_index=True)),
                ('note', models.CharField(blank=True, default='', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='mdf_movements',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='mdf_movements',
                        to='organizations.organization',
                    ),
                ),
                (
                    'sku',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='movements',
                        to='mdf.mdfsku',
                    ),
                ),
            ],
            options={
                'ordering': ['-movement_date', '-created_at', '-id'],
            },
        ),
        migrations.AddConstraint(
            model_name='mdfsku',
            constraint=models.UniqueConstraint(
                fields=('organization', 'thickness_mm', 'width_cm', 'height_cm'),
                name='uniq_mdf_sku_dims_per_org',
            ),
        ),
    ]
