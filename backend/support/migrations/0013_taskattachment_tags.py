from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0012_taskcomment_cascade'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskattachment',
            name='tags',
            field=models.JSONField(blank=True, default=list),
        ),
    ]

