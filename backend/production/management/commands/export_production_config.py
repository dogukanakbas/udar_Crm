import json

from django.core.management.base import BaseCommand, CommandError

from organizations.models import Organization
from production.models import (
    ProductionDataField,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionRouteTemplate,
    ProductionRuleSet,
    ProductionSettings,
    ProductionStation,
    ProductionStationUser,
    ProductionTemplatePreset,
)


def _organization(code):
    if code:
        return Organization.objects.get(code=code)
    org = Organization.objects.order_by("id").first()
    if not org:
        raise CommandError("Aktarilacak organizasyon bulunamadi.")
    return org


class Command(BaseCommand):
    help = "Uretim yonetimi konfigurasyonunu tasinabilir JSON olarak disari aktarir."

    def add_arguments(self, parser):
        parser.add_argument("--organization", "-o", default="", help="Organization.code")
        parser.add_argument("--output", "-f", default="", help="Cikti dosyasi. Bos ise stdout.")
        parser.add_argument("--include-presets", action="store_true", help="Global sablon presetlerini de ekle.")

    def handle(self, *args, **options):
        org = _organization(options["organization"])

        settings = ProductionSettings.objects.filter(organization=org).select_related(
            "default_completion_warehouse",
            "default_completion_location",
        ).first()

        departments = [
            {
                "code": item.code,
                "name": item.name,
                "color": item.color,
                "order": item.order,
                "is_active": item.is_active,
            }
            for item in ProductionDepartment.objects.filter(organization=org).order_by("order", "id")
        ]

        stations = [
            {
                "department_code": item.department.code,
                "code": item.code,
                "name": item.name,
                "order": item.order,
                "max_workers": item.max_workers,
                "is_handover": item.is_handover,
                "is_final": item.is_final,
                "is_active": item.is_active,
                "description": item.description,
            }
            for item in ProductionStation.objects.filter(organization=org)
            .select_related("department")
            .order_by("department__order", "order", "id")
        ]

        station_users = [
            {
                "station_code": item.station.code,
                "username": item.user.username,
                "role": item.role,
                "is_active": item.is_active,
            }
            for item in ProductionStationUser.objects.filter(organization=org)
            .select_related("station", "user")
            .order_by("station__code", "user__username")
        ]

        devices = [
            {
                "station_code": item.station.code,
                "name": item.name,
                "token": item.token,
                "is_active": item.is_active,
            }
            for item in ProductionDevice.objects.filter(organization=org)
            .select_related("station")
            .order_by("station__code", "name")
        ]

        data_fields = [
            {
                "station_code": item.station.code if item.station_id else "",
                "key": item.key,
                "label": item.label,
                "field_type": item.field_type,
                "source": item.source,
                "unit": item.unit,
                "default_value": item.default_value,
                "config": item.config,
                "is_visible": item.is_visible,
                "order": item.order,
            }
            for item in ProductionDataField.objects.filter(organization=org)
            .select_related("station")
            .order_by("station__code", "order", "id")
        ]

        device_maps = [
            {
                "device_token": item.device.token,
                "station_code": item.station.code if item.station_id else "",
                "data_field_key": item.data_field.key if item.data_field_id else "",
                "source_path": item.source_path,
                "target_key": item.target_key,
                "target_type": item.target_type,
                "default_value": item.default_value,
                "is_required": item.is_required,
                "is_active": item.is_active,
                "order": item.order,
            }
            for item in ProductionDevicePayloadMap.objects.filter(organization=org)
            .select_related("device", "station", "data_field")
            .order_by("device__name", "order", "id")
        ]

        routes = []
        for route in ProductionRouteTemplate.objects.filter(organization=org).prefetch_related("steps__station").order_by("name", "id"):
            routes.append(
                {
                    "name": route.name,
                    "product_group_key": route.product_group_key,
                    "is_default": route.is_default,
                    "is_active": route.is_active,
                    "steps": [
                        {
                            "station_code": step.station.code,
                            "order": step.order,
                            "is_required": step.is_required,
                        }
                        for step in route.steps.all().order_by("order", "id")
                    ],
                }
            )

        rule_sets = []
        for rule_set in ProductionRuleSet.objects.filter(organization=org).prefetch_related("blocks").select_related("station", "route").order_by("order", "id"):
            rule_sets.append(
                {
                    "name": rule_set.name,
                    "scope": rule_set.scope,
                    "station_code": rule_set.station.code if rule_set.station_id else "",
                    "route_name": rule_set.route.name if rule_set.route_id else "",
                    "trigger_event": rule_set.trigger_event,
                    "is_active": rule_set.is_active,
                    "order": rule_set.order,
                    "blocks": [
                        {
                            "block_type": block.block_type,
                            "config": block.config,
                            "is_active": block.is_active,
                            "order": block.order,
                        }
                        for block in rule_set.blocks.all().order_by("order", "id")
                    ],
                }
            )

        payload = {
            "version": 1,
            "organization": {"code": org.code, "name": org.name},
            "settings": {
                "default_completion_warehouse_code": settings.default_completion_warehouse.code if settings and settings.default_completion_warehouse_id else "",
                "default_completion_location_code": settings.default_completion_location.code if settings and settings.default_completion_location_id else "",
                "auto_stock_in_enabled": settings.auto_stock_in_enabled if settings else True,
            },
            "departments": departments,
            "stations": stations,
            "station_users": station_users,
            "devices": devices,
            "data_fields": data_fields,
            "device_maps": device_maps,
            "routes": routes,
            "rule_sets": rule_sets,
            "template_presets": [
                {
                    "key": item.key,
                    "name": item.name,
                    "description": item.description,
                    "payload": item.payload,
                    "is_active": item.is_active,
                }
                for item in ProductionTemplatePreset.objects.all().order_by("name", "id")
            ]
            if options["include_presets"]
            else [],
        }

        output = json.dumps(payload, ensure_ascii=False, indent=2)
        if options["output"]:
            with open(options["output"], "w", encoding="utf-8") as handle:
                handle.write(output)
                handle.write("\n")
            self.stdout.write(self.style.SUCCESS(f"Uretim konfigurasyonu yazildi: {options['output']}"))
        else:
            self.stdout.write(output)
