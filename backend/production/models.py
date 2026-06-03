from django.conf import settings
from django.db import models
from django.utils import timezone

from organizations.models import Organization, Warehouse


class ProductionSettings(models.Model):
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name='production_settings')
    default_completion_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_completion_settings',
    )
    default_completion_location = models.ForeignKey(
        'erp.InventoryLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_completion_settings',
    )
    auto_stock_in_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ProductionDepartment(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_departments')
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=32, blank=True, default='')
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('organization', 'code')

    def __str__(self):
        return self.name


class ProductionStation(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_stations')
    department = models.ForeignKey(ProductionDepartment, on_delete=models.CASCADE, related_name='stations')
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=0, db_index=True)
    max_workers = models.PositiveIntegerField(default=2)
    is_handover = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['department__order', 'order', 'id']
        unique_together = ('organization', 'code')

    def __str__(self):
        return self.code


class ProductionStationUser(models.Model):
    ROLES = [
        ('operator', 'Operator'),
        ('lead', 'Usta basi'),
        ('observer', 'Izleyici'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_station_users')
    station = models.ForeignKey(ProductionStation, on_delete=models.CASCADE, related_name='assigned_users')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='production_station_assignments')
    role = models.CharField(max_length=20, choices=ROLES, default='operator')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['station__code', 'user__username']
        unique_together = ('organization', 'station', 'user')

    def __str__(self):
        return f'{self.station.code} - {self.user}'


class ProductionDevice(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_devices')
    station = models.ForeignKey(ProductionStation, on_delete=models.CASCADE, related_name='devices')
    name = models.CharField(max_length=120)
    token = models.CharField(max_length=128, unique=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['station__code', 'name']

    def __str__(self):
        return f'{self.station.code} - {self.name}'


class ProductionDataField(models.Model):
    FIELD_TYPES = [
        ('text', 'Metin'),
        ('number', 'Sayi'),
        ('boolean', 'Mantiksal'),
        ('datetime', 'Tarih saat'),
        ('json', 'JSON'),
    ]
    SOURCES = [
        ('manual', 'Elle'),
        ('device', 'Cihaz'),
        ('calculated', 'Hesaplanan'),
        ('system', 'Sistem'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_data_fields')
    station = models.ForeignKey(ProductionStation, on_delete=models.CASCADE, null=True, blank=True, related_name='data_fields')
    key = models.CharField(max_length=80)
    label = models.CharField(max_length=160)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES, default='text')
    source = models.CharField(max_length=20, choices=SOURCES, default='manual')
    unit = models.CharField(max_length=40, blank=True, default='')
    default_value = models.CharField(max_length=255, blank=True, default='')
    config = models.JSONField(default=dict, blank=True)
    is_visible = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['station__code', 'order', 'id']
        unique_together = ('organization', 'station', 'key')

    def __str__(self):
        return self.label


class ProductionDevicePayloadMap(models.Model):
    TARGET_TYPES = [
        ('text', 'Metin'),
        ('number', 'Sayi'),
        ('boolean', 'Mantiksal'),
        ('datetime', 'Tarih saat'),
        ('json', 'JSON'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_device_maps')
    device = models.ForeignKey(ProductionDevice, on_delete=models.CASCADE, related_name='payload_maps')
    station = models.ForeignKey(ProductionStation, on_delete=models.CASCADE, null=True, blank=True, related_name='payload_maps')
    data_field = models.ForeignKey(ProductionDataField, on_delete=models.SET_NULL, null=True, blank=True, related_name='payload_maps')
    source_path = models.CharField(max_length=255)
    target_key = models.CharField(max_length=80)
    target_type = models.CharField(max_length=20, choices=TARGET_TYPES, default='text')
    default_value = models.CharField(max_length=255, blank=True, default='')
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['device__name', 'order', 'id']

    def __str__(self):
        return f'{self.device.name}: {self.source_path} -> {self.target_key}'


class ProductionRouteTemplate(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_route_templates')
    name = models.CharField(max_length=120)
    product_group_key = models.CharField(max_length=120, blank=True, default='')
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', 'name', 'id']
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name


class ProductionRouteStep(models.Model):
    route = models.ForeignKey(ProductionRouteTemplate, on_delete=models.CASCADE, related_name='steps')
    station = models.ForeignKey(ProductionStation, on_delete=models.PROTECT, related_name='route_steps')
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_required = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('route', 'station')

    def __str__(self):
        return f'{self.route.name} - {self.station.code}'


class ProductionWorkOrder(models.Model):
    STATUSES = [
        ('draft', 'Taslak'),
        ('waiting', 'Bekliyor'),
        ('in_progress', 'Uretimde'),
        ('completed', 'Tamamlandi'),
        ('cancelled', 'Iptal'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_work_orders')
    number = models.CharField(max_length=64)
    source_type = models.CharField(max_length=50, blank=True, default='manual')
    source_id = models.CharField(max_length=120, blank=True, default='')
    source_number = models.CharField(max_length=120, blank=True, default='')
    customer_name = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUSES, default='waiting')
    route = models.ForeignKey(ProductionRouteTemplate, on_delete=models.PROTECT, null=True, blank=True, related_name='work_orders')
    planned_start = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_production_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'source_type', 'source_id'],
                condition=~models.Q(source_id=''),
                name='unique_production_work_order_source',
            )
        ]

    def __str__(self):
        return self.number


class ProductionWorkOrderLine(models.Model):
    work_order = models.ForeignKey(ProductionWorkOrder, on_delete=models.CASCADE, related_name='lines')
    route = models.ForeignKey(ProductionRouteTemplate, on_delete=models.PROTECT, null=True, blank=True, related_name='work_order_lines')
    product = models.ForeignKey('erp.Product', on_delete=models.SET_NULL, null=True, blank=True, related_name='production_lines')
    product_sku = models.CharField(max_length=120, blank=True, default='')
    product_name = models.CharField(max_length=255)
    detail_1 = models.CharField(max_length=500, blank=True, default='')
    detail_2 = models.CharField(max_length=500, blank=True, default='')
    quantity = models.DecimalField(max_digits=14, decimal_places=2)
    completed_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    technical_notes = models.TextField(blank=True, default='')
    details = models.JSONField(default=dict, blank=True)
    stock_in_done = models.BooleanField(default=False)
    stock_in_movement_id = models.BigIntegerField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.product_name


class ProductionStepProgress(models.Model):
    STATUSES = [
        ('locked', 'Kilitli'),
        ('ready', 'Hazir'),
        ('in_progress', 'Islemde'),
        ('waiting_handover', 'Devir bekliyor'),
        ('completed', 'Tamamlandi'),
        ('skipped', 'Atlandi'),
    ]
    line = models.ForeignKey(ProductionWorkOrderLine, on_delete=models.CASCADE, related_name='steps')
    route_step = models.ForeignKey(ProductionRouteStep, on_delete=models.PROTECT, related_name='progress_rows')
    station = models.ForeignKey(ProductionStation, on_delete=models.PROTECT, related_name='progress_rows')
    order = models.PositiveIntegerField(default=0, db_index=True)
    target_quantity = models.DecimalField(max_digits=14, decimal_places=2)
    completed_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    machine_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUSES, default='locked')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_production_steps')

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('line', 'route_step')

    def __str__(self):
        return f'{self.line_id} - {self.station.code}'


class ProductionWorkSession(models.Model):
    STATUSES = [
        ('started', 'Basladi'),
        ('paused', 'Molada'),
        ('handover', 'Devredildi'),
        ('closed', 'Kapandi'),
    ]
    DISCREPANCY_STATUSES = [
        ('none', 'Fark yok'),
        ('needs_review', 'Inceleme gerekli'),
        ('approved', 'Onaylandi'),
        ('corrected', 'Duzeltildi'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_work_sessions')
    work_order = models.ForeignKey(ProductionWorkOrder, on_delete=models.CASCADE, related_name='sessions')
    line = models.ForeignKey(ProductionWorkOrderLine, on_delete=models.CASCADE, related_name='sessions')
    step = models.ForeignKey(ProductionStepProgress, on_delete=models.CASCADE, related_name='sessions')
    station = models.ForeignKey(ProductionStation, on_delete=models.PROTECT, related_name='sessions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='production_work_sessions')
    previous_session = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='handover_sessions')
    status = models.CharField(max_length=20, choices=STATUSES, default='started')
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    start_counter = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    end_counter = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    machine_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    declared_good_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discrepancy_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discrepancy_status = models.CharField(max_length=20, choices=DISCREPANCY_STATUSES, default='none')
    note = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_production_work_sessions',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at', '-id']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['line', 'station', 'status']),
            models.Index(fields=['user', 'started_at']),
        ]

    def __str__(self):
        return f'{self.user} - {self.station.code} - {self.status}'


class ProductionEvent(models.Model):
    EVENT_TYPES = [
        ('start', 'Baslat'),
        ('pause', 'Mola'),
        ('resume', 'Devam'),
        ('quantity', 'Adet girisi'),
        ('handover', 'Devret'),
        ('complete', 'Tamamla'),
        ('adjust', 'Duzeltme'),
        ('cancel', 'Iptal'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_events')
    work_order = models.ForeignKey(ProductionWorkOrder, on_delete=models.CASCADE, related_name='events')
    line = models.ForeignKey(ProductionWorkOrderLine, on_delete=models.CASCADE, related_name='events')
    step = models.ForeignKey(ProductionStepProgress, on_delete=models.CASCADE, related_name='events')
    station = models.ForeignKey(ProductionStation, on_delete=models.PROTECT, related_name='events')
    session = models.ForeignKey(ProductionWorkSession, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    quantity_delta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    counter_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    note = models.TextField(blank=True, default='')
    idempotency_key = models.CharField(max_length=160, blank=True, default='')
    source = models.CharField(max_length=30, blank=True, default='ui')
    raw_payload = models.JSONField(default=dict, blank=True)
    normalized_payload = models.JSONField(default=dict, blank=True)
    mapping_errors = models.JSONField(default=list, blank=True)
    device = models.ForeignKey(ProductionDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='production_events')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'idempotency_key'],
                condition=~models.Q(idempotency_key=''),
                name='unique_production_event_idempotency',
            )
        ]

    def delete(self, *args, **kwargs):
        raise RuntimeError('Production events cannot be deleted.')


class ProductionRuleSet(models.Model):
    SCOPES = [
        ('global', 'Genel'),
        ('station', 'Istasyon'),
        ('route', 'Rota'),
    ]
    TRIGGERS = [
        ('pi_event', 'RPi verisi'),
        ('ui_event', 'Konsol islemi'),
        ('step_completed', 'Istasyon tamamlandi'),
        ('manual', 'Elle'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_rule_sets')
    name = models.CharField(max_length=160)
    scope = models.CharField(max_length=20, choices=SCOPES, default='station')
    station = models.ForeignKey(ProductionStation, on_delete=models.CASCADE, null=True, blank=True, related_name='rule_sets')
    route = models.ForeignKey(ProductionRouteTemplate, on_delete=models.CASCADE, null=True, blank=True, related_name='rule_sets')
    trigger_event = models.CharField(max_length=30, choices=TRIGGERS, default='pi_event')
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class ProductionRuleBlock(models.Model):
    BLOCK_TYPES = [
        ('condition', 'Kosul'),
        ('assign', 'Atama'),
        ('increment_quantity', 'Adet ekle'),
        ('change_status', 'Durum degistir'),
        ('open_next_step', 'Sonraki istasyonu ac'),
        ('stock_in', 'Depoya giris'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_rule_blocks')
    rule_set = models.ForeignKey(ProductionRuleSet, on_delete=models.CASCADE, related_name='blocks')
    block_type = models.CharField(max_length=30, choices=BLOCK_TYPES)
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['rule_set__order', 'order', 'id']

    def __str__(self):
        return f'{self.rule_set.name} - {self.block_type}'


class ProductionTemplatePreset(models.Model):
    key = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, default='')
    payload = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name', 'id']

    def __str__(self):
        return self.name


def production_document_path(instance, filename):
    return f'production/{instance.work_order_id}/{filename}'


class ProductionDocument(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='production_documents')
    work_order = models.ForeignKey(ProductionWorkOrder, on_delete=models.CASCADE, related_name='documents')
    line = models.ForeignKey(ProductionWorkOrderLine, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    station = models.ForeignKey(ProductionStation, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    file = models.FileField(upload_to=production_document_path)
    title = models.CharField(max_length=255, blank=True, default='')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at', '-id']
