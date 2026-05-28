from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0003_organization_brand_name_organization_logo_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='favicon_url',
            field=models.TextField(blank=True, default=''),
        ),
    ]
