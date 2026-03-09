# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('organizations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TenantPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('slug', models.SlugField(unique=True)),
                ('plan_type', models.CharField(choices=[('starter', 'Starter'), ('professional', 'Professional'), ('enterprise', 'Enterprise')], max_length=20)),
                ('description', models.TextField(blank=True)),
                ('price_monthly', models.DecimalField(decimal_places=2, max_digits=10)),
                ('price_yearly', models.DecimalField(decimal_places=2, max_digits=10)),
                ('max_users', models.IntegerField()),
                ('max_storage_gb', models.IntegerField()),
                ('features', models.JSONField(default=list, help_text='List of feature codes')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['price_monthly'],
            },
        ),
        migrations.CreateModel(
            name='TenantSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('trial', 'Trial'), ('active', 'Active'), ('suspended', 'Suspended'), ('cancelled', 'Cancelled')], default='trial', max_length=20)),
                ('billing_cycle', models.CharField(choices=[('monthly', 'Monthly'), ('yearly', 'Yearly')], default='monthly', max_length=20)),
                ('trial_ends_at', models.DateTimeField(blank=True, null=True)),
                ('current_period_start', models.DateTimeField()),
                ('current_period_end', models.DateTimeField()),
                ('current_users', models.IntegerField(default=0)),
                ('current_storage_gb', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('notes', models.TextField(blank=True)),
                ('organization', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription', to='organizations.organization')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='tenants.tenantplan')),
            ],
        ),
    ]
