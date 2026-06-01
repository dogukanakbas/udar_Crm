from django.db import migrations


WAREHOUSE_PERMISSIONS = [
    'warehouses.view',
    'warehouses.manage',
    'warehouse_locations.manage',
    'warehouse_stock.view',
    'warehouse_stock.operate',
    'warehouse_stock.transfer',
    'warehouse_stock.allocate',
    'warehouse_stock.import',
    'warehouse_stock.export',
    'warehouse_movements.view',
]


def seed_admin_warehouse_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    permissions = Permission.objects.filter(code__in=WAREHOUSE_PERMISSIONS)
    for permission in permissions:
        RolePermission.objects.get_or_create(role='Admin', permission=permission)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0018_warehouse_permissions')]
    operations = [
        migrations.RunPython(seed_admin_warehouse_permissions, migrations.RunPython.noop),
    ]
