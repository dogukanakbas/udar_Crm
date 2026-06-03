import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime

from erp.models import Product
from organizations.models import Organization
from production.models import (
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionStation,
    ProductionStepProgress,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
)
from production.services import create_progress_steps


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


def _decimal(value):
    return Decimal(str(value or 0))


def _date(value):
    return parse_date(value) if value else None


def _datetime(value):
    return parse_datetime(value) if value else None


def _route(org, name):
    if not name:
        return None
    return ProductionRouteTemplate.objects.filter(organization=org, name=name).first()


def _created_by(user_payload):
    username = (user_payload or {}).get("username")
    if not username:
        return None
    return get_user_model().objects.filter(username=username).first()


class Command(BaseCommand):
    help = "export_production_work_orders ciktisini hedef organizasyona yukler."

    def add_arguments(self, parser):
        parser.add_argument("input", help="JSON dosyasi")
        parser.add_argument("--organization", "-o", default="", help="Hedef Organization.code")
        parser.add_argument("--replace-lines", action="store_true", help="Var olan is emrindeki kalemleri silip JSON'daki haliyle yeniden kurar.")
        parser.add_argument("--skip-progress", action="store_true", help="Adim ilerlemelerini aktarma; rota varsayilanlarini olustur.")

    @transaction.atomic
    def handle(self, *args, **options):
        with open(options["input"], "r", encoding="utf-8") as handle:
            payload = json.load(handle)

        org = _target_organization(options["organization"], payload)
        imported_orders = 0
        imported_lines = 0
        warnings = []

        for row in payload.get("work_orders", []):
            route = _route(org, row.get("route_name"))
            order, _ = ProductionWorkOrder.objects.update_or_create(
                organization=org,
                number=row["number"],
                defaults={
                    "source_type": row.get("source_type", "manual"),
                    "source_id": row.get("source_id", ""),
                    "source_number": row.get("source_number", ""),
                    "customer_name": row.get("customer_name", ""),
                    "status": row.get("status", "waiting"),
                    "route": route,
                    "planned_start": _date(row.get("planned_start")),
                    "due_date": _date(row.get("due_date")),
                    "notes": row.get("notes", ""),
                    "created_by": _created_by(row.get("created_by")),
                },
            )
            imported_orders += 1

            if options["replace_lines"]:
                order.lines.all().delete()

            existing_by_sort = {line.sort_order: line for line in order.lines.all()}
            seen_line_ids = []

            for idx, line_row in enumerate(row.get("lines", []), start=1):
                line_route = _route(org, line_row.get("route_name")) or route
                product = None
                sku = line_row.get("product_sku", "")
                if sku:
                    product = Product.objects.filter(organization=org, sku=sku).first()

                sort_order = int(line_row.get("sort_order") or idx)
                line = existing_by_sort.get(sort_order)
                defaults = {
                    "route": line_route,
                    "product": product,
                    "product_sku": sku,
                    "product_name": line_row.get("product_name", "Ürün"),
                    "detail_1": line_row.get("detail_1", ""),
                    "detail_2": line_row.get("detail_2", ""),
                    "quantity": _decimal(line_row.get("quantity")),
                    "completed_quantity": _decimal(line_row.get("completed_quantity")),
                    "technical_notes": line_row.get("technical_notes", ""),
                    "details": line_row.get("details", {}),
                    "stock_in_done": bool(line_row.get("stock_in_done", False)),
                    "sort_order": sort_order,
                }
                if line:
                    for key, value in defaults.items():
                        setattr(line, key, value)
                    line.save()
                else:
                    line = ProductionWorkOrderLine.objects.create(work_order=order, **defaults)

                seen_line_ids.append(line.id)
                imported_lines += 1

                if line_route and not line.steps.exists():
                    create_progress_steps(line, line_route)

                if options["skip_progress"]:
                    continue

                for step_row in line_row.get("steps", []):
                    station_code = step_row.get("station_code", "")
                    station = ProductionStation.objects.filter(organization=org, code=station_code).first()
                    if not station:
                        warnings.append(f"Istasyon yok, adim atlandi: {order.number} / {station_code}")
                        continue
                    route_step = None
                    if line_route:
                        route_step = ProductionRouteStep.objects.filter(route=line_route, station=station).first()
                    if not route_step:
                        warnings.append(f"Rota adimi yok, adim atlandi: {order.number} / {station_code}")
                        continue
                    ProductionStepProgress.objects.update_or_create(
                        line=line,
                        route_step=route_step,
                        defaults={
                            "station": station,
                            "order": int(step_row.get("order") or route_step.order),
                            "target_quantity": _decimal(step_row.get("target_quantity")),
                            "completed_quantity": _decimal(step_row.get("completed_quantity")),
                            "machine_quantity": _decimal(step_row.get("machine_quantity")),
                            "status": step_row.get("status", "locked"),
                            "started_at": _datetime(step_row.get("started_at")),
                            "completed_at": _datetime(step_row.get("completed_at")),
                        },
                    )

            if options["replace_lines"]:
                order.lines.exclude(id__in=seen_line_ids).delete()

        for warning in warnings:
            self.stdout.write(self.style.WARNING(warning))
        self.stdout.write(
            self.style.SUCCESS(
                f"Uretim is emirleri yuklendi: {org.code} | is_emri={imported_orders} kalem={imported_lines} uyari={len(warnings)}"
            )
        )
