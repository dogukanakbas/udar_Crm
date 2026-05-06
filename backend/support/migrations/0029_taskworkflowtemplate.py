from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('support', '0028_taskmdfconsumption'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskWorkflowTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('team_ids', models.JSONField(blank=True, default=list, help_text='Sıralı ekip ID listesi')),
                ('stage_targets', models.JSONField(blank=True, default=list, help_text='team_ids ile aynı uzunlukta hedef listesi')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='task_workflow_templates', to='organizations.organization')),
            ],
            options={
                'ordering': ['name', 'id'],
                'unique_together': {('organization', 'name')},
            },
        ),
    ]
