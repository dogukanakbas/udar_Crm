from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0021_taskchecklist_workflow_team'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='taskchecklist',
            constraint=models.UniqueConstraint(
                condition=models.Q(workflow_team__isnull=False),
                fields=('task', 'workflow_team'),
                name='unique_task_workflow_checklist_team',
            ),
        ),
    ]
