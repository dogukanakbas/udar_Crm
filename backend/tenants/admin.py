from django.contrib import admin
from .models import TenantPlan, TenantSubscription


@admin.register(TenantPlan)
class TenantPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'plan_type', 'price_monthly', 'price_yearly', 'max_users', 'is_active']
    list_filter = ['plan_type', 'is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(TenantSubscription)
class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['organization', 'plan', 'status', 'billing_cycle', 'current_period_end']
    list_filter = ['status', 'billing_cycle', 'plan']
    search_fields = ['organization__name']
    readonly_fields = ['created_at', 'updated_at']
