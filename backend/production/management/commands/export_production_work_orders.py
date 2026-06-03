import json

from django.core.management.base import BaseCommand, CommandError

from organizations.models import Organization
from production.models import ProductionWorkOrder


def _organization(code):
    if code:
        return Organization.objects.get(code=code)
    org = Organization.objects.order_by("id").first()
    if not org:
        raise CommandError("Aktarilacak organizasyon bulunamadi.")
    return org


def _user_payload(user):
    if not user:
        return {}
    return {
        "username": user.username,
        "email": user.email,
        "name": user.get_full_name() or user.username,
    }


def _date(value):
    return value.isoformat() if value else None


def _dt(value):
    return value.isoformat() if value else None


def _decimal(value):
    return str(value) if value is not None else "0"


class Command(BaseCommand):
    help = "Uretim is emirlerini tasinabilir JSON olarak disari aktarir."

    def add_arguments(self, parser):
        parser.add_argument("--organization", "-o", default="", help="Organization.code")
        parser.add_argument("--output", "-f", default="", help="Cikti dosyasi. Bos ise stdout.")
        parser.add_argument("--number", action="append", default=[], help="Tek bir is emri numarasi. Birden fazla verilebilir.")
        parser.add_argument("--status", action="append", default=[], help="Durum filtresi. Birden fazla verilebilir.")

    def handle(self, *args, **options):
        org = _organization(options["organization"])
        qs = (
            ProductionWorkOrder.objects.filter(organization=org)
            .select_related("route", "created_by")
            .prefetch_related("lines__product", "lines__route", "lines__steps__station", "lines__steps__route_step")
            .order_by("created_at", "id")
        )
        if options["number"]:
            qs = qs.filter(number__in=options["number"])
        if options["status"]:
            qs = qs.filter(status__in=options["status"])

        payload = {
            "version": 1,
            "organization": {"code": org.code, "name": org.name},
            "work_orders": [],
        }

        for order in qs:
            payload["work_orders"].append(
                {
                    "number": order.number,
                    "source_type": order.source_type,
                    "source_id": order.source_id,
                    "source_number": order.source_number,
                    "customer_name": order.customer_name,
                    "status": order.status,
                    "route_name": order.route.name if order.route_id else "",
                    "planned_start": _date(order.planned_start),
                    "due_date": _date(order.due_date),
                    "notes": order.notes,
                    "created_by": _user_payload(order.created_by),
                    "created_at": _dt(order.created_at),
                    "updated_at": _dt(order.updated_at),
                    "lines": [
                        {
                            "sort_order": line.sort_order,
                            "route_name": line.route.name if line.route_id else "",
                            "product_sku": line.product_sku or (line.product.sku if line.product_id else ""),
                            "product_name": line.product_name,
                            "detail_1": line.detail_1,
                            "detail_2": line.detail_2,
                            "quantity": _decimal(line.quantity),
                            "completed_quantity": _decimal(line.completed_quantity),
                            "technical_notes": line.technical_notes,
                            "details": line.details,
                            "stock_in_done": line.stock_in_done,
                            "steps": [
                                {
                                    "station_code": step.station.code,
                                    "order": step.order,
                                    "target_quantity": _decimal(step.target_quantity),
                                    "completed_quantity": _decimal(step.completed_quantity),
                                    "machine_quantity": _decimal(step.machine_quantity),
                                    "status": step.status,
                                    "started_at": _dt(step.started_at),
                                    "completed_at": _dt(step.completed_at),
                                }
                                for step in line.steps.all().order_by("order", "id")
                            ],
                        }
                        for line in order.lines.all().order_by("sort_order", "id")
                    ],
                }
            )

        output = json.dumps(payload, ensure_ascii=False, indent=2)
        if options["output"]:
            with open(options["output"], "w", encoding="utf-8") as handle:
                handle.write(output)
                handle.write("\n")
            self.stdout.write(self.style.SUCCESS(f"Uretim is emirleri yazildi: {options['output']} ({len(payload['work_orders'])} adet)"))
        else:
            self.stdout.write(output)
