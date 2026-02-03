from django.db import models
from organizations.models import Organization
from accounts.models import User
from erp.models import Product
from django.db.models.signals import post_save
from django.dispatch import receiver
from audit.utils import log_change


class BusinessPartner(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='partners')
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=50, blank=True)
    group = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return self.name


class Contact(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='contacts')
    company = models.ForeignKey(BusinessPartner, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=128, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=64, blank=True, default='')
    owner = models.CharField(max_length=128, blank=True, default='')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Lead(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='leads')
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=120, blank=True)
    company = models.ForeignKey(BusinessPartner, on_delete=models.SET_NULL, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_owner')
    status = models.CharField(max_length=50, default='New')
    source = models.CharField(max_length=50, blank=True)
    score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Opportunity(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='opportunities')
    name = models.CharField(max_length=255)
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True)
    company = models.ForeignKey(BusinessPartner, on_delete=models.SET_NULL, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='opportunity_owner')
    stage = models.CharField(max_length=50, default='Qualification')
    value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    close_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.name


class PricingRule(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='pricing_rules')
    RULE_TYPES = [('customer', 'Customer'), ('category', 'Category'), ('volume', 'Volume')]
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=RULE_TYPES)
    target = models.CharField(max_length=255)
    value = models.DecimalField(max_digits=6, decimal_places=2)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Quote(models.Model):
    STATUSES = [
        ('Draft', 'Draft'),
        ('Sent', 'Sent'),
        ('Under Review', 'Under Review'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Converted', 'Converted'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='quotes')
    number = models.CharField(max_length=50)
    customer = models.ForeignKey(BusinessPartner, on_delete=models.PROTECT, related_name='quotes')
    opportunity = models.ForeignKey(Opportunity, on_delete=models.SET_NULL, null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='Draft')
    valid_until = models.DateField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='USD')
    payment_terms = models.CharField(max_length=255, blank=True)
    delivery_terms = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'number')

    def __str__(self):
        return self.number


class QuoteLine(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    qty = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    def line_total(self):
        subtotal = self.qty * self.unit_price
        discount_val = subtotal * (self.discount / 100)
        tax_val = (subtotal - discount_val) * (self.tax / 100)
        return subtotal - discount_val + tax_val


@receiver(post_save, sender=Quote)
def audit_quote(sender, instance, created, **kwargs):
    action = 'created' if created else 'updated'
    log_change(
        organization=instance.organization,
        entity='Quote',
        entity_id=instance.id,
        action=action,
        user=instance.owner,
        new_value=instance.status,
    )
from django.db import models

# Create your models here.
