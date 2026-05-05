from django.conf import settings
from django.db import models

from organizations.models import Organization


class MdfSku(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='mdf_skus')
    thickness_mm = models.PositiveSmallIntegerField()
    width_cm = models.PositiveSmallIntegerField()
    height_cm = models.PositiveSmallIntegerField()
    min_threshold = models.PositiveIntegerField(default=10)
    quantity = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['thickness_mm', 'width_cm', 'height_cm']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'thickness_mm', 'width_cm', 'height_cm'],
                name='uniq_mdf_sku_dims_per_org',
            )
        ]

    def __str__(self):
        return f"{self.thickness_mm}mm {self.width_cm}x{self.height_cm} ({self.quantity})"


class MdfMovement(models.Model):
    KIND_IN = 'in'
    KIND_OUT = 'out'
    KIND_CHOICES = [(KIND_IN, 'Giriş'), (KIND_OUT, 'Çıkış')]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='mdf_movements')
    sku = models.ForeignKey(MdfSku, on_delete=models.CASCADE, related_name='movements')
    kind = models.CharField(max_length=8, choices=KIND_CHOICES)
    quantity = models.PositiveIntegerField()
    movement_date = models.DateField(db_index=True)
    note = models.CharField(max_length=500, blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mdf_movements',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-movement_date', '-created_at', '-id']

    def __str__(self):
        return f"{self.kind} {self.quantity} @ {self.movement_date}"
