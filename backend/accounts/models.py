from django.db import models
from django.contrib.auth.models import AbstractUser
from datetime import time
from organizations.models import Organization, Branch

DEFAULT_DOCUMENT_TERMS_TEXT = '\n'.join([
    '1- Alıcı özellikleri belirtilen ürünlerin satın alma şartlarını kabul eder.',
    '2- Satıcı onaylanan kalemlerin üretimini ve sevkini kabul eder.',
    '3- Onay sonrası teknik ve finansal değişiklikler yeni mutabakat gerektirir.',
    '4- Ödemesi tamamlanmayan siparişler üretime alınmayabilir.',
    '5- Mücbir sebepler kaynaklı gecikmelerde satıcı sorumlu tutulamaz.',
    '6- Teslimden sonra yazılı bildirim gelmezse ürünler eksiksiz kabul edilir.',
    '7- Alıcı gerekli vergi ve yetki belgelerini eksiksiz sunar.',
    '8- İmalat hataları garanti koşulları ve teknik şartname kapsamındadır.',
    '9- İhtilaflarda Malatya Mahkemeleri ve İcra Daireleri yetkilidir.',
])


class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    addon_id = models.CharField(max_length=120, blank=True, default="")
    permission_group = models.ForeignKey(
        "PermissionGroup",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="permissions",
    )
    permission_type = models.CharField(max_length=40, blank=True, default="boolean")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.code


class PermissionGroup(models.Model):
    group_id = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=180)
    addon_id = models.CharField(max_length=120, blank=True, default="")
    display_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["display_order", "title"]

    def __str__(self):
        return self.title


class RolePermission(models.Model):
    role = models.CharField(max_length=20)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role} -> {self.permission.code}"


class UserGroup(models.Model):
    group_id = models.CharField(max_length=80, unique=True)
    title = models.CharField(max_length=160)
    description = models.CharField(max_length=255, blank=True, default="")
    is_system = models.BooleanField(default=False)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "title"]

    def __str__(self):
        return self.title


class UserGroupMembership(models.Model):
    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="group_memberships")
    group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, related_name="memberships")
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "group")
        ordering = ["-is_primary", "group__display_order", "group__title"]

    def __str__(self):
        return f"{self.user_id} -> {self.group.group_id}"


class UserGroupPermission(models.Model):
    VALUE_CHOICES = [
        ("unset", "Unset"),
        ("allow", "Allow"),
        ("deny", "Deny"),
    ]
    group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, related_name="permission_values")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="group_values")
    value = models.CharField(max_length=10, choices=VALUE_CHOICES, default="unset")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("group", "permission")

    def __str__(self):
        return f"{self.group.group_id} {self.permission.code}={self.value}"


class EffectivePermissionCache(models.Model):
    user = models.OneToOneField("User", on_delete=models.CASCADE, related_name="effective_permission_cache")
    permissions = models.JSONField(default=list, blank=True)
    rebuilt_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"permissions:{self.user_id}"


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
    payment_options = models.JSONField(default=list, blank=True)
    service_expense_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    quote_terms_text = models.TextField(default=DEFAULT_DOCUMENT_TERMS_TEXT, blank=True)
    contract_terms_text = models.TextField(default=DEFAULT_DOCUMENT_TERMS_TEXT, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ayarlar: {self.organization.name}"
