from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    contract_settings = models.JSONField(default=dict, blank=True)
    brand_name = models.CharField(max_length=255, blank=True, default='')
    logo_url = models.TextField(blank=True, default='')
    favicon_url = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Branch(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    city = models.CharField(max_length=120, blank=True)

    class Meta:
        unique_together = ('organization', 'code')

    def __str__(self):
        return f"{self.organization.code}-{self.code}"


class Warehouse(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='warehouses')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='warehouses', null=True, blank=True)
    city = models.CharField(max_length=120, blank=True, default='')
    address = models.TextField(blank=True, default='')
    responsible = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    description = models.TextField(blank=True, default='')
    capacity = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    capacity_unit = models.CharField(max_length=50, blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('organization', 'code')

    def __str__(self):
        return f"{self.organization.code}-{self.code}"


class NumberRange(models.Model):
    DOC_TYPES = [
        ('QUOTE', 'Quote'),
        ('CONTRACT', 'Contract'),
        ('ORDER', 'SalesOrder'),
        ('INVOICE', 'Invoice'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='number_ranges')
    doc_type = models.CharField(max_length=20, choices=DOC_TYPES)
    prefix = models.CharField(max_length=10, default='')
    current = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('organization', 'doc_type')

    def next_number(self):
        value = self.current
        self.current += 1
        self.save(update_fields=['current'])
        return f"{self.prefix}{value}"
