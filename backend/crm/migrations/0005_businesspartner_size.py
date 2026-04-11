from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0004_quoteline_discount_secondary'),
    ]

    operations = [
        migrations.AddField(
            model_name='businesspartner',
            name='size',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
