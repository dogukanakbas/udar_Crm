from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0005_businesspartner_size'),
    ]

    operations = [
        migrations.AddField(
            model_name='businesspartner',
            name='currency',
            field=models.CharField(blank=True, default='TRY', max_length=10),
        ),
    ]
