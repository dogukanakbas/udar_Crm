from accounts.models import Permission, RolePermission
from accounts.permissions_map import DEFAULT_ROLE_PERMS, LEGACY_PERMISSION_ALIASES, PERMISSION_LABELS

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

    for code, label in PERMISSION_LABELS.items():
        Permission.objects.get_or_create(code=code, defaults={'description': label})
    for role, perms in DEFAULT_ROLE_PERMS.items():
        # Rol/grup yetkileri panelden özelleştirilebilir. Bu nedenle varsayılanlar
        # sadece rolün hiç yetkisi yoksa basılır; her çağrıda silinen yetki geri eklenmez.
        if RolePermission.objects.filter(role__iexact=role).exists():
            continue
        for code in perms:
            perm = Permission.objects.get(code=code)
            RolePermission.objects.get_or_create(role=role, permission=perm)


def user_has_perm(user, perm_code: str) -> bool:
    role = (getattr(user, 'role', None) or '').strip()
    if getattr(user, 'is_superadmin', False) or getattr(user, 'is_superuser', False):
        return True
    acceptable_codes = [perm_code, *LEGACY_PERMISSION_ALIASES.get(perm_code, [])]
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
    if getattr(user, 'is_superadmin', False) or getattr(user, 'is_superuser', False):
        return ['*']

    db_perms = list(
        RolePermission.objects.filter(role__iexact=role)
        .select_related('permission')
        .values_list('permission__code', flat=True)
    )
    if db_perms:
        return sorted(set(db_perms))

    return sorted(set(DEFAULT_ROLE_PERMS.get(role, []) or DEFAULT_ROLE_PERMS.get(role.capitalize(), [])))
