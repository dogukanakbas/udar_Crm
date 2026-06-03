from django.db import models


class Addon(models.Model):
    addon_id = models.CharField(max_length=120, unique=True)
    title = models.CharField(max_length=180)
    vendor = models.CharField(max_length=120, blank=True, default="")
    version = models.CharField(max_length=40, blank=True, default="")
    version_id = models.PositiveIntegerField(default=0)
    min_core_version = models.CharField(max_length=40, blank=True, default="")
    manifest = models.JSONField(default=dict, blank=True)
    path = models.CharField(max_length=500, blank=True, default="")
    is_system = models.BooleanField(default=False)
    is_installed = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=False)
    installed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["addon_id"]

    def __str__(self):
        return self.addon_id


class AddonVersion(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="versions")
    version = models.CharField(max_length=40)
    version_id = models.PositiveIntegerField(default=0)
    manifest_hash = models.CharField(max_length=128, blank=True, default="")
    installed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-installed_at"]


class AddonInstallLog(models.Model):
    ACTION_CHOICES = [
        ("discover", "Discover"),
        ("install", "Install"),
        ("enable", "Enable"),
        ("disable", "Disable"),
        ("upgrade", "Upgrade"),
        ("uninstall", "Uninstall"),
        ("rebuild", "Rebuild"),
        ("error", "Error"),
    ]
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="logs", null=True, blank=True)
    raw_addon_id = models.CharField(max_length=120, blank=True, default="")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    message = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AddonDataImport(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="data_imports")
    data_type = models.CharField(max_length=80)
    checksum = models.CharField(max_length=128, blank=True, default="")
    imported_at = models.DateTimeField(auto_now=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("addon", "data_type")


class AddonOption(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="options")
    key = models.CharField(max_length=160)
    title = models.CharField(max_length=180, blank=True, default="")
    value = models.JSONField(default=dict, blank=True)
    default_value = models.JSONField(default=dict, blank=True)
    option_type = models.CharField(max_length=40, blank=True, default="text")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("addon", "key")
        ordering = ["display_order", "key"]


class AddonEventListener(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="event_listeners")
    event = models.CharField(max_length=160)
    handler = models.CharField(max_length=300)
    priority = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["event", "priority", "id"]


class AddonRoute(models.Model):
    ROUTE_KIND_CHOICES = [("backend", "Backend"), ("frontend", "Frontend")]
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="routes")
    kind = models.CharField(max_length=20, choices=ROUTE_KIND_CHOICES)
    key = models.CharField(max_length=160)
    path = models.CharField(max_length=260)
    binding = models.CharField(max_length=300, blank=True, default="")
    required_permission = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("addon", "kind", "key")
        ordering = ["path", "key"]


class AddonNavigation(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="navigation")
    key = models.CharField(max_length=160)
    label = models.CharField(max_length=180)
    parent_key = models.CharField(max_length=160, blank=True, default="")
    route = models.CharField(max_length=260, blank=True, default="")
    icon = models.CharField(max_length=80, blank=True, default="FolderKanban")
    required_permission = models.CharField(max_length=120, blank=True, default="")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("addon", "key")
        ordering = ["display_order", "label"]


class AddonAsset(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="assets")
    key = models.CharField(max_length=160)
    asset_type = models.CharField(max_length=60)
    path = models.CharField(max_length=500)
    integrity_hash = models.CharField(max_length=128, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("addon", "key")


class AddonLanguage(models.Model):
    language_id = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=120)
    fallback_language_id = models.CharField(max_length=20, blank=True, default="")
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class AddonPhrase(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="phrases")
    language_id = models.CharField(max_length=20, default="tr-TR")
    title = models.CharField(max_length=220)
    text = models.TextField(blank=True, default="")
    version_id = models.PositiveIntegerField(default=0)
    version = models.CharField(max_length=40, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("language_id", "title")
        ordering = ["language_id", "title"]

    def __str__(self):
        return f"{self.language_id}:{self.title}"


class AddonTemplate(models.Model):
    TEMPLATE_TYPE_CHOICES = [
        ("admin", "Admin"),
        ("public", "Public"),
        ("email", "Email"),
        ("document", "Document"),
        ("frontend", "Frontend"),
    ]
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="templates")
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPE_CHOICES, default="frontend")
    title = models.CharField(max_length=220)
    content = models.TextField(blank=True, default="")
    version_id = models.PositiveIntegerField(default=0)
    version = models.CharField(max_length=40, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("template_type", "title")
        ordering = ["template_type", "title"]

    def __str__(self):
        return f"{self.template_type}:{self.title}"


class AddonTemplateModification(models.Model):
    ACTION_CHOICES = [
        ("str_replace", "String replace"),
        ("preg_replace", "Regex replace"),
        ("append", "Append"),
        ("prepend", "Prepend"),
    ]
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="template_modifications")
    template_type = models.CharField(max_length=30, default="frontend")
    template = models.CharField(max_length=220)
    modification_key = models.CharField(max_length=220)
    description = models.CharField(max_length=255, blank=True, default="")
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, default="str_replace")
    find = models.TextField(blank=True, default="")
    replace = models.TextField(blank=True, default="")
    execution_order = models.IntegerField(default=10)
    enabled = models.BooleanField(default=True)
    last_error = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("addon", "modification_key")
        ordering = ["template_type", "template", "execution_order", "modification_key"]

    def __str__(self):
        return self.modification_key


class AddonCompiledTemplate(models.Model):
    template_type = models.CharField(max_length=30)
    title = models.CharField(max_length=220)
    content = models.TextField(blank=True, default="")
    applied_modifications = models.JSONField(default=list, blank=True)
    checksum = models.CharField(max_length=128, blank=True, default="")
    rebuilt_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("template_type", "title")
        ordering = ["template_type", "title"]


class AddonStyleAsset(models.Model):
    addon = models.ForeignKey(Addon, on_delete=models.CASCADE, related_name="style_assets")
    key = models.CharField(max_length=180)
    asset_type = models.CharField(max_length=20, default="less")
    content = models.TextField(blank=True, default="")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("addon", "key")
        ordering = ["display_order", "key"]
