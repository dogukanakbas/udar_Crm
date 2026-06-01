from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('organizations', '0004_organization_favicon_url')]
    operations = [
        migrations.AddField(model_name='warehouse', name='address', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='warehouse', name='capacity', field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
        migrations.AddField(model_name='warehouse', name='capacity_unit', field=models.CharField(blank=True, default='', max_length=50)),
        migrations.AddField(model_name='warehouse', name='city', field=models.CharField(blank=True, default='', max_length=120)),
        migrations.AddField(model_name='warehouse', name='description', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='warehouse', name='email', field=models.EmailField(blank=True, default='', max_length=254)),
        migrations.AddField(model_name='warehouse', name='is_active', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='warehouse', name='phone', field=models.CharField(blank=True, default='', max_length=50)),
        migrations.AddField(model_name='warehouse', name='responsible', field=models.CharField(blank=True, default='', max_length=255)),
    ]
