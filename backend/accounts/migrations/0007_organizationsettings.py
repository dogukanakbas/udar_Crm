import django.db.models.deletion
from datetime import time
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('accounts', '0006_user_is_superadmin'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('working_hours_start', models.TimeField(default=time(8, 0))),
                ('working_hours_end', models.TimeField(default=time(18, 0))),
                ('working_days', models.JSONField(default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='settings', to='organizations.organization')),
            ],
        ),
    ]
