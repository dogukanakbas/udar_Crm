# Generated manually for production foreman report templates.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import production.models


class Migration(migrations.Migration):
    dependencies = [
        ('production', '0010_productiondepartment_notification_group_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductionReportTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=160)),
                ('key', models.SlugField(max_length=80)),
                ('file', models.FileField(upload_to=production.models.production_report_template_path)),
                ('default_format', models.CharField(choices=[('xlsx', 'Excel'), ('pdf', 'PDF')], default='pdf', max_length=10)),
                ('description', models.TextField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_production_report_templates', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='production_report_templates', to='organizations.organization')),
            ],
            options={
                'ordering': ['name', 'id'],
                'unique_together': {('organization', 'key')},
            },
        ),
        migrations.AddIndex(
            model_name='productionreporttemplate',
            index=models.Index(fields=['organization', 'is_active'], name='production__organiz_996969_idx'),
        ),
        migrations.AddIndex(
            model_name='productionreporttemplate',
            index=models.Index(fields=['organization', 'key'], name='production__organiz_416b18_idx'),
        ),
    ]
