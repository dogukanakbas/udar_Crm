"""
Görev raporları API (JSON özet + Excel / Word indirme).
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from django.utils import timezone
from permissions import IsOrgMember

from .task_reporting import build_full_report, export_xlsx_bytes, export_docx_bytes, export_cnc_docx_bytes


def _default_year():
    return timezone.now().year


def _report_roles(user):
    return getattr(user, 'role', '') in ('Admin', 'Manager', 'Finance')


class TaskReportSummaryView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        if not _report_roles(request.user):
            return Response({'detail': 'Bu raporu yalnızca yönetim ve finans görüntüleyebilir.'}, status=status.HTTP_403_FORBIDDEN)
        org = request.user.organization
        if not org:
            return Response({'detail': 'Organizasyon yok'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(request.query_params.get('year', _default_year()))
        except (TypeError, ValueError):
            year = _default_year()
        month_raw = request.query_params.get('month')
        month = None
        if month_raw not in (None, '', 'all'):
            try:
                month = int(month_raw)
                if month < 1 or month > 12:
                    month = None
            except ValueError:
                month = None

        team_id = request.query_params.get('team_id')
        assignee_id = request.query_params.get('assignee_id')
        st = request.query_params.get('status', 'all')

        filters = {
            'team_id': int(team_id) if team_id and str(team_id).isdigit() else None,
            'assignee_id': int(assignee_id) if assignee_id and str(assignee_id).isdigit() else None,
            'status': st if st else 'all',
        }
        data = build_full_report(org.id, year, month, filters)
        return Response(data)


class TaskReportExportView(APIView):
    permission_classes = [IsOrgMember]
    # DRF'in ?format=... query override mekanizmasi bu endpointte 404 üretiyor.
    # Export tipi için query parami biz yönettiğimizden burada kapatıyoruz.
    format_kwarg = None

    def get(self, request):
        if not _report_roles(request.user):
            return Response({'detail': 'Yetkisiz'}, status=status.HTTP_403_FORBIDDEN)
        org = request.user.organization
        if not org:
            return Response({'detail': 'Organizasyon yok'}, status=status.HTTP_400_BAD_REQUEST)

        fmt = (request.query_params.get('file_format') or request.query_params.get('format') or 'xlsx').lower()
        if fmt not in ('xlsx', 'docx', 'doc'):
            return Response({'detail': 'file_format=xlsx veya docx olmalı'}, status=status.HTTP_400_BAD_REQUEST)
        if fmt == 'doc':
            fmt = 'docx'

        try:
            year = int(request.query_params.get('year', _default_year()))
        except (TypeError, ValueError):
            year = _default_year()
        month_raw = request.query_params.get('month')
        month = None
        if month_raw not in (None, '', 'all'):
            try:
                month = int(month_raw)
                if month < 1 or month > 12:
                    month = None
            except ValueError:
                month = None

        team_id = request.query_params.get('team_id')
        assignee_id = request.query_params.get('assignee_id')
        st = request.query_params.get('status', 'all')
        template_key = (request.query_params.get('template') or '').strip().lower()
        filters = {
            'team_id': int(team_id) if team_id and str(team_id).isdigit() else None,
            'assignee_id': int(assignee_id) if assignee_id and str(assignee_id).isdigit() else None,
            'status': st if st else 'all',
        }
        payload = build_full_report(org.id, year, month, filters)

        if fmt == 'xlsx':
            body = export_xlsx_bytes(payload)
            name = f"gorev_raporu_{year}_{month or 'yillik'}.xlsx"
            resp = HttpResponse(body, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            resp['Content-Disposition'] = f'attachment; filename="{name}"'
            return resp
        if template_key in ('cnc', 'daily', 'daily-production'):
            body = export_cnc_docx_bytes(payload)
            name = f"gunluk_uretim_faaliyet_raporu_{year}_{month or 'yillik'}.docx"
        else:
            body = export_docx_bytes(payload)
            name = f"gorev_raporu_{year}_{month or 'yillik'}.docx"
        resp = HttpResponse(
            body,
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        resp['Content-Disposition'] = f'attachment; filename="{name}"'
        return resp
