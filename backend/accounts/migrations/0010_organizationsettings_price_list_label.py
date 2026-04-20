from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_teamassociate'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationsettings',
            name='price_list_label',
            field=models.CharField(default='2026/1. LİSTE', max_length=120),
        ),
    ]
