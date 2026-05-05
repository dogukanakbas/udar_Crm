from django.contrib import admin

from .models import MdfMovement, MdfSku


@admin.register(MdfSku)
class MdfSkuAdmin(admin.ModelAdmin):
    list_display = ['id', 'organization', 'thickness_mm', 'width_cm', 'height_cm', 'quantity', 'min_threshold']
    list_filter = ['organization']
    search_fields = ['organization__name']


@admin.register(MdfMovement)
class MdfMovementAdmin(admin.ModelAdmin):
    list_display = ['id', 'organization', 'sku', 'kind', 'quantity', 'movement_date', 'created_at']
    list_filter = ['kind', 'organization', 'movement_date']
    raw_id_fields = ['sku', 'created_by']
