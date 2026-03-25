"""
Görev raporları: yıl/ay, ekip, çalışan, görev detayı ve dışa aktarma verisi.
"""
from __future__ import annotations

from calendar import month_name
from datetime import datetime
from typing import Any

from django.db.models import Count, Q
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from accounts.models import Team, User
from .models import Task, TaskTimeEntry


def _year_bounds(year: int, month: int | None) -> tuple[datetime, datetime]:
    if month is not None and 1 <= month <= 12:
        start = timezone.make_aware(datetime(year, month, 1))
        if month == 12:
            end = timezone.make_aware(datetime(year + 1, 1, 1))
        else:
            end = timezone.make_aware(datetime(year, month + 1, 1))
    else:
        start = timezone.make_aware(datetime(year, 1, 1))
        end = timezone.make_aware(datetime(year + 1, 1, 1))
    return start, end


def base_task_qs(org_id: int):
    return Task.objects.filter(organization_id=org_id).select_related(
        'owner', 'assignee', 'team', 'current_team'
    )


def apply_filters(
    qs,
    *,
    team_id: int | None = None,
    assignee_id: int | None = None,
    status: str | None = None,
):
    if team_id:
        qs = qs.filter(Q(team_id=team_id) | Q(current_team_id=team_id))
    if assignee_id:
        qs = qs.filter(assignee_id=assignee_id)
    if status and status != 'all':
        qs = qs.filter(status=status)
    return qs


def completion_expr():
    """Tamamlanma zamanı: end varsa end, yoksa updated_at (done görevler için)."""
    return Coalesce('end', 'updated_at')


def task_detail_rows(qs) -> list[dict[str, Any]]:
    rows = []
    for t in qs.order_by('-updated_at'):
        team = t.current_team or t.team
        comp = t.end or (t.updated_at if t.status == 'done' else None)
        rows.append(
            {
                'id': t.id,
                'title': t.title,
                'status': t.status,
                'priority': t.priority,
                'mode': t.mode,
                'model_code': t.model_code or '',
                'variant': t.variant or '',
                'quantity': t.quantity,
                'team_name': team.name if team else '',
                'team_id': team.id if team else None,
                'assignee_username': t.assignee.username if t.assignee else '',
                'assignee_id': t.assignee_id,
                'owner_username': t.owner.username if t.owner else '',
                'start': t.start.isoformat() if t.start else '',
                'end': t.end.isoformat() if t.end else '',
                'due': t.due.isoformat() if t.due else '',
                'created_at': t.created_at.isoformat() if t.created_at else '',
                'updated_at': t.updated_at.isoformat() if t.updated_at else '',
                'completed_at': comp.isoformat() if comp else '',
                'planned_hours': float(t.planned_hours or 0),
                'total_planned_minutes': float(t.total_planned_minutes or 0),
                'tags': t.tags or [],
            }
        )
    return rows


def monthly_completed_in_year(org_id: int, year: int, filters: dict) -> list[dict[str, Any]]:
    start, end = _year_bounds(year, None)
    qs = base_task_qs(org_id).filter(status='done')
    qs = apply_filters(qs, **filters)
    qs = qs.annotate(completed_at=completion_expr()).filter(
        completed_at__gte=start,
        completed_at__lt=end,
    )
    agg = (
        qs.annotate(ym=TruncMonth('completed_at'))
        .values('ym')
        .annotate(count=Count('id'))
        .order_by('ym')
    )
    out = []
    for row in agg:
        ym = row['ym']
        if ym is None:
            continue
        key = ym.strftime('%Y-%m')
        out.append({'year_month': key, 'month_label': f"{month_name[ym.month]} {ym.year}", 'completed_count': row['count']})
    return out


def monthly_created_in_year(org_id: int, year: int, filters: dict) -> list[dict[str, Any]]:
    start, end = _year_bounds(year, None)
    qs = base_task_qs(org_id).filter(created_at__gte=start, created_at__lt=end)
    qs = apply_filters(qs, **filters)
    agg = (
        qs.annotate(ym=TruncMonth('created_at'))
        .values('ym')
        .annotate(count=Count('id'))
        .order_by('ym')
    )
    out = []
    for row in agg:
        ym = row['ym']
        if ym is None:
            continue
        out.append({'year_month': ym.strftime('%Y-%m'), 'created_count': row['count']})
    return out


def by_team_summary(org_id: int, year: int, month: int | None, filters: dict) -> list[dict[str, Any]]:
    start, end = _year_bounds(year, month)
    qs_all = apply_filters(base_task_qs(org_id), **filters)
    qs_done = (
        qs_all.filter(status='done')
        .annotate(completed_at=completion_expr())
        .filter(completed_at__gte=start, completed_at__lt=end)
    )
    teams = Team.objects.filter(organization_id=org_id)
    result = []
    for tm in teams.order_by('name'):
        # Tamamlanan: o ay/yılda tamamlanmış ve bu ekibe team veya current_team ile bağlı
        done_n = qs_done.filter(Q(team_id=tm.id) | Q(current_team_id=tm.id)).count()
        active_n = qs_all.filter(~Q(status='done')).filter(Q(team_id=tm.id) | Q(current_team_id=tm.id)).count()
        result.append(
            {
                'team_id': tm.id,
                'team_name': tm.name,
                'tasks_completed_in_period': done_n,
                'tasks_active': active_n,
            }
        )
    return sorted(result, key=lambda x: -x['tasks_completed_in_period'])


def by_user_summary(org_id: int, year: int, month: int | None, filters: dict) -> list[dict[str, Any]]:
    start, end = _year_bounds(year, month)
    base = apply_filters(base_task_qs(org_id), **filters)
    qs_done = (
        base.filter(status='done', assignee__isnull=False)
        .annotate(completed_at=completion_expr())
        .filter(completed_at__gte=start, completed_at__lt=end)
    )
    done_counts = (
        qs_done.values('assignee_id', 'assignee__username')
        .annotate(tasks_completed=Count('id'))
        .order_by('-tasks_completed')
    )
    active_counts = (
        base.filter(~Q(status='done'), assignee__isnull=False)
        .values('assignee_id', 'assignee__username')
        .annotate(tasks_active=Count('id'))
    )
    active_map = {r['assignee_id']: r['tasks_active'] for r in active_counts}
    # Zaman kayıtları (dönem içinde başlayan)
    te_qs = TaskTimeEntry.objects.filter(
        task__organization_id=org_id,
        started_at__gte=start,
        started_at__lt=end,
    )
    if filters.get('team_id'):
        tid = filters['team_id']
        te_qs = te_qs.filter(Q(task__team_id=tid) | Q(task__current_team_id=tid))
    hours_map: dict[int, float] = {}
    for te in te_qs.select_related('user'):
        if not te.user_id:
            continue
        s = te.started_at
        e = te.ended_at or timezone.now()
        hrs = max(0, (e - s).total_seconds() / 3600)
        hours_map[te.user_id] = hours_map.get(te.user_id, 0) + hrs

    rows = []
    for row in done_counts:
        uid = row['assignee_id']
        rows.append(
            {
                'user_id': uid,
                'username': row['assignee__username'] or '',
                'tasks_completed': row['tasks_completed'],
                'tasks_active': active_map.get(uid, 0),
                'hours_logged': round(hours_map.get(uid, 0), 2),
            }
        )
    seen = {r['user_id'] for r in rows}
    for uid, hrs in hours_map.items():
        if uid not in seen and hrs > 0:
            u = User.objects.filter(id=uid, organization_id=org_id).first()
            rows.append(
                {
                    'user_id': uid,
                    'username': u.username if u else str(uid),
                    'tasks_completed': 0,
                    'tasks_active': active_map.get(uid, 0),
                    'hours_logged': round(hrs, 2),
                }
            )
            seen.add(uid)
    return sorted(rows, key=lambda x: (-x['tasks_completed'], -x['hours_logged']))


def build_full_report(org_id: int, year: int, month: int | None, filters: dict) -> dict[str, Any]:
    f = {k: v for k, v in filters.items() if v is not None}
    start, end = _year_bounds(year, month)
    qs = base_task_qs(org_id)
    qs = apply_filters(qs, **f)
    done_in_period = (
        qs.filter(status='done')
        .annotate(completed_at=completion_expr())
        .filter(completed_at__gte=start, completed_at__lt=end)
    )
    touched = qs.filter(updated_at__gte=start, updated_at__lt=end)
    created = qs.filter(created_at__gte=start, created_at__lt=end)
    detail_ids = (
        set(done_in_period.values_list('id', flat=True))
        | set(touched.values_list('id', flat=True))
        | set(created.values_list('id', flat=True))
    )
    detail_qs = qs.filter(id__in=detail_ids) if detail_ids else qs.none()

    monthly_done = monthly_completed_in_year(org_id, year, f)
    monthly_new = monthly_created_in_year(org_id, year, f)
    merged_months: dict[str, dict] = {}
    for m in monthly_done:
        merged_months.setdefault(m['year_month'], {})['completed_count'] = m['completed_count']
        merged_months[m['year_month']]['month_label'] = m.get('month_label', m['year_month'])
    for m in monthly_new:
        k = m['year_month']
        merged_months.setdefault(k, {})['created_count'] = m['created_count']

    def _month_label(ym_key: str, bucket: dict) -> str:
        if bucket.get('month_label'):
            return bucket['month_label']
        if '-' in ym_key:
            y, mo = ym_key.split('-', 1)
            try:
                return f"{month_name[int(mo)]} {y}"
            except (ValueError, IndexError):
                pass
        return ym_key

    monthly_timeline = sorted(
        [
            {
                'year_month': k,
                'month_label': _month_label(k, v),
                'completed_count': v.get('completed_count', 0),
                'created_count': v.get('created_count', 0),
            }
            for k, v in merged_months.items()
        ],
        key=lambda x: x['year_month'],
    )

    if month is not None:
        key = f'{year}-{int(month):02d}'
        monthly_timeline = [m for m in monthly_timeline if m['year_month'] == key]

    return {
        'year': year,
        'month': month,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'filters_applied': f,
        'monthly_timeline': monthly_timeline,
        'by_team': by_team_summary(org_id, year, month, f),
        'by_user': by_user_summary(org_id, year, month, f),
        'tasks': task_detail_rows(detail_qs),
    }


def export_xlsx_bytes(data: dict[str, Any]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    # Özet — aylık
    ws0 = wb.active
    ws0.title = 'Aylik özet'
    ws0.append(['Ay', 'Tamamlanan görev', 'Oluşturulan görev'])
    for row in data.get('monthly_timeline', []):
        ws0.append([row.get('month_label') or row.get('year_month'), row.get('completed_count', 0), row.get('created_count', 0)])
    # Ekip
    ws1 = wb.create_sheet('Ekip bazlı')
    ws1.append(['Ekip ID', 'Ekip', 'Dönemde tamamlanan', 'Aktif görev'])
    for r in data.get('by_team', []):
        ws1.append([r['team_id'], r['team_name'], r['tasks_completed_in_period'], r['tasks_active']])
    # Çalışan
    ws2 = wb.create_sheet('Çalışan bazlı')
    ws2.append(['Kullanıcı ID', 'Kullanıcı', 'Tamamlanan', 'Aktif', 'Saat (zaman kaydı)'])
    for r in data.get('by_user', []):
        ws2.append([r['user_id'], r['username'], r['tasks_completed'], r['tasks_active'], r['hours_logged']])
    # Görev detay
    ws3 = wb.create_sheet('Görev detay')
    headers = [
        'ID',
        'Başlık',
        'Durum',
        'Öncelik',
        'Mod',
        'Model',
        'Varyant',
        'Adet',
        'Ekip',
        'Atanan',
        'Sahip',
        'Başlangıç',
        'Bitiş',
        'Vade',
        'Oluşturulma',
        'Güncellenme',
        'Tamamlanma (tahmini)',
        'Plan saat',
        'Plan dk',
    ]
    ws3.append(headers)
    for t in data.get('tasks', []):
        ws3.append(
            [
                t['id'],
                t['title'],
                t['status'],
                t['priority'],
                t['mode'],
                t['model_code'],
                t['variant'],
                t['quantity'],
                t['team_name'],
                t['assignee_username'],
                t['owner_username'],
                t['start'],
                t['end'],
                t['due'],
                t['created_at'],
                t['updated_at'],
                t['completed_at'],
                t['planned_hours'],
                t['total_planned_minutes'],
            ]
        )
    for ws in wb.worksheets:
        if ws.max_row > 0:
            for cell in ws[1]:
                cell.font = Font(bold=True)
    bio = __import__('io')
    buf = bio.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_docx_bytes(data: dict[str, Any], title: str = 'Görev Raporu') -> bytes:
    from docx import Document

    doc = Document()
    doc.add_heading(title, 0)
    p = doc.add_paragraph()
    p.add_run(f"Yıl: {data.get('year')}")
    if data.get('month'):
        p.add_run(f"  |  Ay: {data['month']}")
    p.add_run(f"\nDönem: {data.get('period_start', '')} — {data.get('period_end', '')}")

    doc.add_heading('Aylık özet', level=1)
    t1 = doc.add_table(rows=1, cols=3)
    t1.rows[0].cells[0].text = 'Ay'
    t1.rows[0].cells[1].text = 'Tamamlanan'
    t1.rows[0].cells[2].text = 'Oluşturulan'
    for row in data.get('monthly_timeline', []):
        r = t1.add_row().cells
        r[0].text = str(row.get('month_label') or row.get('year_month'))
        r[1].text = str(row.get('completed_count', 0))
        r[2].text = str(row.get('created_count', 0))

    doc.add_heading('Ekip bazlı', level=1)
    t2 = doc.add_table(rows=1, cols=3)
    hdr2 = t2.rows[0].cells
    hdr2[0].text = 'Ekip'
    hdr2[1].text = 'Tamamlanan (dönem)'
    hdr2[2].text = 'Aktif'
    for r in data.get('by_team', []):
        row = t2.add_row().cells
        row[0].text = r['team_name']
        row[1].text = str(r['tasks_completed_in_period'])
        row[2].text = str(r['tasks_active'])

    doc.add_heading('Çalışan bazlı', level=1)
    t3 = doc.add_table(rows=1, cols=4)
    hdr3 = t3.rows[0].cells
    hdr3[0].text = 'Kullanıcı'
    hdr3[1].text = 'Tamamlanan'
    hdr3[2].text = 'Aktif'
    hdr3[3].text = 'Saat'
    for r in data.get('by_user', []):
        row = t3.add_row().cells
        row[0].text = r['username']
        row[1].text = str(r['tasks_completed'])
        row[2].text = str(r['tasks_active'])
        row[3].text = str(r['hours_logged'])

    doc.add_heading('Görev listesi (özet)', level=1)
    for t in data.get('tasks', [])[:500]:
        doc.add_paragraph(f"[{t['status']}] {t['title']} — Ekip: {t['team_name']} — Atanan: {t['assignee_username']}", style='List Bullet')

    bio = __import__('io')
    buf = bio.BytesIO()
    doc.save(buf)
    return buf.getvalue()
