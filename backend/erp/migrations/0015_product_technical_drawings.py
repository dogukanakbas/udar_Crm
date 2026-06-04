# Generated manually for product technical drawing library.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import erp.models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('erp', '0014_stockmovement_detail_1_stockmovement_detail_2_and_more'),
        ('organizations', '0005_warehouse_operational_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='TechnicalDrawingFolder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True, default='')),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='technical_drawing_folders', to='organizations.organization')),
            ],
            options={
                'ordering': ['order', 'name', 'id'],
                'unique_together': {('organization', 'name')},
            },
        ),
        migrations.CreateModel(
            name='ProductTechnicalDrawing',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('version', models.CharField(blank=True, default='', max_length=50)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('description', models.TextField(blank=True, default='')),
                ('file', models.FileField(upload_to=erp.models.product_technical_drawing_path)),
                ('file_type', models.CharField(choices=[('image', 'Gorsel')], default='image', max_length=20)),
                ('original_filename', models.CharField(blank=True, default='', max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('folder', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='drawings', to='erp.technicaldrawingfolder')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='product_technical_drawings', to='organizations.organization')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='technical_drawings', to='erp.product')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_product_drawings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_active', '-uploaded_at', '-id'],
                'indexes': [
                    models.Index(fields=['organization', 'product', 'is_active'], name='erp_product_organiz_80f20e_idx'),
                    models.Index(fields=['organization', 'file_type'], name='erp_product_organiz_f7e73d_idx'),
                ],
            },
        ),
    ]
