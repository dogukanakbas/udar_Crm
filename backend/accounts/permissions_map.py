PERMISSION_CATALOG = [
    {
        "key": "users",
        "label": "Kullanıcılar ve roller",
        "description": "Kullanıcı, grup ve rol yetkileri.",
        "permissions": [
            ("users.view", "Kullanıcıları görüntüle"),
            ("users.create", "Kullanıcı oluştur"),
            ("users.edit", "Kullanıcı düzenle"),
            ("users.delete", "Kullanıcı sil"),
            ("roles.view", "Yetki gruplarını görüntüle"),
            ("roles.edit", "Yetki gruplarını düzenle"),
        ],
    },
    {
        "key": "partners",
        "label": "Cari kartı",
        "description": "Müşteri/cari kartları ve dışa aktarım işlemleri.",
        "permissions": [
            ("partners.view", "Cari kartlarını görüntüle"),
            ("partners.create", "Cari kartı oluştur"),
            ("partners.edit", "Cari kartı düzenle"),
            ("partners.delete", "Cari kartı sil"),
            ("partners.import", "Cari kartlarını Excel'den içe aktar"),
            ("partners.export", "Cari kartlarını dışa aktar"),
        ],
    },
    {
        "key": "crm_records",
        "label": "CRM yardımcı kayıtları",
        "description": "Fırsatlar ve kişiler gibi yönetim amaçlı CRM kayıtları.",
        "permissions": [
            ("opportunities.view", "Fırsatları görüntüle"),
            ("opportunities.edit", "Fırsatları düzenle"),
            ("contacts.view", "Kişileri görüntüle"),
            ("contacts.edit", "Kişileri düzenle"),
        ],
    },
    {
        "key": "quotes",
        "label": "Teklif ve sözleşmeler",
        "description": "Teklif/sözleşme görüntüleme, oluşturma, durum ve toplu işlemler.",
        "permissions": [
            ("quotes.view.own", "Kendi teklif/sözleşmelerini görüntüle"),
            ("quotes.view.all", "Tüm teklif/sözleşmeleri görüntüle"),
            ("quotes.create", "Teklif/sözleşme oluştur"),
            ("quotes.edit.own", "Kendi teklif/sözleşmelerini düzenle"),
            ("quotes.edit.all", "Tüm teklif/sözleşmeleri düzenle"),
            ("quotes.delete", "Teklif/sözleşme sil"),
            ("quotes.status.change", "Durum değiştir"),
            ("quotes.convert", "Teklifi sözleşmeye dönüştür"),
            ("quotes.download", "Belge indir"),
            ("quotes.bulk.delete", "Toplu sil"),
            ("quotes.bulk.status", "Toplu durum değiştir"),
            ("quotes.prepare", "Teklif hazırlayan olarak seçilebilir"),
            ("quotes.approve", "Eski onay akışı işlemleri"),
        ],
    },
    {
        "key": "templates",
        "label": "Şablon yönetimi",
        "description": "Ürün grupları, satıcı firmalar, belge koşulları ve belge sabitleri.",
        "permissions": [
            ("templates.view", "Şablon yönetimini görüntüle"),
            ("templates.products.edit", "Ürün grubu/şablon ürünlerini düzenle"),
            ("templates.seller_companies.edit", "Satıcı firmaları düzenle"),
            ("templates.document_terms.edit", "Teklif/sözleşme koşullarını düzenle"),
            ("templates.pricing.edit", "Fiyat listelerini düzenle"),
            ("templates.payment_options.edit", "Ödeme tiplerini düzenle"),
            ("templates.service_tax.edit", "Hizmet KDV oranını düzenle"),
            ("templates.excel.upload", "Excel şablonu yükle"),
        ],
    },
    {
        "key": "products",
        "label": "Ürünler",
        "description": "Ürün kataloğu ve toplu aktarım işlemleri.",
        "permissions": [
            ("products.view", "Ürünleri görüntüle"),
            ("products.create", "Ürün oluştur"),
            ("products.edit", "Ürün düzenle"),
            ("products.delete", "Ürün sil"),
            ("products.bulk.delete", "Ürünleri toplu sil"),
            ("products.import", "Ürün içe aktar"),
            ("products.export", "Ürün dışa aktar"),
        ],
    },
    {
        "key": "erp",
        "label": "ERP",
        "description": "Sipariş, stok, fatura, muhasebe ve lojistik modülleri.",
        "permissions": [
            ("erp.view", "ERP bölümünü görüntüle"),
            ("orders.view", "Siparişleri görüntüle"),
            ("orders.create", "Sipariş oluştur"),
            ("orders.edit", "Sipariş düzenle"),
            ("orders.delete", "Sipariş sil"),
            ("orders.receive", "Sipariş kabul/teslim al"),
            ("inventory.view", "Stok görüntüle"),
            ("inventory.edit", "Stok düzenle"),
            ("warehouses.view", "Depo yönetimini görüntüle"),
            ("warehouses.manage", "Depo kartlarını yönet"),
            ("warehouse_locations.manage", "Depo raflarını yönet"),
            ("warehouse_stock.view", "Depo stoklarını görüntüle"),
            ("warehouse_stock.operate", "Depo stok girişi, çıkışı ve sayımı yap"),
            ("warehouse_stock.transfer", "Depolar arası stok transferi yap"),
            ("warehouse_stock.allocate", "Eski stokları depolara devral"),
            ("warehouse_stock.import", "Depo sayım Excel'i içe aktar"),
            ("warehouse_stock.export", "Depo sayım Excel'i dışa aktar"),
            ("warehouse_movements.view", "Depo hareketlerini görüntüle"),
            ("invoices.view", "Faturaları görüntüle"),
            ("invoices.edit", "Fatura düzenle"),
            ("invoices.pay", "Fatura tahsilat/ödeme işle"),
            ("accounting.view", "Muhasebe görüntüle"),
            ("logistics.view", "Lojistik görüntüle"),
            ("logistics.edit", "Lojistik düzenle"),
            ("vehicles.view", "Araçları görüntüle"),
            ("vehicles.edit", "Araçları düzenle"),
        ],
    },
    {
        "key": "production",
        "label": "İmalat",
        "description": "Bölüm, istasyon, şablon, cihaz, akış, iş emri ve üretim raporları.",
        "permissions": [
            ("production.view", "İmalatı görüntüle"),
            ("production.manage", "İmalat bölüm, istasyon ve rota yönet"),
            ("production.templates.manage", "İmalat şablonlarını yönet"),
            ("production.station_users.manage", "İstasyon kullanıcı atamalarını yönet"),
            ("production.device_maps.manage", "Cihaz ve veri eşlemelerini yönet"),
            ("production.rules.manage", "Üretim akış kurallarını yönet"),
            ("production.work_orders.view", "Üretim iş emirlerini görüntüle"),
            ("production.work_orders.manage", "Üretim iş emirlerini yönet"),
            ("production.station.operate", "İstasyon konsolunda işlem yap"),
            ("production.pi.ingest", "Pi cihazlarından üretim verisi al"),
            ("production.pi_events.view", "Pi olaylarını görüntüle"),
            ("production.reports.view", "Üretim raporlarını görüntüle"),
            ("production.documents.manage", "Üretim teknik dokümanlarını yönet"),
        ],
    },
    {
        "key": "operations",
        "label": "Görev ve operasyon",
        "description": "Görevler, ekipler, takvim ve çalışan takibi.",
        "permissions": [
            ("tasks.view", "Görevleri görüntüle"),
            ("tasks.view.own", "Kendi görevlerini görüntüle"),
            ("tasks.create", "Görev oluştur"),
            ("tasks.edit", "Görev düzenle"),
            ("tasks.delete", "Görev sil"),
            ("tasks.assign", "Görev ataması yap"),
            ("tasks.handover", "Görev devret"),
            ("tasks.calendar.view", "Takvimi görüntüle"),
            ("teams.view", "Ekipleri görüntüle"),
            ("teams.edit", "Ekipleri düzenle"),
            ("worker_tracking.view", "Çalışan takibini görüntüle"),
        ],
    },
    {
        "key": "support",
        "label": "Destek",
        "description": "Destek talepleri ve mesajları.",
        "permissions": [
            ("tickets.view", "Destek taleplerini görüntüle"),
            ("tickets.edit", "Destek taleplerini düzenle"),
        ],
    },
    {
        "key": "reports",
        "label": "Raporlama ve denetim",
        "description": "Raporlar, denetim kayıtları ve erişim logları.",
        "permissions": [
            ("reports.view", "Raporları görüntüle"),
            ("audit.view", "Denetim kayıtlarını görüntüle"),
            ("access_logs.view", "Erişim loglarını görüntüle"),
            ("approvals.view", "Eski onay kayıtlarını görüntüle"),
        ],
    },
    {
        "key": "settings",
        "label": "Sistem ayarları",
        "description": "Organizasyon, mesai, güvenlik ve marka ayarları.",
        "permissions": [
            ("settings.view", "Ayarları görüntüle"),
            ("settings.organization.edit", "Organizasyon ayarlarını düzenle"),
            ("settings.security.edit", "Güvenlik ayarlarını düzenle"),
        ],
    },
]

PERMISSIONS_BY_MODULE = {
    module["key"]: [code for code, _label in module["permissions"]]
    for module in PERMISSION_CATALOG
}

PERMISSION_LABELS = {
    code: label
    for module in PERMISSION_CATALOG
    for code, label in module["permissions"]
}

ALL_PERMISSION_CODES = [
    code
    for module in PERMISSION_CATALOG
    for code, _label in module["permissions"]
]

LEGACY_PERMISSION_ALIASES = {
    "quotes.view.own": ["quotes.view.all"],
    "quotes.edit.own": ["quotes.edit.all"],
    "tasks.view.own": ["tasks.view"],
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

DEFAULT_ROLE_PERMS = {
    "Admin": ALL_PERMISSION_CODES,
    "Manager": [
        "quotes.view.all", "quotes.create", "quotes.edit.all", "quotes.status.change", "quotes.convert", "quotes.download", "quotes.prepare",
        "partners.view", "partners.create", "partners.edit", "partners.import", "partners.export",
        "templates.view", "templates.products.edit", "templates.seller_companies.edit", "templates.document_terms.edit", "templates.pricing.edit", "templates.payment_options.edit", "templates.service_tax.edit", "templates.excel.upload",
        "products.view", "products.create", "products.edit", "products.import", "products.export",
        "erp.view", "orders.view", "orders.create", "orders.edit", "orders.receive", "inventory.view", "inventory.edit", "warehouses.view", "warehouses.manage", "warehouse_locations.manage", "warehouse_stock.view", "warehouse_stock.operate", "warehouse_stock.transfer", "warehouse_stock.allocate", "warehouse_stock.import", "warehouse_stock.export", "warehouse_movements.view", "logistics.view", "logistics.edit", "vehicles.view", "vehicles.edit",
        "production.view", "production.manage", "production.templates.manage", "production.station_users.manage", "production.device_maps.manage", "production.rules.manage", "production.work_orders.view", "production.work_orders.manage", "production.pi_events.view", "production.reports.view", "production.documents.manage",
        "tickets.view", "tickets.edit", "tasks.view", "tasks.create", "tasks.edit", "tasks.assign", "teams.view", "teams.edit", "worker_tracking.view", "reports.view", "audit.view",
        "settings.view", "settings.organization.edit",
    ],
    "Sales": [
        "quotes.view.own", "quotes.create", "quotes.edit.own", "quotes.status.change", "quotes.convert", "quotes.download", "quotes.prepare",
        "partners.view", "partners.create", "partners.edit", "partners.import", "products.view", "templates.view",
    ],
    "Finance": [
        "quotes.view.all", "quotes.download", "partners.view", "erp.view", "invoices.view", "invoices.edit", "invoices.pay", "orders.view", "reports.view", "audit.view", "approvals.view",
    ],
    "Support": ["tickets.view", "tickets.edit", "tasks.view", "tasks.edit", "teams.view"],
    "Warehouse": ["erp.view", "products.view", "orders.view", "orders.receive", "inventory.view", "inventory.edit", "warehouses.view", "warehouse_stock.view", "warehouse_stock.operate", "warehouse_stock.transfer", "warehouse_stock.import", "warehouse_stock.export", "warehouse_movements.view", "logistics.view", "logistics.edit", "tasks.view", "tasks.edit", "teams.view"],
    "Worker": ["tasks.view.own", "tasks.edit", "tasks.handover", "production.station.operate", "products.view", "partners.view", "tickets.view", "vehicles.view", "teams.view", "quotes.view.own"],
}
