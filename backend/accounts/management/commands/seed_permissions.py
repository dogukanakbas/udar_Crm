from django.core.management.base import BaseCommand
from accounts.models import Permission, RolePermission
from accounts.permissions_map import DEFAULT_ROLE_PERMS, PERMISSIONS_BY_MODULE


class Command(BaseCommand):
    help = "Seed permissions and role-permission mappings"

    def handle(self, *args, **options):
        # ensure all permissions exist
        for perms in PERMISSIONS_BY_MODULE.values():
            for code in perms:
                Permission.objects.get_or_create(code=code, defaults={"description": code})
        # attach to roles
        for role, perms in DEFAULT_ROLE_PERMS.items():
            for code in perms:
                perm = Permission.objects.get(code=code)
                RolePermission.objects.get_or_create(role=role, permission=perm)
        self.stdout.write(self.style.SUCCESS("Permissions seeded."))

