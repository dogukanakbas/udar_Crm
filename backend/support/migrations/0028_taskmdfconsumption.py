from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mdf', '0001_initial'),
        ('accounts', '0010_organizationsettings_price_list_label'),
        ('support', '0027_taskproductionentry_product_line_index'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskMdfConsumption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=0)),
                ('consumed_at', models.DateField(db_index=True)),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_task_mdf_consumptions', to=settings.AUTH_USER_MODEL)),
                ('mdf_sku', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='task_consumptions', to='mdf.mdfsku')),
                ('task', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mdf_consumptions', to='support.task')),
                ('team', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.team')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='task_mdf_consumptions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-consumed_at', '-created_at'],
            },
        ),
    ]

