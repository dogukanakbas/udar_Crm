from accounts.models import Permission, RolePermission
from accounts.permissions_map import DEFAULT_ROLE_PERMS


def ensure_permissions_seeded():
    for perms in DEFAULT_ROLE_PERMS.values():
        for code in perms:
            Permission.objects.get_or_create(code=code, defaults={'description': code})
    for role, perms in DEFAULT_ROLE_PERMS.items():
        for code in perms:
            perm = Permission.objects.get(code=code)
            RolePermission.objects.get_or_create(role=role, permission=perm)


def user_has_perm(user, perm_code: str) -> bool:
    role = (getattr(user, 'role', None) or '').strip()
    if role == 'Admin':
        return True
    # Primary: DB role-permission table (case-insensitive)
    if RolePermission.objects.filter(role__iexact=role, permission__code=perm_code).exists():
        return True
    # Fallback: in case seed_permissions not run, use DEFAULT_ROLE_PERMS map
    perms = DEFAULT_ROLE_PERMS.get(role, []) or DEFAULT_ROLE_PERMS.get(role.capitalize(), [])
    return perm_code in perms

