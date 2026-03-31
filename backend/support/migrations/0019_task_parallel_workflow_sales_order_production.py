import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0007_salesorder_production_quantities'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0008_team_leader'),
        ('support', '0018_task_workflow_team_ids'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='workflow_parallel',
            field=models.BooleanField(
                default=False,
                help_text='True ise bölümler sıra beklemeden paralel çalışır; usta başı onayı ile kapanır.',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='workflow_stage_targets',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='workflow_team_ids ile aynı uzunlukta bölüm bazlı hedef adetler',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='workflow_stage_state',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Ekip ID -> {assignee_id, qty_target, qty_done, pending_approval, stage_done}',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='sales_order',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='tasks',
                to='erp.salesorder',
            ),
        ),
        migrations.AddField(
            model_name='taskmodel',
            name='width_mm',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='taskmodel',
            name='height_mm',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.CreateModel(
            name='TaskProductionEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_date', models.DateField(db_index=True)),
                ('quantity', models.PositiveIntegerField(default=0)),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'task',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='production_entries',
                        to='support.task',
                    ),
                ),
                (
                    'team',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to='accounts.team',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-entry_date', '-created_at'],
            },
        ),
    ]
