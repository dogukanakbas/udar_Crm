from django.db import migrations


PERMISSIONS = [
    ('production.tablet.operate', 'İstasyon tabletinde operatör işlemi yap'),
    ('production.tablet.manage', 'İstasyon tabletleri ve üretim PINlerini yönet'),
    ('production.alerts.send', 'İstasyon tabletlerine yönetici bildirimi gönder'),
    ('production.alerts.view', 'İstasyon tablet bildirimlerini görüntüle'),
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
    worker_group = UserGroup.objects.filter(group_id='worker').first()
    for order, (code, description) in enumerate(PERMISSIONS, start=80):
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
        if code == 'production.tablet.operate':
            RolePermission.objects.get_or_create(role='Worker', permission=permission)
        for target_group in [admin_group, manager_group]:
            if target_group:
                UserGroupPermission.objects.update_or_create(group=target_group, permission=permission, defaults={'value': 'allow'})
        if code == 'production.tablet.operate' and worker_group:
            UserGroupPermission.objects.update_or_create(group=worker_group, permission=permission, defaults={'value': 'allow'})


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0022_production_session_permissions'),
    ]

    operations = [
        migrations.RunPython(seed_permissions, migrations.RunPython.noop),
    ]
