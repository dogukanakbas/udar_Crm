from django.db import migrations


PERMISSIONS = [
    ('technical_drawings.view', 'Ürün teknik resimlerini görüntüle'),
    ('technical_drawings.manage', 'Ürün teknik resimlerini yönet'),
]

ROLE_DEFAULTS = {
    'Admin': ['technical_drawings.view', 'technical_drawings.manage'],
    'Manager': ['technical_drawings.view', 'technical_drawings.manage'],
    'Sales': ['technical_drawings.view'],
    'Warehouse': ['technical_drawings.view'],
    'Worker': ['technical_drawings.view'],
}


def seed_technical_drawing_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')
    UserGroup = apps.get_model('accounts', 'UserGroup')
    UserGroupPermission = apps.get_model('accounts', 'UserGroupPermission')
    User = apps.get_model('accounts', 'User')
    EffectivePermissionCache = apps.get_model('accounts', 'EffectivePermissionCache')

    group, _ = PermissionGroup.objects.get_or_create(
        group_id='products',
        defaults={'title': 'Ürünler', 'display_order': 70},
    )
    permission_by_code = {}
    for order, (code, label) in enumerate(PERMISSIONS, start=90):
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                'description': label,
                'permission_group': group,
                'display_order': order * 10,
                'is_active': True,
            },
        )
        permission_by_code[code] = permission

    for role, codes in ROLE_DEFAULTS.items():
        user_group = UserGroup.objects.filter(group_id__iexact=role).first()
        for code in codes:
            permission = permission_by_code[code]
            RolePermission.objects.get_or_create(role=role, permission=permission)
            if user_group:
                UserGroupPermission.objects.get_or_create(
                    group=user_group,
                    permission=permission,
                    defaults={'value': 'allow'},
                )

    for user in User.objects.all().only('id', 'role', 'is_superuser', 'is_superadmin'):
        role = (user.role or '').strip()
        if role == 'Admin' or user.is_superuser or user.is_superadmin:
            EffectivePermissionCache.objects.update_or_create(user=user, defaults={'permissions': ['*']})
            continue
        extra = set(ROLE_DEFAULTS.get(role, []))
        if not extra:
            continue
        cache, _ = EffectivePermissionCache.objects.get_or_create(user=user, defaults={'permissions': []})
        cache.permissions = sorted(set(cache.permissions or []) | extra)
        cache.save(update_fields=['permissions'])


class Migration(migrations.Migration):
    dependencies = [('accounts', '0024_production_shift_permissions')]

    operations = [
        migrations.RunPython(seed_technical_drawing_permissions, migrations.RunPython.noop),
    ]
