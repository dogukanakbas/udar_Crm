# Generated migration file for adding order field to Product and Category

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0010_product_price_lists_alter_product_reorder_point_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='order',
            field=models.PositiveIntegerField(db_index=True, default=0, help_text='Display order for drag & drop'),
        ),
        migrations.AlterModelOptions(
            name='category',
            options={'ordering': ['order', 'id']},
        ),
        migrations.AddField(
            model_name='product',
            name='order',
            field=models.PositiveIntegerField(db_index=True, default=0, help_text='Display order for drag & drop'),
        ),
        migrations.AlterModelOptions(
            name='product',
            options={'ordering': ['order', 'id'], 'unique_together': {('organization', 'sku')}},
        ),
    ]
