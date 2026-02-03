from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0006_taskchecklist'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskattachment',
            name='content_type',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='taskattachment',
            name='original_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='taskattachment',
            name='size',
            field=models.BigIntegerField(default=0),
        ),
    ]

