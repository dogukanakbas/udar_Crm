from django.db import models
from django.conf import settings
from organizations.models import Organization, Warehouse


class Category(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0, db_index=True, help_text='Display order for drag & drop')
    template_defaults = models.JSONField(default=dict, blank=True)
    attribute_schema = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class Product(models.Model):
    PRODUCT_TYPES = [
        ('finished', 'Mamül'),
        ('semi_finished', 'Yarı mamül'),
        ('raw_material', 'Ham madde'),
        ('consumable', 'Sarf malzeme'),
    ]
    INVENTORY_MODES = [('legacy', 'Eski toplam stok'), ('warehouse', 'Depo bazlı stok')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='products')
    sku = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True, help_text='Display order for drag & drop')
    template_defaults = models.JSONField(default=dict, blank=True)
    attribute_values = models.JSONField(default=dict, blank=True)
    attribute_schema_override = models.JSONField(default=list, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price_lists = models.JSONField(default=dict, blank=True)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reserved = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_point = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default='finished')
    inventory_mode = models.CharField(max_length=20, choices=INVENTORY_MODES, default='legacy')

    class Meta:
        unique_together = ('organization', 'sku')
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class SalesOrder(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sales_orders')
    number = models.CharField(max_length=50)
    customer_name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default='Draft')
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping_date = models.DateField(null=True, blank=True)
    expected_delivery = models.DateField(null=True, blank=True)
    order_quantity = models.PositiveIntegerField(default=0, help_text='Sipariş adedi (üretim takibi)')
    quantity_produced = models.PositiveIntegerField(default=0, help_text='Raporlanan tamamlanan adet')

    class Meta:
        unique_together = ('organization', 'number')


class PurchaseOrder(models.Model):
    STATUSES = [('Draft', 'Draft'), ('Ordered', 'Ordered'), ('Receiving', 'Receiving'), ('Closed', 'Closed')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='purchase_orders')
    number = models.CharField(max_length=50)
    supplier = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUSES, default='Draft')
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    expected_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('organization', 'number')


class Invoice(models.Model):
    STATUSES = [('Draft', 'Draft'), ('Sent', 'Sent'), ('Paid', 'Paid'), ('Overdue', 'Overdue')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invoices')
    number = models.CharField(max_length=50)
    customer_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUSES, default='Draft')
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='USD')
    due_date = models.DateField(null=True, blank=True)
    issued_at = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('organization', 'number')


class InvoicePayment(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=50, default='Wire')


class InventoryLocation(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='inventory_locations')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('warehouse', 'code')

    def __str__(self):
        return f"{self.warehouse.code}-{self.code}"


class WarehouseStock(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='warehouse_stocks')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='stocks')
    location = models.ForeignKey(InventoryLocation, on_delete=models.PROTECT, related_name='stocks')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='warehouse_stocks')
    quantity = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    detail_1_override = models.CharField(max_length=500, blank=True, default='')
    detail_2_override = models.CharField(max_length=500, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'location', 'product')
        ordering = ['warehouse__code', 'location__code', 'product__sku']


class StockMovement(models.Model):
    MOVEMENT_TYPES = [('IN', 'Giriş'), ('OUT', 'Çıkış'), ('ADJUST', 'Sayım düzeltmesi'), ('TRANSFER', 'Transfer'), ('OPENING', 'Açılış aktarımı')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='stock_movements')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES, default='IN')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True)
    location_from = models.CharField(max_length=120, blank=True)
    location_to = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    warehouse_from = models.ForeignKey(Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name='outgoing_movements')
    warehouse_to = models.ForeignKey(Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name='incoming_movements')
    location_from_ref = models.ForeignKey(InventoryLocation, on_delete=models.PROTECT, null=True, blank=True, related_name='outgoing_movements')
    location_to_ref = models.ForeignKey(InventoryLocation, on_delete=models.PROTECT, null=True, blank=True, related_name='incoming_movements')
    previous_quantity = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    resulting_quantity = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    source_type = models.CharField(max_length=50, blank=True, default='manual')
    source_id = models.CharField(max_length=120, blank=True, default='')
    acted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')


class FulfillmentRequest(models.Model):
    STATUSES = [('waiting', 'Bekliyor'), ('in_progress', 'İşlemde'), ('completed', 'Tamamlandı'), ('cancelled', 'İptal')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='fulfillment_requests')
    source_type = models.CharField(max_length=50)
    source_id = models.CharField(max_length=120)
    status = models.CharField(max_length=20, choices=STATUSES, default='waiting')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'source_type', 'source_id')


class FulfillmentLine(models.Model):
    METHODS = [('warehouse', 'Depodan teslim'), ('production', 'Üretilecek')]
    STATUSES = [('waiting', 'Bekliyor'), ('picking', 'Toplanıyor'), ('completed', 'Tamamlandı'), ('shortfall', 'Eksik stok')]
    request = models.ForeignKey(FulfillmentRequest, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='fulfillment_lines')
    quantity = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHODS, default='warehouse')
    status = models.CharField(max_length=20, choices=STATUSES, default='waiting')


class Vehicle(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='vehicles')
    name = models.CharField(max_length=255)
    plate = models.CharField(max_length=64, unique=True)
    driver = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=64, default='Yolda')
    last_update = models.DateTimeField(auto_now=True)
    location_city = models.CharField(max_length=128, blank=True, default='')
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    distance_today = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    avg_speed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    idle_minutes = models.IntegerField(default=0)
    stops = models.IntegerField(default=0)
    eta = models.DateTimeField(null=True, blank=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.plate})"
