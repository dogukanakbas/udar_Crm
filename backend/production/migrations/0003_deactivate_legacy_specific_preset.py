from django.db import migrations


def deactivate_legacy_specific_preset(apps, schema_editor):
    ProductionTemplatePreset = apps.get_model('production', 'ProductionTemplatePreset')
    ProductionTemplatePreset.objects.filter(key='ayka_steel_door').update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [
        ('production', '0002_modular_factory_designer'),
    ]

    operations = [
        migrations.RunPython(deactivate_legacy_specific_preset, migrations.RunPython.noop),
    ]
