import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from erp.models import InventoryLocation
from organizations.models import Organization, Warehouse
from production.models import (
    ProductionDataField,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionRuleBlock,
    ProductionRuleSet,
    ProductionSettings,
    ProductionStation,
    ProductionStationUser,
    ProductionTemplatePreset,
)


def _target_organization(code, payload):
    if code:
        return Organization.objects.get(code=code)
    payload_code = (payload.get("organization") or {}).get("code")
    if payload_code:
        found = Organization.objects.filter(code=payload_code).first()
        if found:
            return found
    org = Organization.objects.order_by("id").first()
    if not org:
        raise CommandError("Hedef organizasyon bulunamadi.")
    return org


class Command(BaseCommand):
    help = "export_production_config ciktisini hedef organizasyona yukler."

    def add_arguments(self, parser):
        parser.add_argument("input", help="JSON dosyasi")
        parser.add_argument("--organization", "-o", default="", help="Hedef Organization.code")
        parser.add_argument("--skip-users", action="store_true", help="Istasyon kullanici atamalarini atla.")
        parser.add_argument("--include-presets", action="store_true", help="Global sablon presetlerini de yukle.")

    @transaction.atomic
    def handle(self, *args, **options):
        with open(options["input"], "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        org = _target_organization(options["organization"], payload)
        User = get_user_model()

        departments = {}
        for item in payload.get("departments", []):
            department, _ = ProductionDepartment.objects.update_or_create(
                organization=org,
                code=item["code"],
                defaults={
                    "name": item.get("name", item["code"]),
                    "color": item.get("color", ""),
                    "order": int(item.get("order") or 0),
                    "is_active": bool(item.get("is_active", True)),
                },
            )
            departments[department.code] = department

        stations = {}
        for item in payload.get("stations", []):
            department = departments.get(item.get("department_code"))
            if not department:
                self.stdout.write(self.style.WARNING(f"Istasyon atlandi, bolum yok: {item.get('code')}"))
                continue
            station, _ = ProductionStation.objects.update_or_create(
                organization=org,
                code=item["code"],
                defaults={
                    "department": department,
                    "name": item.get("name", item["code"]),
                    "order": int(item.get("order") or 0),
                    "max_workers": int(item.get("max_workers") or 1),
                    "is_handover": bool(item.get("is_handover", False)),
                    "is_final": bool(item.get("is_final", False)),
                    "is_active": bool(item.get("is_active", True)),
                    "description": item.get("description", ""),
                },
            )
            stations[station.code] = station

        if not options["skip_users"]:
            for item in payload.get("station_users", []):
                station = stations.get(item.get("station_code"))
                user = User.objects.filter(username=item.get("username")).first()
                if not station or not user:
                    self.stdout.write(self.style.WARNING(f"Kullanici atamasi atlandi: {item.get('station_code')} / {item.get('username')}"))
                    continue
                ProductionStationUser.objects.update_or_create(
                    organization=org,
                    station=station,
                    user=user,
                    defaults={
                        "role": item.get("role", "operator"),
                        "is_active": bool(item.get("is_active", True)),
                    },
                )

        devices = {}
        for item in payload.get("devices", []):
            station = stations.get(item.get("station_code"))
            if not station:
                self.stdout.write(self.style.WARNING(f"Cihaz atlandi, istasyon yok: {item.get('name')}"))
                continue
            device, _ = ProductionDevice.objects.update_or_create(
                token=item["token"],
                defaults={
                    "organization": org,
                    "station": station,
                    "name": item.get("name", item["token"]),
                    "is_active": bool(item.get("is_active", True)),
                },
            )
            devices[device.token] = device

        data_fields = {}
        for item in payload.get("data_fields", []):
            station = stations.get(item.get("station_code")) if item.get("station_code") else None
            data_field, _ = ProductionDataField.objects.update_or_create(
                organization=org,
                station=station,
                key=item["key"],
                defaults={
                    "label": item.get("label", item["key"]),
                    "field_type": item.get("field_type", "text"),
                    "source": item.get("source", "manual"),
                    "unit": item.get("unit", ""),
                    "default_value": item.get("default_value", ""),
                    "config": item.get("config", {}),
                    "is_visible": bool(item.get("is_visible", True)),
                    "order": int(item.get("order") or 0),
                },
            )
            data_fields[(item.get("station_code") or "", data_field.key)] = data_field

        for item in payload.get("device_maps", []):
            device = devices.get(item.get("device_token"))
            if not device:
                self.stdout.write(self.style.WARNING(f"Veri esleme atlandi, cihaz yok: {item.get('device_token')}"))
                continue
            station = stations.get(item.get("station_code")) if item.get("station_code") else None
            data_field = data_fields.get((item.get("station_code") or "", item.get("data_field_key"))) if item.get("data_field_key") else None
            ProductionDevicePayloadMap.objects.update_or_create(
                organization=org,
                device=device,
                source_path=item["source_path"],
                target_key=item["target_key"],
                defaults={
                    "station": station,
                    "data_field": data_field,
                    "target_type": item.get("target_type", "text"),
                    "default_value": item.get("default_value", ""),
                    "is_required": bool(item.get("is_required", False)),
                    "is_active": bool(item.get("is_active", True)),
                    "order": int(item.get("order") or 0),
                },
            )

        routes = {}
        for item in payload.get("routes", []):
            route, _ = ProductionRouteTemplate.objects.update_or_create(
                organization=org,
                name=item["name"],
                defaults={
                    "product_group_key": item.get("product_group_key", ""),
                    "is_default": bool(item.get("is_default", False)),
                    "is_active": bool(item.get("is_active", True)),
                },
            )
            routes[route.name] = route
            seen_station_ids = []
            for step_item in item.get("steps", []):
                station = stations.get(step_item.get("station_code"))
                if not station:
                    self.stdout.write(self.style.WARNING(f"Rota adimi atlandi, istasyon yok: {step_item.get('station_code')}"))
                    continue
                ProductionRouteStep.objects.update_or_create(
                    route=route,
                    station=station,
                    defaults={
                        "order": int(step_item.get("order") or 0),
                        "is_required": bool(step_item.get("is_required", True)),
                    },
                )
                seen_station_ids.append(station.id)
            route.steps.exclude(station_id__in=seen_station_ids).delete()

        for item in payload.get("rule_sets", []):
            station = stations.get(item.get("station_code")) if item.get("station_code") else None
            route = routes.get(item.get("route_name")) if item.get("route_name") else None
            rule_set, _ = ProductionRuleSet.objects.update_or_create(
                organization=org,
                name=item["name"],
                scope=item.get("scope", "station"),
                station=station,
                route=route,
                trigger_event=item.get("trigger_event", "pi_event"),
                defaults={
                    "is_active": bool(item.get("is_active", True)),
                    "order": int(item.get("order") or 0),
                },
            )
            rule_set.blocks.all().delete()
            for block in item.get("blocks", []):
                ProductionRuleBlock.objects.create(
                    organization=org,
                    rule_set=rule_set,
                    block_type=block.get("block_type", "condition"),
                    config=block.get("config", {}),
                    is_active=bool(block.get("is_active", True)),
                    order=int(block.get("order") or 0),
                )

        if options["include_presets"]:
            for item in payload.get("template_presets", []):
                ProductionTemplatePreset.objects.update_or_create(
                    key=item["key"],
                    defaults={
                        "name": item.get("name", item["key"]),
                        "description": item.get("description", ""),
                        "payload": item.get("payload", {}),
                        "is_active": bool(item.get("is_active", True)),
                    },
                )

        settings_payload = payload.get("settings", {})
        settings, _ = ProductionSettings.objects.get_or_create(organization=org)
        warehouse = None
        location = None
        if settings_payload.get("default_completion_warehouse_code"):
            warehouse = Warehouse.objects.filter(organization=org, code=settings_payload["default_completion_warehouse_code"]).first()
        if warehouse and settings_payload.get("default_completion_location_code"):
            location = InventoryLocation.objects.filter(organization=org, warehouse=warehouse, code=settings_payload["default_completion_location_code"]).first()
        settings.default_completion_warehouse = warehouse
        settings.default_completion_location = location
        settings.auto_stock_in_enabled = bool(settings_payload.get("auto_stock_in_enabled", True))
        settings.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Uretim konfigurasyonu yuklendi: {org.code} | bolum={len(departments)} istasyon={len(stations)} rota={len(routes)}"
            )
        )
