from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0019_task_parallel_workflow_sales_order_production'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='product_color',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='task',
            name='product_color_code',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='taskmodel',
            name='thickness_mm',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
