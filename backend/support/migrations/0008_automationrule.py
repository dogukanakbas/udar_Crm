from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('support', '0007_taskattachment_meta'),
    ]

    operations = [
        migrations.CreateModel(
            name='AutomationRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('trigger', models.CharField(choices=[('task_status_changed', 'Task status changed'), ('task_due_soon', 'Task due soon')], max_length=50)),
                ('condition', models.JSONField(blank=True, default=dict)),
                ('action', models.CharField(choices=[('add_comment', 'Add comment'), ('set_assignee', 'Set assignee'), ('notify', 'Notify')], max_length=50)),
                ('action_payload', models.JSONField(blank=True, default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='automation_rules', to='organizations.organization')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]


