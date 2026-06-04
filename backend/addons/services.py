import hashlib
import json
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from addons.models import (
    Addon,
    AddonAsset,
    AddonCompiledTemplate,
    AddonDataImport,
    AddonEventListener,
    AddonInstallLog,
    AddonLanguage,
    AddonNavigation,
    AddonOption,
    AddonPhrase,
    AddonRoute,
    AddonStyleAsset,
    AddonTemplate,
    AddonTemplateModification,
    AddonVersion,
    NavigationItem,
)


ADDON_ROOT = Path(settings.BASE_DIR) / "addons"
CORE_VERSION = "1.0.0"
SYSTEM_GROUPS = [
    ("Admin", "Yöneticiler", 10),
    ("Manager", "Yönetim", 20),
    ("Sales", "Satış", 30),
    ("Finance", "Finans", 40),
    ("Support", "Destek", 50),
    ("Warehouse", "Depo", 60),
    ("Worker", "Çalışan", 70),
]

DEFAULT_NAVIGATION_ITEMS = [
    {"key": "dashboard", "label": "Kontrol Paneli", "route": "/", "icon": "Home", "permission": "settings.view", "order": 10},
    {"key": "worker_home", "label": "Görevlerim", "route": "/", "icon": "Home", "order": 20, "meta": {"roles": ["Worker"]}},
    {"key": "task_history", "label": "Geçmiş görevler", "route": "/task-history", "icon": "CalendarClock", "permission": "tasks.view.own", "order": 30},
    {"key": "change_password", "label": "Şifre değiştir", "route": "/change-password", "icon": "KeyRound", "order": 40},
    {"key": "crm", "label": "CRM", "icon": "Gauge", "order": 100},
    {"key": "opportunities", "label": "Fırsatlar", "parent": "crm", "route": "/crm/opportunities", "permission": "opportunities.view", "order": 110},
    {"key": "partners", "label": "Cari Kartı", "parent": "crm", "route": "/crm/companies", "permission": "partners.view", "order": 120},
    {"key": "contacts", "label": "Kişiler", "parent": "crm", "route": "/crm/contacts", "permission": "contacts.view", "order": 130},
    {"key": "quotes", "label": "Teklif & Sözleşmeler", "parent": "crm", "route": "/crm/quotes", "permission": "quotes.view.own", "order": 140},
    {"key": "seller_companies", "label": "Satıcı Firmalar", "parent": "crm", "route": "/crm/seller-companies", "permission": "templates.seller_companies.edit", "order": 150},
    {"key": "quote_templates", "label": "Şablon Yönetimi", "parent": "crm", "route": "/crm/quote-templates", "permission": "templates.view", "order": 160},
    {"key": "erp", "label": "ERP", "icon": "Package", "permission": "erp.view", "order": 200},
    {"key": "sales_orders", "label": "Satış Siparişleri", "parent": "erp", "route": "/erp/sales-orders", "permission": "orders.view", "order": 210},
    {"key": "purchases", "label": "Satınalma", "parent": "erp", "route": "/erp/purchases", "permission": "orders.view", "order": 220},
    {"key": "inventory", "label": "Stok", "parent": "erp", "route": "/erp/inventory", "permission": "inventory.view", "order": 230},
    {"key": "warehouse_management", "label": "Depo Yönetimi", "parent": "erp", "route": "/erp/warehouse-management", "permission": "warehouses.manage", "order": 240},
    {"key": "warehouse", "label": "Depo", "parent": "erp", "route": "/erp/warehouse", "permission": "warehouse_stock.view", "order": 250},
    {"key": "production", "label": "İmalat Yönetimi", "parent": "erp", "route": "/erp/production", "permission": "production.view", "order": 260},
    {"key": "production_orders", "label": "İş Emirleri", "parent": "erp", "route": "/erp/production/orders", "permission": "production.work_orders.view", "order": 270},
    {"key": "production_console", "label": "İstasyon Konsolu", "parent": "erp", "route": "/erp/production/console", "permission": "production.station.operate", "order": 280},
    {"key": "production_reports", "label": "İmalat Raporları", "parent": "erp", "route": "/erp/production/reports", "permission": "production.reports.view", "order": 290},
    {"key": "invoicing", "label": "Faturalama", "parent": "erp", "route": "/erp/invoicing", "permission": "invoices.view", "order": 300},
    {"key": "accounting", "label": "Muhasebe", "parent": "erp", "route": "/erp/accounting", "permission": "accounting.view", "order": 310},
    {"key": "logistics", "label": "Lojistik Takip", "parent": "erp", "route": "/logistics/tracking", "permission": "logistics.view", "order": 320},
    {"key": "mdf", "label": "MDF Yönetimi", "parent": "erp", "route": "/mdf", "permission": "inventory.view", "order": 330},
    {"key": "mdf_history", "label": "MDF Giriş / Çıkış", "parent": "erp", "route": "/mdf/history", "permission": "inventory.view", "order": 340},
    {"key": "support", "label": "Destek", "icon": "Activity", "order": 400},
    {"key": "tickets", "label": "Destek talepleri", "parent": "support", "route": "/support/tickets", "permission": "tickets.view", "order": 410},
    {"key": "tasks", "label": "Görevler", "route": "/tasks", "icon": "FolderKanban", "permission": "tasks.view", "order": 500},
    {"key": "worker_tracking", "label": "Çalışan Takibi", "route": "/worker-tracking", "icon": "Activity", "permission": "worker_tracking.view", "order": 510},
    {"key": "calendar", "label": "Takvim", "route": "/calendar", "icon": "CalendarClock", "permission": "tasks.calendar.view", "order": 520},
    {"key": "reports", "label": "Raporlar", "route": "/reports", "icon": "BarChart3", "permission": "reports.view", "order": 530},
    {"key": "settings", "label": "Ayarlar", "route": "/settings", "icon": "Settings", "permission": "settings.view", "order": 540},
]


class AddonError(ValueError):
    pass


def _json_file(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _stable_hash(payload) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _manifest_path(addon_path: Path) -> Path:
    return addon_path / "addon.json"


def validate_manifest(addon_path: Path) -> dict:
    manifest_file = _manifest_path(addon_path)
    if not manifest_file.exists():
        raise AddonError(f"addon.json bulunamadı: {addon_path}")
    manifest = _json_file(manifest_file, {})
    addon_id = manifest.get("id")
    title = manifest.get("title")
    if not addon_id or "/" not in addon_id:
        raise AddonError("Add-on id Vendor/Addon formatında olmalı.")
    if not title:
        raise AddonError("Add-on title zorunludur.")
    return manifest


def discover_addons() -> list[dict]:
    discovered: list[dict] = []
    if not ADDON_ROOT.exists():
        return discovered
    for manifest_file in ADDON_ROOT.glob("*/*/addon.json"):
        addon_path = manifest_file.parent
        try:
            manifest = validate_manifest(addon_path)
            discovered.append({"path": str(addon_path), "manifest": manifest})
        except AddonError as exc:
            AddonInstallLog.objects.create(
                raw_addon_id=str(addon_path),
                action="error",
                message=str(exc),
            )
    return discovered


def _addon_from_manifest(addon_path: Path, manifest: dict) -> Addon:
    addon, _ = Addon.objects.update_or_create(
        addon_id=manifest["id"],
        defaults={
            "title": manifest.get("title", manifest["id"]),
            "vendor": manifest.get("vendor", manifest["id"].split("/")[0]),
            "version": str(manifest.get("version", manifest.get("version_string", ""))),
            "version_id": int(manifest.get("version_id") or 0),
            "min_core_version": str(manifest.get("min_core_version", "")),
            "manifest": manifest,
            "path": str(addon_path),
            "is_system": bool(manifest.get("is_system", False)),
        },
    )
    return addon


def sync_discovered_addons(actor=None) -> list[Addon]:
    addons: list[Addon] = []
    for item in discover_addons():
        addon_path = Path(item["path"])
        addon = _addon_from_manifest(addon_path, item["manifest"])
        addons.append(addon)
    return addons


def _data(addon_path: Path, name: str, default):
    return _json_file(addon_path / "_data" / f"{name}.json", default)


def _xml_root(addon_path: Path, name: str):
    xml_path = addon_path / "_data" / f"{name}.xml"
    if not xml_path.exists():
        return None
    return ET.parse(xml_path).getroot()


def _import_permissions(addon: Addon, addon_path: Path) -> int:
    from accounts.models import Permission, PermissionGroup

    payload = _data(addon_path, "permissions", {})
    count = 0
    groups = payload.get("groups", [])
    permissions = payload.get("permissions", [])
    group_by_id = {}
    for item in groups:
        group, _ = PermissionGroup.objects.update_or_create(
            group_id=item["id"],
            defaults={
                "title": item.get("title", item["id"]),
                "addon_id": addon.addon_id,
                "display_order": int(item.get("display_order") or 0),
            },
        )
        group_by_id[group.group_id] = group
    for item in permissions:
        group = group_by_id.get(item.get("group"))
        Permission.objects.update_or_create(
            code=item["code"],
            defaults={
                "description": item.get("title", item["code"]),
                "addon_id": addon.addon_id,
                "permission_group": group,
                "permission_type": item.get("type", "boolean"),
                "display_order": int(item.get("display_order") or 0),
                "is_active": True,
            },
        )
        count += 1
    Permission.objects.filter(addon_id=addon.addon_id).exclude(code__in=[p["code"] for p in permissions]).update(is_active=False)
    _record_import(addon, "permissions", payload, count)
    return count


def _import_navigation(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "navigation", [])
    seen = []
    for item in payload:
        seen.append(item["key"])
        AddonNavigation.objects.update_or_create(
            addon=addon,
            key=item["key"],
            defaults={
                "label": item.get("label", item["key"]),
                "parent_key": item.get("parent", ""),
                "route": item.get("route", ""),
                "icon": item.get("icon", "FolderKanban"),
                "required_permission": item.get("permission", ""),
                "display_order": int(item.get("display_order") or 0),
                "is_active": True,
                "meta": item.get("meta", {}),
            },
        )
    AddonNavigation.objects.filter(addon=addon).exclude(key__in=seen).update(is_active=False)
    _record_import(addon, "navigation", payload, len(seen))
    return len(seen)


def seed_default_navigation_items():
    for item in DEFAULT_NAVIGATION_ITEMS:
        NavigationItem.objects.update_or_create(
            organization=None,
            key=item["key"],
            defaults={
                "label": item["label"],
                "parent_key": item.get("parent", ""),
                "route": item.get("route", ""),
                "icon": item.get("icon", "FolderKanban"),
                "required_permission": item.get("permission", ""),
                "display_order": item.get("order", 0),
                "is_active": True,
                "is_system": True,
                "meta": item.get("meta", {}),
            },
        )


def ensure_organization_navigation(organization):
    seed_default_navigation_items()
    if not organization:
        return False
    if NavigationItem.objects.filter(organization=organization).exists():
        return True
    defaults = NavigationItem.objects.filter(organization__isnull=True).order_by("display_order", "label")
    for item in defaults:
        NavigationItem.objects.create(
            organization=organization,
            key=item.key,
            label=item.label,
            parent_key=item.parent_key,
            route=item.route,
            icon=item.icon,
            required_permission=item.required_permission,
            display_order=item.display_order,
            is_active=item.is_active,
            is_system=item.is_system,
            meta=item.meta,
        )
    return True


def reset_organization_navigation(organization):
    if not organization:
        return
    NavigationItem.objects.filter(organization=organization).delete()
    ensure_organization_navigation(organization)


def navigation_item_payload(item: NavigationItem, user=None, include_inactive=False) -> dict | None:
    from accounts.utils import user_has_perm

    roles = item.meta.get("roles") if isinstance(item.meta, dict) else None
    if user is not None and roles and getattr(user, "role", "") not in roles:
        return None
    if user is not None and item.required_permission and not user_has_perm(user, item.required_permission):
        return None
    if not include_inactive and not item.is_active:
        return None
    return {
        "id": item.id,
        "key": item.key,
        "label": item.label,
        "parent": item.parent_key,
        "parent_key": item.parent_key,
        "route": item.route,
        "icon": item.icon,
        "permission": item.required_permission,
        "required_permission": item.required_permission,
        "display_order": item.display_order,
        "is_active": item.is_active,
        "is_system": item.is_system,
        "source": "designer",
        "meta": item.meta,
    }


def _import_routes(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "routes", [])
    seen = []
    for item in payload:
        kind = item.get("kind", "frontend")
        key = item["key"]
        seen.append((kind, key))
        AddonRoute.objects.update_or_create(
            addon=addon,
            kind=kind,
            key=key,
            defaults={
                "path": item.get("path", ""),
                "binding": item.get("binding", ""),
                "required_permission": item.get("permission", ""),
                "is_active": True,
                "meta": item.get("meta", {}),
            },
        )
    for route in AddonRoute.objects.filter(addon=addon):
        if (route.kind, route.key) not in seen:
            route.is_active = False
            route.save(update_fields=["is_active"])
    _record_import(addon, "routes", payload, len(seen))
    return len(seen)


def _import_options(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "options", [])
    seen = []
    for item in payload:
        seen.append(item["key"])
        AddonOption.objects.update_or_create(
            addon=addon,
            key=item["key"],
            defaults={
                "title": item.get("title", item["key"]),
                "value": item.get("value", item.get("default", {})),
                "default_value": item.get("default", {}),
                "option_type": item.get("type", "text"),
                "display_order": int(item.get("display_order") or 0),
                "is_active": True,
            },
        )
    AddonOption.objects.filter(addon=addon).exclude(key__in=seen).update(is_active=False)
    _record_import(addon, "options", payload, len(seen))
    return len(seen)


def _import_events(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "events", [])
    AddonEventListener.objects.filter(addon=addon).delete()
    for item in payload:
        AddonEventListener.objects.create(
            addon=addon,
            event=item["event"],
            handler=item.get("handler", ""),
            priority=int(item.get("priority") or 100),
            is_active=True,
            config=item.get("config", {}),
        )
    _record_import(addon, "events", payload, len(payload))
    return len(payload)


def _import_assets(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "assets", [])
    seen = []
    for item in payload:
        seen.append(item["key"])
        AddonAsset.objects.update_or_create(
            addon=addon,
            key=item["key"],
            defaults={
                "asset_type": item.get("type", "bundle"),
                "path": item.get("path", ""),
                "integrity_hash": item.get("hash", ""),
                "is_active": True,
            },
        )
    AddonAsset.objects.filter(addon=addon).exclude(key__in=seen).update(is_active=False)
    _record_import(addon, "assets", payload, len(seen))
    return len(seen)


def _import_languages(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "languages", [
        {"language_id": "tr-TR", "title": "Türkçe", "is_default": True},
        {"language_id": "en-US", "title": "English"},
    ])
    for item in payload:
        AddonLanguage.objects.update_or_create(
            language_id=item.get("language_id", "tr-TR"),
            defaults={
                "title": item.get("title", item.get("language_id", "tr-TR")),
                "fallback_language_id": item.get("fallback_language_id", ""),
                "is_default": bool(item.get("is_default", False)),
                "is_active": bool(item.get("is_active", True)),
            },
        )
    if not AddonLanguage.objects.filter(is_default=True).exists():
        AddonLanguage.objects.filter(language_id="tr-TR").update(is_default=True)
    _record_import(addon, "languages", payload, len(payload))
    return len(payload)


def _phrase_items(addon_path: Path) -> list[dict]:
    payload = _data(addon_path, "phrases", None)
    if payload is not None:
        return payload
    root = _xml_root(addon_path, "phrases")
    if root is None:
        return []
    return [
        {
            "title": item.attrib.get("title", ""),
            "text": item.text or "",
            "language_id": item.attrib.get("language_id", "tr-TR"),
            "version_id": int(item.attrib.get("version_id") or 0),
            "version": item.attrib.get("version_string", ""),
        }
        for item in root.findall("phrase")
        if item.attrib.get("title")
    ]


def _import_phrases(addon: Addon, addon_path: Path) -> int:
    items = _phrase_items(addon_path)
    seen = []
    for item in items:
        language_id = item.get("language_id") or "tr-TR"
        title = item["title"]
        seen.append((language_id, title))
        AddonPhrase.objects.update_or_create(
            language_id=language_id,
            title=title,
            defaults={
                "addon": addon,
                "text": item.get("text", ""),
                "version_id": int(item.get("version_id") or 0),
                "version": item.get("version", ""),
                "is_active": True,
            },
        )
    for phrase in AddonPhrase.objects.filter(addon=addon):
        if (phrase.language_id, phrase.title) not in seen:
            phrase.is_active = False
            phrase.save(update_fields=["is_active"])
    _record_import(addon, "phrases", items, len(items))
    return len(items)


def _template_items(addon_path: Path) -> list[dict]:
    payload = _data(addon_path, "templates", None)
    if payload is not None:
        return payload
    root = _xml_root(addon_path, "templates")
    if root is None:
        return []
    return [
        {
            "type": item.attrib.get("type", "frontend"),
            "title": item.attrib.get("title", ""),
            "content": item.text or "",
            "version_id": int(item.attrib.get("version_id") or 0),
            "version": item.attrib.get("version_string", ""),
        }
        for item in root.findall("template")
        if item.attrib.get("title")
    ]


def _import_templates(addon: Addon, addon_path: Path) -> int:
    items = _template_items(addon_path)
    seen = []
    for item in items:
        template_type = item.get("type", item.get("template_type", "frontend"))
        title = item["title"]
        seen.append((template_type, title))
        AddonTemplate.objects.update_or_create(
            template_type=template_type,
            title=title,
            defaults={
                "addon": addon,
                "content": item.get("content", ""),
                "version_id": int(item.get("version_id") or 0),
                "version": item.get("version", ""),
                "is_active": True,
            },
        )
    for template in AddonTemplate.objects.filter(addon=addon):
        if (template.template_type, template.title) not in seen:
            template.is_active = False
            template.save(update_fields=["is_active"])
    _record_import(addon, "templates", items, len(items))
    return len(items)


def _template_modification_items(addon_path: Path) -> list[dict]:
    payload = _data(addon_path, "template_modifications", None)
    if payload is not None:
        return payload
    root = _xml_root(addon_path, "template_modifications")
    if root is None:
        return []
    items = []
    for item in root.findall("modification"):
        items.append({
            "type": item.attrib.get("type", "frontend"),
            "template": item.attrib.get("template", ""),
            "modification_key": item.attrib.get("modification_key", ""),
            "description": item.attrib.get("description", ""),
            "execution_order": int(item.attrib.get("execution_order") or 10),
            "enabled": item.attrib.get("enabled", "1") not in {"0", "false", "False"},
            "action": item.attrib.get("action", "str_replace"),
            "find": (item.findtext("find") or ""),
            "replace": (item.findtext("replace") or ""),
        })
    return [item for item in items if item.get("template") and item.get("modification_key")]


def _import_template_modifications(addon: Addon, addon_path: Path) -> int:
    items = _template_modification_items(addon_path)
    seen = []
    for item in items:
        key = item["modification_key"]
        seen.append(key)
        AddonTemplateModification.objects.update_or_create(
            addon=addon,
            modification_key=key,
            defaults={
                "template_type": item.get("type", item.get("template_type", "frontend")),
                "template": item.get("template", ""),
                "description": item.get("description", ""),
                "action": item.get("action", "str_replace"),
                "find": item.get("find", ""),
                "replace": item.get("replace", ""),
                "execution_order": int(item.get("execution_order") or 10),
                "enabled": bool(item.get("enabled", True)),
                "last_error": "",
                "is_active": True,
            },
        )
    AddonTemplateModification.objects.filter(addon=addon).exclude(modification_key__in=seen).update(is_active=False)
    _record_import(addon, "template_modifications", items, len(items))
    return len(items)


def _import_style_assets(addon: Addon, addon_path: Path) -> int:
    payload = _data(addon_path, "style_assets", [])
    file_items = []
    for pattern, asset_type in [("*.less", "less"), ("*.css", "css")]:
        for asset_file in (addon_path / "styles").glob(pattern):
            file_items.append({
                "key": asset_file.name,
                "type": asset_type,
                "content": asset_file.read_text(encoding="utf-8"),
                "display_order": 100,
            })
    items = [*payload, *file_items]
    seen = []
    for item in items:
        key = item["key"]
        seen.append(key)
        AddonStyleAsset.objects.update_or_create(
            addon=addon,
            key=key,
            defaults={
                "asset_type": item.get("type", "less"),
                "content": item.get("content", ""),
                "display_order": int(item.get("display_order") or 0),
                "is_active": True,
            },
        )
    AddonStyleAsset.objects.filter(addon=addon).exclude(key__in=seen).update(is_active=False)
    _record_import(addon, "style_assets", items, len(items))
    return len(items)


def _apply_modification(content: str, modification: AddonTemplateModification) -> tuple[str, str]:
    if modification.action == "append":
        return content + modification.replace, ""
    if modification.action == "prepend":
        return modification.replace + content, ""
    if modification.action == "preg_replace":
        pattern = modification.find
        if pattern.startswith("/") and pattern.count("/") >= 2:
            pattern = pattern.strip("/")
        try:
            next_content, count = re.subn(pattern, modification.replace, content, count=1)
        except re.error as exc:
            return content, str(exc)
        return (next_content, "" if count else "Eşleşme bulunamadı")
    if modification.find not in content:
        return content, "Eşleşme bulunamadı"
    return content.replace(modification.find, modification.replace, 1), ""


def rebuild_templates(addon_id: str | None = None) -> int:
    templates = AddonTemplate.objects.filter(is_active=True, addon__is_installed=True, addon__is_enabled=True)
    if addon_id:
        template_keys = AddonTemplateModification.objects.filter(addon__addon_id=addon_id).values_list("template_type", "template")
        keys = list(template_keys)
        templates = templates.filter(template_type__in=[key[0] for key in keys], title__in=[key[1] for key in keys]) | templates.filter(addon__addon_id=addon_id)
    count = 0
    for template in templates.distinct():
        content = template.content
        applied = []
        mods = AddonTemplateModification.objects.filter(
            template_type=template.template_type,
            template=template.title,
            enabled=True,
            is_active=True,
            addon__is_installed=True,
            addon__is_enabled=True,
        ).select_related("addon")
        for mod in mods:
            content, error = _apply_modification(content, mod)
            mod.last_error = error
            mod.save(update_fields=["last_error"])
            if not error:
                applied.append(mod.modification_key)
        AddonCompiledTemplate.objects.update_or_create(
            template_type=template.template_type,
            title=template.title,
            defaults={
                "content": content,
                "applied_modifications": applied,
                "checksum": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            },
        )
        count += 1
    return count


def _record_import(addon: Addon, data_type: str, payload, count: int):
    AddonDataImport.objects.update_or_create(
        addon=addon,
        data_type=data_type,
        defaults={"checksum": _stable_hash(payload), "count": count},
    )


@transaction.atomic
def install_addon(addon_id: str, actor=None, enable: bool = True) -> Addon:
    manifest_item = next((item for item in discover_addons() if item["manifest"].get("id") == addon_id), None)
    if not manifest_item:
        raise AddonError(f"Add-on bulunamadı: {addon_id}")
    addon_path = Path(manifest_item["path"])
    manifest = manifest_item["manifest"]
    addon = _addon_from_manifest(addon_path, manifest)

    missing_dependencies = [
        dep for dep in manifest.get("dependencies", [])
        if not Addon.objects.filter(addon_id=dep, is_installed=True, is_enabled=True).exists()
    ]
    if missing_dependencies:
        raise AddonError(f"Eksik bağımlılıklar: {', '.join(missing_dependencies)}")

    _import_permissions(addon, addon_path)
    _import_languages(addon, addon_path)
    _import_phrases(addon, addon_path)
    _import_templates(addon, addon_path)
    _import_template_modifications(addon, addon_path)
    _import_style_assets(addon, addon_path)
    _import_navigation(addon, addon_path)
    _import_routes(addon, addon_path)
    _import_options(addon, addon_path)
    _import_events(addon, addon_path)
    _import_assets(addon, addon_path)

    addon.is_installed = True
    addon.is_enabled = enable
    addon.installed_at = addon.installed_at or timezone.now()
    addon.save(update_fields=["is_installed", "is_enabled", "installed_at", "updated_at"])
    AddonVersion.objects.create(
        addon=addon,
        version=addon.version,
        version_id=addon.version_id,
        manifest_hash=_stable_hash(manifest),
    )
    AddonInstallLog.objects.create(addon=addon, raw_addon_id=addon.addon_id, action="install", actor=actor)
    rebuild_templates(addon.addon_id)
    rebuild_all_permission_caches()
    return addon


def enable_addon(addon_id: str, actor=None) -> Addon:
    addon = Addon.objects.get(addon_id=addon_id)
    addon.is_enabled = True
    addon.save(update_fields=["is_enabled", "updated_at"])
    AddonInstallLog.objects.create(addon=addon, raw_addon_id=addon.addon_id, action="enable", actor=actor)
    rebuild_templates(addon.addon_id)
    rebuild_all_permission_caches()
    return addon


def disable_addon(addon_id: str, actor=None) -> Addon:
    addon = Addon.objects.get(addon_id=addon_id)
    addon.is_enabled = False
    addon.save(update_fields=["is_enabled", "updated_at"])
    AddonInstallLog.objects.create(addon=addon, raw_addon_id=addon.addon_id, action="disable", actor=actor)
    rebuild_templates(addon.addon_id)
    rebuild_all_permission_caches()
    return addon


def uninstall_addon(addon_id: str, actor=None) -> Addon:
    addon = Addon.objects.get(addon_id=addon_id)
    addon.is_installed = False
    addon.is_enabled = False
    addon.save(update_fields=["is_installed", "is_enabled", "updated_at"])
    AddonInstallLog.objects.create(addon=addon, raw_addon_id=addon.addon_id, action="uninstall", actor=actor)
    rebuild_templates(addon.addon_id)
    rebuild_all_permission_caches()
    return addon


@transaction.atomic
def delete_addon(addon_id: str, actor=None) -> None:
    addon = Addon.objects.get(addon_id=addon_id)
    if addon.is_system:
        raise AddonError("Sistem add-on'u fiziksel olarak silinemez.")
    addon_path = Path(addon.path)
    raw_id = addon.addon_id
    addon.delete()
    if addon_path.exists() and addon_path.resolve().is_relative_to(ADDON_ROOT.resolve()):
        shutil.rmtree(addon_path)
    AddonInstallLog.objects.create(raw_addon_id=raw_id, action="uninstall", actor=actor, message="Add-on dosyaları ve metadata silindi.")
    rebuild_templates()
    rebuild_all_permission_caches()


def install_builtin_addons():
    sync_discovered_addons()
    discovered = discover_addons()
    for addon in Addon.objects.filter(addon_id__in=[item["manifest"]["id"] for item in discovered]):
        if not addon.is_installed:
            install_addon(addon.addon_id)
            continue
        item = next((entry for entry in discovered if entry["manifest"]["id"] == addon.addon_id), None)
        if not item:
            continue
        addon_path = Path(item["path"])
        has_all_imports = all(
            AddonDataImport.objects.filter(addon=addon, data_type=data_type).exists()
            for data_type in ["permissions", "phrases", "templates", "template_modifications", "style_assets"]
        )
        if not has_all_imports:
            _import_permissions(addon, addon_path)
            _import_languages(addon, addon_path)
            _import_phrases(addon, addon_path)
            _import_templates(addon, addon_path)
            _import_template_modifications(addon, addon_path)
            _import_style_assets(addon, addon_path)
            _import_navigation(addon, addon_path)
            _import_routes(addon, addon_path)
            _import_options(addon, addon_path)
            _import_events(addon, addon_path)
            _import_assets(addon, addon_path)
            rebuild_templates(addon.addon_id)


def filtered_navigation(user) -> list[dict]:
    from accounts.utils import user_has_perm

    organization = getattr(user, "organization", None)
    ensure_organization_navigation(organization)
    org_rows = NavigationItem.objects.filter(organization=organization, is_active=True).order_by("display_order", "label")
    visible = []
    seen = set()
    for item in org_rows:
        payload = navigation_item_payload(item, user=user)
        if not payload:
            continue
        visible.append(payload)
        seen.add(item.key)

    rows = AddonNavigation.objects.filter(addon__is_installed=True, addon__is_enabled=True, is_active=True).select_related("addon")
    for item in rows:
        if item.key in seen:
            continue
        if item.required_permission and not user_has_perm(user, item.required_permission):
            continue
        visible.append({
            "key": item.key,
            "label": item.label,
            "parent": item.parent_key,
            "route": item.route,
            "icon": item.icon,
            "permission": item.required_permission,
            "display_order": item.display_order,
            "addon_id": item.addon.addon_id,
            "meta": item.meta,
            "source": "addon",
        })
    return visible


def editable_navigation_payload(organization) -> list[dict]:
    ensure_organization_navigation(organization)
    rows = NavigationItem.objects.filter(organization=organization).order_by("display_order", "label")
    return [navigation_item_payload(item, include_inactive=True) for item in rows]


def filtered_routes(user) -> list[dict]:
    from accounts.utils import user_has_perm

    rows = AddonRoute.objects.filter(addon__is_installed=True, addon__is_enabled=True, is_active=True).select_related("addon")
    visible = []
    for route in rows:
        if route.required_permission and not user_has_perm(user, route.required_permission):
            continue
        visible.append({
            "kind": route.kind,
            "key": route.key,
            "path": route.path,
            "binding": route.binding,
            "permission": route.required_permission,
            "addon_id": route.addon.addon_id,
            "meta": route.meta,
        })
    return visible


def permission_catalog_payload() -> dict:
    from accounts.models import Permission, PermissionGroup

    groups = []
    for group in PermissionGroup.objects.all().order_by("display_order", "title"):
        perms = Permission.objects.filter(permission_group=group, is_active=True).order_by("display_order", "code")
        groups.append({
            "key": group.group_id,
            "label": group.title,
            "addon_id": group.addon_id,
            "permissions": [[perm.code, perm.description or perm.code] for perm in perms],
        })
    ungrouped = Permission.objects.filter(permission_group__isnull=True, is_active=True).order_by("code")
    if ungrouped.exists():
        groups.append({
            "key": "other",
            "label": "Diğer izinler",
            "addon_id": "",
            "permissions": [[perm.code, perm.description or perm.code] for perm in ungrouped],
        })
    permissions = [code for group in groups for code, _ in group["permissions"]]
    return {"permissions": permissions, "catalog": groups}


def phrase_bundle(language_id: str = "tr-TR") -> dict[str, str]:
    language = AddonLanguage.objects.filter(language_id=language_id, is_active=True).first()
    fallback_ids = ["tr-TR"]
    if language and language.fallback_language_id:
        fallback_ids.insert(0, language.fallback_language_id)
    fallback_ids.append(language_id)
    bundle: dict[str, str] = {}
    for lang in fallback_ids:
        rows = AddonPhrase.objects.filter(
            language_id=lang,
            is_active=True,
            addon__is_installed=True,
            addon__is_enabled=True,
        ).order_by("title")
        for row in rows:
            bundle[row.title] = row.text
    return bundle


def phrase(title: str, language_id: str = "tr-TR", **params) -> str:
    text = phrase_bundle(language_id).get(title, title)
    for key, value in params.items():
        text = text.replace("{" + key + "}", str(value))
    return text


def style_bundle() -> str:
    rows = AddonStyleAsset.objects.filter(
        is_active=True,
        addon__is_installed=True,
        addon__is_enabled=True,
    ).select_related("addon").order_by("addon__addon_id", "display_order", "key")
    parts = []
    for row in rows:
        parts.append(f"/* {row.addon.addon_id}:{row.key} */\n{row.content}")
    return "\n\n".join(parts)


def safe_extract_addon_zip(uploaded_file) -> dict:
    with zipfile.ZipFile(uploaded_file) as archive:
        names = archive.namelist()
        if any(name.startswith("/") or ".." in Path(name).parts for name in names):
            raise AddonError("ZIP içinde güvenli olmayan dosya yolu var.")
        manifest_names = [name for name in names if name.endswith("addon.json")]
        if len(manifest_names) != 1:
            raise AddonError("ZIP içinde tek bir addon.json bulunmalı.")
        manifest = json.loads(archive.read(manifest_names[0]).decode("utf-8"))
        addon_id = manifest.get("id", "")
        if "/" not in addon_id:
            raise AddonError("Add-on id Vendor/Addon formatında olmalı.")
        vendor, name = addon_id.split("/", 1)
        target = ADDON_ROOT / vendor / name
        target.mkdir(parents=True, exist_ok=True)
        for member in names:
            if member.endswith("/"):
                continue
            relative_parts = Path(member).parts
            # ZIP kök klasörü opsiyoneldir; manifest hangi klasördeyse onu kök kabul ederiz.
            manifest_parent = Path(manifest_names[0]).parent
            relative = Path(member).relative_to(manifest_parent) if str(manifest_parent) != "." and member.startswith(str(manifest_parent)) else Path(member)
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(member))
    validate_manifest(target)
    return {"addon_id": addon_id, "path": str(target)}


def rebuild_all_permission_caches():
    from accounts.utils import rebuild_effective_permissions, sync_user_groups

    sync_user_groups()
    rebuild_effective_permissions()
