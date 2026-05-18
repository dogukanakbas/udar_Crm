from django.db import models
from django.contrib.auth.models import AbstractUser
from datetime import time
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
    is_superadmin = models.BooleanField(default=False, help_text='Platform owner/superadmin access')

    def __str__(self):
        return f"{self.username} ({self.role})"


class Team(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=255)
    members = models.ManyToManyField(User, related_name='teams', blank=True)
    leader = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_teams',
        help_text='Usta başı / ekip lideri — görev ekibe düşünce önce bu kişiye atanır.',
    )

    class Meta:
        unique_together = ('organization', 'name')
        ordering = ['name']

    def __str__(self):
        return self.name


class TeamAssociate(models.Model):
    """
    Sistem hesabı olmayan saha / ekip çalışanları.
    Ekiplerde çalışıyor ama giriş yapamaz; yönetim takibi için kayıt tutulur.
    """

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='team_associates')
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, default='')
    notes = models.CharField(max_length=500, blank=True, default='')
    teams = models.ManyToManyField(Team, related_name='associates', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['full_name', 'id']

    def __str__(self):
        return f"{self.full_name} ({self.organization_id})"


class OrganizationSettings(models.Model):
    """Mesai saat aralığı ve günleri - Worker giriş kısıtlaması için."""
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name='settings')
    working_hours_start = models.TimeField(default=time(8, 0))   # Mesai başlangıç
    working_hours_end = models.TimeField(default=time(18, 0))    # Mesai bitiş
    working_days = models.JSONField(default=list)  # [0,1,2,3,4] = Pzt-Cuma (0=Pzt, 6=Paz)
    price_list_label = models.CharField(max_length=120, default='2026/1. LİSTE')
    price_lists = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ayarlar: {self.organization.name}"
