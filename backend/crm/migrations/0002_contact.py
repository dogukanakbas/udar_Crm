from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('crm', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('role', models.CharField(blank=True, default='', max_length=128)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('phone', models.CharField(blank=True, default='', max_length=64)),
                ('owner', models.CharField(blank=True, default='', max_length=128)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts', to='organizations.organization')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts', to='crm.businesspartner')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]


