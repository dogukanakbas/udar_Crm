import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0020_task_product_color_taskmodel_thickness'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskchecklist',
            name='workflow_team',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='workflow_checklist_items',
                to='accounts.team',
            ),
        ),
    ]
