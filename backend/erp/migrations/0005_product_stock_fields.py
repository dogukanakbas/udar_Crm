from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0004_stockmovement_expand'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='reserved',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='product',
            name='reorder_point',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='product',
            name='stock',
            field=models.IntegerField(default=0),
        ),
    ]

