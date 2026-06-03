from django.db import migrations


SESSION_PERMISSIONS = [
    ('production.sessions.view', 'Üretim oturumlarını görüntüle'),
    ('production.sessions.review', 'Üretim oturumu farklarını incele'),
    ('production.sessions.manage', 'Üretim oturumlarını yönet'),
]


def seed_session_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    for code, description in SESSION_PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={'description': description, 'is_active': True},
        )
        for role in ['Admin', 'Manager']:
            RolePermission.objects.get_or_create(role=role, permission=permission)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0021_permissiongroup_usergroup_permission_addon_id_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_session_permissions, migrations.RunPython.noop),
    ]
