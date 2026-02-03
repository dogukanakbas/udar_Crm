from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_permission_rolepermission'),
        ('organizations', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('Admin', 'Admin'), ('Manager', 'Manager'), ('Sales', 'Sales'), ('Finance', 'Finance'), ('Support', 'Support'), ('Warehouse', 'Warehouse'), ('Worker', 'Worker')], default='Sales', max_length=20),
        ),
        migrations.CreateModel(
            name='Team',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='organizations.organization')),
                ('members', models.ManyToManyField(blank=True, related_name='teams', to='accounts.user')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('organization', 'name')},
            },
        ),
    ]

