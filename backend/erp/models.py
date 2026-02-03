from django.db import models
from organizations.models import Organization, Warehouse


class Category(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Product(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='products')
    sku = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reserved = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_point = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ('organization', 'sku')

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

    class Meta:
        unique_together = ('organization', 'code')


class StockMovement(models.Model):
    MOVEMENT_TYPES = [('IN', 'IN'), ('OUT', 'OUT'), ('TRANSFER', 'TRANSFER')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='stock_movements')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES, default='IN')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True)
    location_from = models.CharField(max_length=120, blank=True)
    location_to = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


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
