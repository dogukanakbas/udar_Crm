import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('accounts', '0008_team_leader'),
    ]

    operations = [
        migrations.CreateModel(
            name='TeamAssociate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=255)),
                ('phone', models.CharField(blank=True, default='', max_length=50)),
                ('notes', models.CharField(blank=True, default='', max_length=500)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='team_associates',
                        to='organizations.organization',
                    ),
                ),
            ],
            options={
                'ordering': ['full_name', 'id'],
            },
        ),
        migrations.AddField(
            model_name='teamassociate',
            name='teams',
            field=models.ManyToManyField(blank=True, related_name='associates', to='accounts.team'),
        ),
    ]
