from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0026_task_brief_intro_per_product_line'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskproductionentry',
            name='product_line_index',
            field=models.PositiveSmallIntegerField(blank=True, null=True, db_index=True),
        ),
    ]
