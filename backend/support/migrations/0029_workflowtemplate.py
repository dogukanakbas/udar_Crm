from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
        ('support', '0028_taskmdfconsumption'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkflowTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('team_ids', models.JSONField(blank=True, default=list, help_text='Sıralı ekip ID listesi')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workflow_templates', to='organizations.organization')),
            ],
            options={
                'ordering': ['name', 'id'],
            },
        ),
        migrations.AddConstraint(
            model_name='workflowtemplate',
            constraint=models.UniqueConstraint(fields=('organization', 'name'), name='uniq_workflow_template_org_name'),
        ),
    ]
