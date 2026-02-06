from django.db import models
from django.contrib.auth.models import AbstractUser
from organizations.models import Organization, Branch


class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.code


class RolePermission(models.Model):
    role = models.CharField(max_length=20)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role} -> {self.permission.code}"


class User(AbstractUser):
    ROLE_CHOICES = [
        ('Admin', 'Admin'),
        ('Manager', 'Manager'),
        ('Sales', 'Sales'),
        ('Finance', 'Finance'),
        ('Support', 'Support'),
        ('Warehouse', 'Warehouse'),
        ('Worker', 'Worker'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users', null=True, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Sales')
    notification_prefs = models.JSONField(default=dict, blank=True)
    otp_enabled = models.BooleanField(default=False)
    otp_secret = models.CharField(max_length=64, blank=True, default='')

    def __str__(self):
        return f"{self.username} ({self.role})"


class Team(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=255)
    members = models.ManyToManyField(User, related_name='teams', blank=True)

    class Meta:
        unique_together = ('organization', 'name')
        ordering = ['name']

    def __str__(self):
        return self.name
