from django.db import migrations, models
import django.db.models.deletion
import support.models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('support', '0016_task_handover'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=50)),
                ('name', models.CharField(blank=True, max_length=255)),
                ('image', models.ImageField(blank=True, null=True, upload_to=support.models.task_model_image_path)),
                ('duration_minutes', models.DecimalField(decimal_places=2, default=4, max_digits=8)),
                ('blade_min', models.DecimalField(blank=True, decimal_places=2, default=1.5, max_digits=6, null=True)),
                ('blade_max', models.DecimalField(blank=True, decimal_places=2, default=1.5, max_digits=6, null=True)),
                ('sizes', models.JSONField(blank=True, default=list)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='task_models', to='organizations.organization')),
            ],
            options={
                'ordering': ['order', 'code'],
                'unique_together': {('organization', 'code')},
            },
        ),
    ]
