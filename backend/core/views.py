from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from core.renderers import EventStreamRenderer
from django.db import models
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse

from crm.models import Quote, BusinessPartner, Opportunity
from erp.models import Product, Invoice
from support.models import Ticket, Task, TaskComment
from accounts.models import Team
from datetime import datetime, timedelta
from django.db import connection
import redis
from django.conf import settings
import json
import time
import queue

from core.events import subscribe, unsubscribe


class DashboardKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization
        quotes = Quote.objects.filter(organization=org)
        partners = BusinessPartner.objects.filter(organization=org)
        products = Product.objects.filter(organization=org)
        invoices = Invoice.objects.filter(organization=org)
        opportunities = Opportunity.objects.filter(organization=org)
        tickets = Ticket.objects.filter(organization=org)
        tasks = Task.objects.filter(organization=org)
        today = models.functions.TruncDate(models.functions.Now())
        meetings = [
            {
                "id": t.id,
                "subject": t.title,
                "time": t.start.strftime("%H:%M") if t.start else "",
                "owner": t.owner.username if t.owner else "",
            }
            for t in tasks.filter(start__date=today)[:5]
        ]
        data = {
            "quote_count": quotes.count(),
            "quote_total": float(quotes.aggregate(sum_total=models.Sum("total"))["sum_total"] or 0),
            "partner_count": partners.count(),
            "product_count": products.count(),
            "revenue": float(invoices.aggregate(sum_amount=models.Sum("amount"))["sum_amount"] or 0),
            "pipeline": float(opportunities.aggregate(sum_value=models.Sum("value"))["sum_value"] or 0),
            "ar": float(invoices.exclude(status='Paid').aggregate(sum_amount=models.Sum("amount"))["sum_amount"] or 0),
            "inventory_value": float(
                products.aggregate(val=models.Sum(models.F("stock") * models.F("price"), output_field=models.DecimalField()))["val"] or 0
            ),
            "tickets_open": tickets.exclude(status='Closed').count(),
            "pending_approvals": quotes.filter(status='Under Review').count(),
            "today_tasks": [
                {"id": t.id, "title": t.title, "due": t.due, "owner": t.owner.username if t.owner else ""}
                for t in tasks.filter(due__date=today)
            ],
            "overdue_invoices": list(invoices.filter(status='Overdue').values_list('number', flat=True)[:5]),
            "low_stock": list(products.filter(stock__lt=models.F('reorder_point')).values_list('sku', flat=True)[:5]),
            "meetings": meetings,
        }
        return Response(data)


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "")
        tags = [t.strip() for t in request.query_params.get("tags", "").split(",") if t.strip()]
        types = [t.strip() for t in request.query_params.get("type", "").split(",") if t.strip()]
        try:
            limit = min(int(request.query_params.get("limit", 10)), 50)
        except Exception:
            limit = 10
        org = request.user.organization
        type_filter = set(types) if types else None

        partner_qs = BusinessPartner.objects.filter(organization=org, name__icontains=q)
        quote_qs = Quote.objects.filter(organization=org, number__icontains=q)
        product_qs = Product.objects.filter(organization=org, name__icontains=q)

        task_qs = Task.objects.filter(organization=org)
        if q:
            task_qs = task_qs.filter(title__icontains=q)
        if tags:
            task_qs = task_qs.filter(tags__overlap=tags)
        comment_qs = TaskComment.objects.filter(task__organization=org)
        if q:
            comment_qs = comment_qs.filter(text__icontains=q)
        teams_qs = Team.objects.filter(organization=org, name__icontains=q)

        partners = [] if type_filter and 'partners' not in type_filter else partner_qs[:limit]
        quotes = [] if type_filter and 'quotes' not in type_filter else quote_qs[:limit]
        products = [] if type_filter and 'products' not in type_filter else product_qs[:limit]
        tasks = [] if type_filter and 'tasks' not in type_filter else task_qs[:limit]
        comments = [] if type_filter and 'comments' not in type_filter else comment_qs[:limit]
        teams = [] if type_filter and 'teams' not in type_filter else teams_qs[:limit]

        return Response(
            {
                "partners": [{"id": p.id, "name": p.name} for p in partners],
                "partners_count": partner_qs.count() if (type_filter is None or 'partners' in type_filter) else 0,
                "quotes": [{"id": qu.id, "number": qu.number, "status": qu.status} for qu in quotes],
                "quotes_count": quote_qs.count() if (type_filter is None or 'quotes' in type_filter) else 0,
                "products": [{"id": pr.id, "name": pr.name, "sku": pr.sku} for pr in products],
                "products_count": product_qs.count() if (type_filter is None or 'products' in type_filter) else 0,
                "tasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "status": t.status,
                        "assignee": t.assignee.username if t.assignee else None,
                        "team": t.team.name if t.team else None,
                        "tags": t.tags,
                    }
                    for t in tasks
                ],
                "tasks_count": task_qs.count() if (type_filter is None or 'tasks' in type_filter) else 0,
                "comments": [
                    {
                        "id": c.id,
                        "task_id": c.task.id,
                        "task_title": c.task.title,
                        "author": c.author.username if c.author else None,
                        "text": c.text[:120],
                    }
                    for c in comments
                ],
                "comments_count": comment_qs.count() if (type_filter is None or 'comments' in type_filter) else 0,
                "teams": [{"id": tm.id, "name": tm.name} for tm in teams],
                "teams_count": teams_qs.count() if (type_filter is None or 'teams' in type_filter) else 0,
            }
        )


def health(request):
    db_ok = False
    redis_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            db_ok = True
    except Exception:
        db_ok = False
    try:
        r = redis.from_url(getattr(settings, 'CELERY_BROKER_URL', 'redis://redis:6379/0'))
        r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False
    return JsonResponse({
        "backend": "ok",
        "db": "ok" if db_ok else "fail",
        "redis": "ok" if redis_ok else "fail",
    })


class CalendarICSView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization
        tasks = Task.objects.filter(organization=org).order_by('-updated_at')[:200]
        now = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//UdarCRM//EN",
            f"DTSTAMP:{now}",
        ]
        for t in tasks:
            start = (t.start or t.due or t.end or datetime.utcnow()).strftime("%Y%m%dT%H%M%SZ")
            end_dt = (t.end or (t.start + timedelta(hours=1) if t.start else None) or t.due or datetime.utcnow())
            end = end_dt.strftime("%Y%m%dT%H%M%SZ")
            uid = f"{t.id}@udarcrm"
            desc = f"Status: {t.status} Priority: {t.priority}"
            lines.extend(
                [
                    "BEGIN:VEVENT",
                    f"UID:{uid}",
                    f"SUMMARY:{t.title}",
                    f"DESCRIPTION:{desc}",
                    f"DTSTART:{start}",
                    f"DTEND:{end}",
                    "END:VEVENT",
                ]
            )
        lines.append("END:VCALENDAR")
        ics = "\r\n".join(lines)
        resp = HttpResponse(ics, content_type="text/calendar")
        resp["Content-Disposition"] = 'attachment; filename="tasks.ics"'
        return resp


class SSEView(APIView):
    # Kimlik doğrulamayı query param JWT ile manuel yapıyoruz
    authentication_classes = []
    permission_classes = []
    renderer_classes = [EventStreamRenderer]

    def get(self, request):
        # JWT query param (EventSource header taşıyamıyor)
        token = request.GET.get('token')
        if not token:
            return Response(status=401)
        auth = JWTAuthentication()
        try:
            validated = auth.get_validated_token(token)
            user = auth.get_user(validated)
            request.user = user
        except Exception:
            return Response(status=401)

        q = subscribe()

        def event_stream():
            try:
                yield "event: ping\ndata: {}\n\n"
                while True:
                    try:
                        data = q.get(timeout=15)
                        yield f"data: {data}\n\n"
                    except queue.Empty:
                        yield "event: ping\ndata: {}\n\n"
            finally:
                unsubscribe(q)

        resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"
        return resp

