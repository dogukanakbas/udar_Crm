from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0022_taskchecklist_workflow_team_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='product_lines',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Her eleman: model_code, variant, quantity, renk, süre vb. — çoklu ürün kalemleri',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='active_product_index',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Şu an iş akışına yansıtılan ürün satırı (0 tabanlı)',
            ),
        ),
    ]
