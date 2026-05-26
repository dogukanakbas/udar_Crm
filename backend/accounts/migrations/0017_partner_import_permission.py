from django.db import migrations


def add_partner_import_permission(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")
    permission, _ = Permission.objects.get_or_create(
        code="partners.import",
        defaults={"description": "Cari kartlarını Excel'den içe aktar"},
    )
    for role in ["Admin", "Manager", "Sales"]:
        RolePermission.objects.get_or_create(role=role, permission=permission)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_modular_permission_catalog"),
    ]

    operations = [
        migrations.RunPython(add_partner_import_permission, migrations.RunPython.noop),
    ]
