from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.models import (
    EffectivePermissionCache,
    Permission,
    RolePermission,
    UserGroup,
    UserGroupMembership,
    UserGroupPermission,
)
from accounts.permissions_map import DEFAULT_ROLE_PERMS, LEGACY_PERMISSION_ALIASES, PERMISSION_CATALOG, PERMISSION_LABELS

DEPRECATED_PERMISSIONS = {"leads.view", "leads.edit"}
ROLE_PERMISSION_REVOKES = {
    "Manager": {"contacts.view", "contacts.edit", "opportunities.view", "opportunities.edit"},
    "Sales": {
        "contacts.view",
        "contacts.edit",
        "opportunities.view",
        "opportunities.edit",
        "orders.view",
        "orders.edit",
        "orders.receive",
        "tasks.view",
        "tasks.edit",
    },
    "Worker": {"contacts.view", "contacts.edit", "opportunities.view", "opportunities.edit"},
}


def ensure_permissions_seeded():
    if DEPRECATED_PERMISSIONS:
        RolePermission.objects.filter(permission__code__in=DEPRECATED_PERMISSIONS).delete()
        Permission.objects.filter(code__in=DEPRECATED_PERMISSIONS).delete()
    for role, codes in ROLE_PERMISSION_REVOKES.items():
        RolePermission.objects.filter(role__iexact=role, permission__code__in=codes).delete()

    from accounts.models import PermissionGroup
    static_groups = {}
    for index, module in enumerate(PERMISSION_CATALOG, start=1):
        group, _ = PermissionGroup.objects.get_or_create(
            group_id=module["key"],
            defaults={
                "title": module.get("label", module["key"]),
                "display_order": index * 10,
            },
        )
        static_groups[module["key"]] = group
        for order, (code, label) in enumerate(module.get("permissions", []), start=1):
            Permission.objects.update_or_create(
                code=code,
                defaults={
                    "description": label,
                    "permission_group": group,
                    "display_order": order * 10,
                    "is_active": True,
                },
            )
    for code, label in PERMISSION_LABELS.items():
        Permission.objects.get_or_create(code=code, defaults={'description': label})

    try:
        from addons.services import install_builtin_addons
        install_builtin_addons()
    except Exception:
        # Add-on altyapısı migration öncesi çağrılırsa auth akışı bozulmasın.
        pass

    for role, perms in DEFAULT_ROLE_PERMS.items():
        # Rol/grup yetkileri panelden özelleştirilebilir. Bu nedenle varsayılanlar
        # sadece rolün hiç yetkisi yoksa basılır; her çağrıda silinen yetki geri eklenmez.
        if RolePermission.objects.filter(role__iexact=role).exists():
            continue
        for code in perms:
            perm = Permission.objects.get(code=code)
            RolePermission.objects.get_or_create(role=role, permission=perm)
    sync_user_groups()
    rebuild_effective_permissions()


def sync_user_groups():
    for idx, (role, title) in enumerate([(r, r) for r in DEFAULT_ROLE_PERMS.keys()], start=1):
        UserGroup.objects.get_or_create(
            group_id=role,
            defaults={"title": title, "is_system": True, "display_order": idx * 10},
        )

    for role in DEFAULT_ROLE_PERMS.keys():
        group = UserGroup.objects.filter(group_id__iexact=role).first()
        if not group:
            continue
        role_permission_codes = set(
            RolePermission.objects.filter(role__iexact=role).values_list("permission__code", flat=True)
        )
        if not role_permission_codes:
            role_permission_codes = set(DEFAULT_ROLE_PERMS.get(role, []))
        for permission in Permission.objects.filter(code__in=role_permission_codes):
            UserGroupPermission.objects.get_or_create(
                group=group,
                permission=permission,
                defaults={"value": "allow"},
            )

    User = get_user_model()
    for user in User.objects.all().only("id", "role"):
        role = (getattr(user, "role", "") or "").strip()
        group = UserGroup.objects.filter(group_id__iexact=role).first()
        if group and not UserGroupMembership.objects.filter(user=user, group=group).exists():
            UserGroupMembership.objects.create(
                user=user,
                group=group,
                is_primary=not UserGroupMembership.objects.filter(user=user, is_primary=True).exists(),
            )


def user_has_perm(user, perm_code: str) -> bool:
    role = (getattr(user, 'role', None) or '').strip()
    if role == "Admin" or getattr(user, 'is_superadmin', False) or getattr(user, 'is_superuser', False):
        return True
    acceptable_codes = [perm_code, *LEGACY_PERMISSION_ALIASES.get(perm_code, [])]
    cached = getattr(user, "effective_permission_cache", None)
    if cached and isinstance(cached.permissions, list):
        return any(code in cached.permissions for code in acceptable_codes)
    computed = _compute_effective_permissions(user)
    if computed:
        EffectivePermissionCache.objects.update_or_create(user=user, defaults={"permissions": computed})
        return any(code in computed for code in acceptable_codes)
    # Primary: DB role-permission table (case-insensitive)
    if RolePermission.objects.filter(role__iexact=role, permission__code__in=acceptable_codes).exists():
        return True
    # Fallback: in case seed_permissions not run, use DEFAULT_ROLE_PERMS map
    perms = DEFAULT_ROLE_PERMS.get(role, []) or DEFAULT_ROLE_PERMS.get(role.capitalize(), [])
    return any(code in perms for code in acceptable_codes)


def user_has_any_perm(user, perm_codes: list[str] | tuple[str, ...] | set[str]) -> bool:
    return any(user_has_perm(user, code) for code in perm_codes)


def get_effective_permissions(user) -> list[str]:
    role = (getattr(user, 'role', None) or '').strip()
    if role == "Admin" or getattr(user, 'is_superadmin', False) or getattr(user, 'is_superuser', False):
        return ['*']

    cached = getattr(user, "effective_permission_cache", None)
    if cached and isinstance(cached.permissions, list):
        return sorted(set(cached.permissions))

    computed = _compute_effective_permissions(user)
    if computed:
        EffectivePermissionCache.objects.update_or_create(user=user, defaults={"permissions": computed})
        return computed

    db_perms = list(
        RolePermission.objects.filter(role__iexact=role)
        .select_related('permission')
        .values_list('permission__code', flat=True)
    )
    if db_perms:
        return sorted(set(db_perms))

    return sorted(set(DEFAULT_ROLE_PERMS.get(role, []) or DEFAULT_ROLE_PERMS.get(role.capitalize(), [])))


def _compute_effective_permissions(user) -> list[str]:
    memberships = UserGroupMembership.objects.filter(user=user).select_related("group")
    if not memberships.exists():
        return []
    try:
        from addons.models import Addon
        inactive_addon_ids = set(
            Addon.objects.filter(is_installed=True).exclude(is_enabled=True).values_list("addon_id", flat=True)
        )
    except Exception:
        inactive_addon_ids = set()
    allowed: set[str] = set()
    denied: set[str] = set()
    for membership in memberships:
        values = UserGroupPermission.objects.filter(group=membership.group, permission__is_active=True).select_related("permission")
        for value in values:
            if value.permission.addon_id and value.permission.addon_id in inactive_addon_ids:
                continue
            if value.value == "deny":
                denied.add(value.permission.code)
                allowed.discard(value.permission.code)
            elif value.value == "allow" and value.permission.code not in denied:
                allowed.add(value.permission.code)
    return sorted(allowed)


@transaction.atomic
def rebuild_effective_permissions(user=None):
    if user is not None:
        role = (getattr(user, 'role', None) or '').strip()
        permissions = ['*'] if role == "Admin" or getattr(user, 'is_superadmin', False) or getattr(user, 'is_superuser', False) else _compute_effective_permissions(user)
        if not permissions:
            role = (getattr(user, 'role', None) or '').strip()
            permissions = list(
                RolePermission.objects.filter(role__iexact=role)
                .select_related('permission')
                .values_list('permission__code', flat=True)
            )
        EffectivePermissionCache.objects.update_or_create(user=user, defaults={"permissions": sorted(set(permissions))})
        return

    User = get_user_model()
    for item in User.objects.all():
        rebuild_effective_permissions(item)
