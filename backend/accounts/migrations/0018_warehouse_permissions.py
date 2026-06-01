from django.db import migrations


PERMISSIONS = {
    'warehouses.view': 'Depo yönetimini görüntüle',
    'warehouses.manage': 'Depo kartlarını yönet',
    'warehouse_locations.manage': 'Depo raflarını yönet',
    'warehouse_stock.view': 'Depo stoklarını görüntüle',
    'warehouse_stock.operate': 'Depo stok girişi, çıkışı ve sayımı yap',
    'warehouse_stock.transfer': 'Depolar arası stok transferi yap',
    'warehouse_stock.allocate': 'Eski stokları depolara devral',
    'warehouse_stock.import': "Depo sayım Excel'i içe aktar",
    'warehouse_stock.export': "Depo sayım Excel'i dışa aktar",
    'warehouse_movements.view': 'Depo hareketlerini görüntüle',
}
MANAGER = list(PERMISSIONS)
WAREHOUSE = ['warehouses.view', 'warehouse_stock.view', 'warehouse_stock.operate', 'warehouse_stock.transfer', 'warehouse_stock.import', 'warehouse_stock.export', 'warehouse_movements.view']


def seed(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    rows = {}
    for code, description in PERMISSIONS.items():
        rows[code], _ = Permission.objects.get_or_create(code=code, defaults={'description': description})
    for role, codes in [('Manager', MANAGER), ('Warehouse', WAREHOUSE)]:
        for code in codes:
            RolePermission.objects.get_or_create(role=role, permission=rows[code])


class Migration(migrations.Migration):
    dependencies = [('accounts', '0017_partner_import_permission')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
