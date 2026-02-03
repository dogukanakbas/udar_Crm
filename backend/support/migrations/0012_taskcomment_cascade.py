from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('support', '0010_taskattachment_version'),
    ]

    operations = [
        migrations.AlterField(
            model_name='taskcomment',
            name='task',
            field=models.ForeignKey(on_delete=models.CASCADE, related_name='comments', to='support.task'),
        ),
    ]

