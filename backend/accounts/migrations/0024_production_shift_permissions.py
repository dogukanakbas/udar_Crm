from django.db import migrations


PERMISSIONS = [
    ('production.shifts.view', 'Üretim vardiya ve mola planlarını görüntüle'),
    ('production.shifts.manage', 'Üretim vardiya ve mola planlarını yönet'),
    ('production.shift_reports.view', 'Vardiya sonu üretim raporlarını görüntüle'),
]


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')
    UserGroup = apps.get_model('accounts', 'UserGroup')
    UserGroupPermission = apps.get_model('accounts', 'UserGroupPermission')
    group, _ = PermissionGroup.objects.get_or_create(
        group_id='production',
        defaults={'title': 'İmalat', 'display_order': 60},
    )
    admin_group = UserGroup.objects.filter(group_id='admin').first()
    manager_group = UserGroup.objects.filter(group_id='manager').first()
    for order, (code, description) in enumerate(PERMISSIONS, start=120):
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                'description': description,
                'permission_group': group,
                'display_order': order,
                'is_active': True,
            },
        )
        for role in ['Admin', 'Manager']:
            RolePermission.objects.get_or_create(role=role, permission=permission)
        for target_group in [admin_group, manager_group]:
            if target_group:
                UserGroupPermission.objects.update_or_create(group=target_group, permission=permission, defaults={'value': 'allow'})


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0023_production_tablet_alert_permissions'),
    ]

    operations = [
        migrations.RunPython(seed_permissions, migrations.RunPython.noop),
    ]
