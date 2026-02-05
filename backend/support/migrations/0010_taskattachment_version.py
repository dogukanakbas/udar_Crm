from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0009_tasktimeentry'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskattachment',
            name='parent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='children', to='support.taskattachment'),
        ),
        migrations.AddField(
            model_name='taskattachment',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
    ]


