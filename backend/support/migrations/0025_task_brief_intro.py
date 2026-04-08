from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0024_repair_support_task_missing_columns'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='brief_intro',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Görev özeti — ayrıntı sayfasında üretilecek ürün kartında kısa tanıtım',
                max_length=600,
            ),
        ),
    ]
