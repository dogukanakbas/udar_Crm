from django.db import migrations


PERMISSION_LABELS = {
    "users.view": "Kullanıcıları görüntüle",
    "users.create": "Kullanıcı oluştur",
    "users.edit": "Kullanıcı düzenle",
    "users.delete": "Kullanıcı sil",
    "roles.view": "Yetki gruplarını görüntüle",
    "roles.edit": "Yetki gruplarını düzenle",
    "partners.view": "Cari kartlarını görüntüle",
    "partners.create": "Cari kartı oluştur",
    "partners.edit": "Cari kartı düzenle",
    "partners.delete": "Cari kartı sil",
    "partners.export": "Cari kartlarını dışa aktar",
    "opportunities.view": "Fırsatları görüntüle",
    "opportunities.edit": "Fırsatları düzenle",
    "contacts.view": "Kişileri görüntüle",
    "contacts.edit": "Kişileri düzenle",
    "quotes.view.own": "Kendi teklif/sözleşmelerini görüntüle",
    "quotes.view.all": "Tüm teklif/sözleşmeleri görüntüle",
    "quotes.create": "Teklif/sözleşme oluştur",
    "quotes.edit.own": "Kendi teklif/sözleşmelerini düzenle",
    "quotes.edit.all": "Tüm teklif/sözleşmeleri düzenle",
    "quotes.delete": "Teklif/sözleşme sil",
    "quotes.status.change": "Durum değiştir",
    "quotes.convert": "Teklifi sözleşmeye dönüştür",
    "quotes.download": "Belge indir",
    "quotes.bulk.delete": "Toplu sil",
    "quotes.bulk.status": "Toplu durum değiştir",
    "quotes.prepare": "Teklif hazırlayan olarak seçilebilir",
    "quotes.approve": "Eski onay akışı işlemleri",
    "templates.view": "Şablon yönetimini görüntüle",
    "templates.products.edit": "Ürün grubu/şablon ürünlerini düzenle",
    "templates.seller_companies.edit": "Satıcı firmaları düzenle",
    "templates.document_terms.edit": "Teklif/sözleşme koşullarını düzenle",
    "templates.pricing.edit": "Fiyat listelerini düzenle",
    "templates.payment_options.edit": "Ödeme tiplerini düzenle",
    "templates.service_tax.edit": "Hizmet KDV oranını düzenle",
    "templates.excel.upload": "Excel şablonu yükle",
    "products.view": "Ürünleri görüntüle",
    "products.create": "Ürün oluştur",
    "products.edit": "Ürün düzenle",
    "products.delete": "Ürün sil",
    "products.bulk.delete": "Ürünleri toplu sil",
    "products.import": "Ürün içe aktar",
    "products.export": "Ürün dışa aktar",
    "erp.view": "ERP bölümünü görüntüle",
    "orders.view": "Siparişleri görüntüle",
    "orders.create": "Sipariş oluştur",
    "orders.edit": "Sipariş düzenle",
    "orders.delete": "Sipariş sil",
    "orders.receive": "Sipariş kabul/teslim al",
    "inventory.view": "Stok görüntüle",
    "inventory.edit": "Stok düzenle",
    "invoices.view": "Faturaları görüntüle",
    "invoices.edit": "Fatura düzenle",
    "invoices.pay": "Fatura tahsilat/ödeme işle",
    "accounting.view": "Muhasebe görüntüle",
    "logistics.view": "Lojistik görüntüle",
    "logistics.edit": "Lojistik düzenle",
    "vehicles.view": "Araçları görüntüle",
    "vehicles.edit": "Araçları düzenle",
    "tasks.view": "Görevleri görüntüle",
    "tasks.view.own": "Kendi görevlerini görüntüle",
    "tasks.create": "Görev oluştur",
    "tasks.edit": "Görev düzenle",
    "tasks.delete": "Görev sil",
    "tasks.assign": "Görev ataması yap",
    "tasks.handover": "Görev devret",
    "tasks.calendar.view": "Takvimi görüntüle",
    "teams.view": "Ekipleri görüntüle",
    "teams.edit": "Ekipleri düzenle",
    "worker_tracking.view": "Çalışan takibini görüntüle",
    "tickets.view": "Destek taleplerini görüntüle",
    "tickets.edit": "Destek taleplerini düzenle",
    "reports.view": "Raporları görüntüle",
    "audit.view": "Denetim kayıtlarını görüntüle",
    "access_logs.view": "Erişim loglarını görüntüle",
    "approvals.view": "Eski onay kayıtlarını görüntüle",
    "settings.view": "Ayarları görüntüle",
    "settings.organization.edit": "Organizasyon ayarlarını düzenle",
    "settings.security.edit": "Güvenlik ayarlarını düzenle",
}


LEGACY_ALIASES = {
    "quotes.view": ["quotes.view.own"],
    "quotes.edit": ["quotes.create", "quotes.edit.own", "quotes.status.change", "quotes.convert", "quotes.download"],
    "pricing.manage": [
        "templates.view",
        "templates.products.edit",
        "templates.seller_companies.edit",
        "templates.document_terms.edit",
        "templates.pricing.edit",
        "templates.payment_options.edit",
        "templates.service_tax.edit",
        "templates.excel.upload",
    ],
    "partners.edit": ["partners.create", "partners.edit"],
    "products.edit": ["products.create", "products.edit", "products.delete", "products.import", "products.export"],
    "orders.edit": ["orders.create", "orders.edit", "orders.delete"],
    "tasks.edit": ["tasks.create", "tasks.edit", "tasks.assign"],
    "audit.view": ["audit.view", "reports.view", "access_logs.view"],
}


def migrate_permission_catalog(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    permission_by_code = {}
    for code, label in PERMISSION_LABELS.items():
        permission, created = Permission.objects.get_or_create(code=code, defaults={"description": label})
        if not created and permission.description != label:
            permission.description = label
            permission.save(update_fields=["description"])
        permission_by_code[code] = permission

    for role, legacy_code in RolePermission.objects.select_related("permission").values_list("role", "permission__code"):
        for new_code in LEGACY_ALIASES.get(legacy_code, []):
            permission = permission_by_code.get(new_code)
            if permission:
                RolePermission.objects.get_or_create(role=role, permission=permission)

    for permission in permission_by_code.values():
        RolePermission.objects.get_or_create(role="Admin", permission=permission)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_organizationsettings_document_terms"),
    ]

    operations = [
        migrations.RunPython(migrate_permission_catalog, migrations.RunPython.noop),
    ]
