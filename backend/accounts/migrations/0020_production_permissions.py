from django.db import migrations


PRODUCTION_PERMISSIONS = [
    ('production.view', 'İmalatı görüntüle'),
    ('production.manage', 'İmalat bölüm, istasyon ve rota yönet'),
    ('production.templates.manage', 'İmalat şablonlarını yönet'),
    ('production.station_users.manage', 'İstasyon kullanıcı atamalarını yönet'),
    ('production.device_maps.manage', 'Cihaz ve veri eşlemelerini yönet'),
    ('production.rules.manage', 'Üretim akış kurallarını yönet'),
    ('production.work_orders.view', 'Üretim iş emirlerini görüntüle'),
    ('production.work_orders.manage', 'Üretim iş emirlerini yönet'),
    ('production.station.operate', 'İstasyon konsolunda işlem yap'),
    ('production.pi.ingest', 'Pi cihazlarından üretim verisi al'),
    ('production.pi_events.view', 'Pi olaylarını görüntüle'),
    ('production.reports.view', 'Üretim raporlarını görüntüle'),
    ('production.documents.manage', 'Üretim teknik dokümanlarını yönet'),
]

ROLE_DEFAULTS = {
    'Admin': [code for code, _ in PRODUCTION_PERMISSIONS],
    'Manager': [
        'production.view',
        'production.manage',
        'production.templates.manage',
        'production.station_users.manage',
        'production.device_maps.manage',
        'production.rules.manage',
        'production.work_orders.view',
        'production.work_orders.manage',
        'production.pi_events.view',
        'production.reports.view',
        'production.documents.manage',
    ],
    'Worker': ['production.station.operate'],
}


def seed_production_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    rows = {}
    for code, label in PRODUCTION_PERMISSIONS:
        perm, created = Permission.objects.get_or_create(code=code, defaults={'description': label})
        if not created and perm.description != label:
            perm.description = label
            perm.save(update_fields=['description'])
        rows[code] = perm
    for role, codes in ROLE_DEFAULTS.items():
        for code in codes:
            RolePermission.objects.get_or_create(role=role, permission=rows[code])


class Migration(migrations.Migration):
    dependencies = [('accounts', '0019_admin_warehouse_permissions')]

    operations = [
        migrations.RunPython(seed_production_permissions, migrations.RunPython.noop),
    ]
