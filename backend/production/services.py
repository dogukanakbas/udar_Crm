from __future__ import annotations

import hashlib
import json
import unicodedata
from copy import deepcopy
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import IntegrityError, models, transaction
from django.db.models import Max, Sum
from django.utils import timezone

from accounts.utils import user_has_perm
from core.events import push_event
from erp.inventory_service import InventoryError, stock_in
from erp.models import InventoryLocation, Product

from .models import (
    ProductionDataField,
    ProductionCountingParticipant,
    ProductionCountingWindow,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionEvent,
    ProductionOperatorProfile,
    ProductionRuleSet,
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionSettings,
    ProductionSessionBreak,
    ProductionShiftBreak,
    ProductionShiftCheckpoint,
    ProductionShiftOccurrence,
    ProductionShiftSchedule,
    ProductionStation,
    ProductionStationTarget,
    ProductionStationAlert,
    ProductionStationAlertAck,
    ProductionStationTablet,
    ProductionStationUser,
    ProductionStepProgress,
    ProductionStepTabletAssignment,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
    ProductionWorkSession,
)


GENERIC_PRESET_ROUTE = [
    ('HAZIRLIK', 'Hazırlık', '#2563eb', 2, [
        ('HZR-1', 'Hazırlık istasyonu', False, False),
        ('DEV-1', 'Bölüm devri', True, False),
    ]),
    ('ISLEME', 'İşleme', '#ea580c', 4, [
        ('ISL-1', 'İşleme istasyonu', False, False),
        ('DEV-2', 'Bölüm devri', True, False),
    ]),
    ('KONTROL', 'Kalite Kontrol', '#15803d', 2, [
        ('KNT-1', 'Kontrol istasyonu', False, False),
    ]),
    ('PAKETLEME', 'Paketleme', '#7e22ce', 2, [
        ('PKT-1', 'Paketleme istasyonu', False, False),
        ('FIN-1', 'Ürün tamamlandı', False, True),
    ]),
]


class ProductionError(ValueError):
    pass


ACTIVE_SESSION_STATUSES = ['started', 'paused']
User = get_user_model()
SHIFT_BLOCKING_STATES = {'break_locked', 'off_shift', 'checkpoint_required'}


def _norm(value: object) -> str:
    return str(value or '').strip()


def _norm_key(value: object) -> str:
    text = _norm(value).replace('ı', 'i').replace('İ', 'i').lower()
    text = ''.join(ch for ch in unicodedata.normalize('NFKD', text) if not unicodedata.combining(ch))
    text = text.replace('ç', 'c').replace('ğ', 'g').replace('ö', 'o').replace('ş', 's').replace('ü', 'u')
    return text.replace('-', ' ').replace('/', ' ').replace('__', '_').replace('  ', ' ').strip()


def product_group_key_from_value(value: object) -> str:
    return _norm_key(value).replace(' ', '_')


def _decimal(value, label='Miktar') -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ProductionError(f'{label} sayisal olmalidir.') from exc
    if result < 0:
        raise ProductionError(f'{label} negatif olamaz.')
    return result


def _signed_decimal(value, label='Miktar') -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ProductionError(f'{label} sayisal olmalidir.') from exc


def _aware_at(day, clock):
    value = datetime.combine(day, clock)
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def _schedule_interval(schedule, start_day):
    starts_at = _aware_at(start_day, schedule.start_time)
    crosses = schedule.crosses_midnight or schedule.end_time <= schedule.start_time
    end_day = start_day + timedelta(days=1) if crosses else start_day
    ends_at = _aware_at(end_day, schedule.end_time)
    return starts_at, ends_at


def _break_interval(break_row, occurrence):
    start_day = occurrence.report_date
    if break_row.start_time < occurrence.schedule.start_time:
        start_day = start_day + timedelta(days=1)
    starts_at = _aware_at(start_day, break_row.start_time)
    end_day = start_day + timedelta(days=1) if break_row.end_time <= break_row.start_time else start_day
    ends_at = _aware_at(end_day, break_row.end_time)
    return starts_at, ends_at


def _shift_schedules_for_department(department):
    return ProductionShiftSchedule.objects.filter(
        organization=department.organization,
        department=department,
        is_active=True,
    ).order_by('order', 'start_time', 'id')


def _get_or_create_shift_occurrence(schedule, starts_at, ends_at, report_date):
    occurrence, _ = ProductionShiftOccurrence.objects.update_or_create(
        organization=schedule.organization,
        schedule=schedule,
        report_date=report_date,
        starts_at=starts_at,
        defaults={
            'department': schedule.department,
            'name': schedule.name,
            'ends_at': ends_at,
            'status': 'active' if ends_at > timezone.now() else 'closed',
        },
    )
    return occurrence


def _active_shift_occurrence(department, now=None):
    now = timezone.localtime(now or timezone.now())
    schedules = list(_shift_schedules_for_department(department))
    if not schedules:
        return None, False
    for schedule in schedules:
        for day in [now.date(), now.date() - timedelta(days=1)]:
            weekdays = schedule.weekdays or list(range(7))
            if day.weekday() not in weekdays:
                continue
            starts_at, ends_at = _schedule_interval(schedule, day)
            if starts_at <= now < ends_at:
                return _get_or_create_shift_occurrence(schedule, starts_at, ends_at, day), True
    return None, True


def _next_shift_for_department(department, now=None):
    now = timezone.localtime(now or timezone.now())
    schedules = list(_shift_schedules_for_department(department))
    candidates = []
    for day_offset in range(0, 8):
        day = now.date() + timedelta(days=day_offset)
        for schedule in schedules:
            weekdays = schedule.weekdays or list(range(7))
            if day.weekday() not in weekdays:
                continue
            starts_at, ends_at = _schedule_interval(schedule, day)
            if starts_at > now:
                candidates.append((starts_at, ends_at, schedule))
    if not candidates:
        return None
    starts_at, ends_at, schedule = sorted(candidates, key=lambda item: item[0])[0]
    return {
        'id': schedule.id,
        'name': schedule.name,
        'starts_at': starts_at,
        'ends_at': ends_at,
    }


def _active_shift_break(occurrence, now=None):
    if not occurrence:
        return None
    now = timezone.localtime(now or timezone.now())
    breaks = ProductionShiftBreak.objects.filter(
        organization=occurrence.organization,
        department=occurrence.department,
        is_active=True,
    ).filter(models.Q(schedule__isnull=True) | models.Q(schedule=occurrence.schedule)).order_by('order', 'start_time', 'id')
    for break_row in breaks:
        starts_at, ends_at = _break_interval(break_row, occurrence)
        if starts_at <= now < ends_at:
            return break_row, starts_at, ends_at
    return None


def _next_shift_break(occurrence, now=None):
    if not occurrence:
        return None
    now = timezone.localtime(now or timezone.now())
    rows = []
    breaks = ProductionShiftBreak.objects.filter(
        organization=occurrence.organization,
        department=occurrence.department,
        is_active=True,
    ).filter(models.Q(schedule__isnull=True) | models.Q(schedule=occurrence.schedule)).order_by('order', 'start_time', 'id')
    for break_row in breaks:
        starts_at, ends_at = _break_interval(break_row, occurrence)
        if starts_at > now:
            rows.append((starts_at, ends_at, break_row))
    if not rows:
        return None
    starts_at, ends_at, break_row = sorted(rows, key=lambda item: item[0])[0]
    return {
        'id': break_row.id,
        'name': break_row.name,
        'starts_at': starts_at,
        'ends_at': ends_at,
        'requires_checkpoint': break_row.requires_checkpoint,
    }


def _tablet_shift_payload(tablet, *, now=None):
    now = timezone.localtime(now or timezone.now())
    occurrence, has_schedule = _active_shift_occurrence(tablet.station.department, now)
    active_window = ProductionCountingWindow.objects.filter(
        organization=tablet.organization,
        tablet=tablet,
        status='open',
    ).select_related('line', 'step').prefetch_related('participants__user', 'participants__session').first()
    active_sessions = _active_tablet_sessions(tablet, step=active_window.step if active_window else None) if active_window else _active_tablet_sessions(tablet)
    names = [session.user.get_full_name() or session.user.username for session in active_sessions]

    base = {
        'state': 'active',
        'label': 'Aktif',
        'message': '',
        'has_schedule': has_schedule,
        'requires_checkpoint': False,
        'locked': False,
        'checkpoint_names': names,
        'active_window_id': active_window.id if active_window else None,
        'line_id': active_window.line_id if active_window else None,
        'now': now,
        'active_shift': None,
        'active_break': None,
        'next_shift': _next_shift_for_department(tablet.station.department, now),
        'next_break': None,
        'seconds_until_change': None,
    }
    if not has_schedule:
        base['label'] = 'Vardiya tanımı yok'
        base['message'] = 'Bu bölüm için vardiya tanımlanmadığı için tablet açık.'
        return base
    if not occurrence:
        base.update({
            'state': 'checkpoint_required' if active_window else 'off_shift',
            'label': 'Vardiya dışı',
            'message': 'Şu anda bu bölümde aktif vardiya yok.',
            'requires_checkpoint': bool(active_window),
            'locked': True,
        })
        return base

    base['active_shift'] = {
        'id': occurrence.id,
        'name': occurrence.name,
        'report_date': occurrence.report_date,
        'starts_at': occurrence.starts_at,
        'ends_at': occurrence.ends_at,
    }
    base['seconds_until_change'] = max(0, int((occurrence.ends_at - now).total_seconds()))
    active_break = _active_shift_break(occurrence, now)
    if active_break:
        break_row, starts_at, ends_at = active_break
        base['active_break'] = {
            'id': break_row.id,
            'name': break_row.name,
            'starts_at': starts_at,
            'ends_at': ends_at,
            'requires_checkpoint': break_row.requires_checkpoint,
            'lock_type': break_row.lock_type,
        }
        base.update({
            'state': 'checkpoint_required' if active_window and break_row.requires_checkpoint else 'break_locked',
            'label': 'Planlı mola',
            'message': f'{break_row.name} devam ediyor.',
            'requires_checkpoint': bool(active_window and break_row.requires_checkpoint),
            'locked': True,
            'seconds_until_change': max(0, int((ends_at - now).total_seconds())),
        })
        return base

    base['next_break'] = _next_shift_break(occurrence, now)
    return base


def _assert_tablet_shift_open(tablet):
    shift = _tablet_shift_payload(tablet)
    if shift['state'] in SHIFT_BLOCKING_STATES:
        if shift['state'] == 'checkpoint_required':
            raise ProductionError('Vardiya veya planlı mola öncesi üretim miktarı yazılmalı.')
        raise ProductionError(shift['message'] or 'Tablet şu anda vardiya kilidinde.')
    return shift


def _is_station_user(organization, user, station):
    if not user:
        return False
    return ProductionStationUser.objects.filter(
        organization=organization,
        user=user,
        station=station,
        station__is_active=True,
        is_active=True,
    ).exists()


def _has_tablet_operator_perm(user):
    return bool(
        user
        and user.is_active
        and (
            user_has_perm(user, 'production.tablet.operate')
            or user_has_perm(user, 'production.station.operate')
            or getattr(user, 'role', '') in {'Worker', 'Manager', 'Admin'}
        )
    )


def _tablet_by_token(token):
    tablet = (
        ProductionStationTablet.objects.select_related('station__department', 'organization')
        .filter(token=token, is_active=True, station__is_active=True)
        .first()
    )
    if not tablet:
        raise ProductionError('Geçersiz veya pasif istasyon tableti.')
    tablet.last_seen_at = timezone.now()
    tablet.save(update_fields=['last_seen_at'])
    return tablet


def _operator_from_pin(*, organization, station, user_id, pin):
    user = User.objects.filter(pk=user_id, organization=organization, is_active=True).first()
    if not user:
        raise ProductionError('Kullanıcı bulunamadı.')
    if not _has_tablet_operator_perm(user):
        raise ProductionError('Bu kullanıcı üretim tabletinde işlem yapamaz.')
    if not _is_station_user(organization, user, station):
        raise ProductionError('Bu kullanıcı bu istasyona atanmış değil.')
    profile = ProductionOperatorProfile.objects.filter(organization=organization, user=user, is_active=True).first()
    if not profile or not profile.check_pin(pin):
        raise ProductionError('Üretim PIN’i hatalı.')
    return user


def quote_line_product_group_key(line) -> str:
    product = getattr(line, 'product', None)
    category = getattr(product, 'category', None) if product else None
    product_defaults = getattr(product, 'template_defaults', {}) or {} if product else {}
    category_defaults = getattr(category, 'template_defaults', {}) or {} if category else {}
    candidates = [
        product_defaults.get('production_group_key', ''),
        category_defaults.get('production_group_key', ''),
        product_defaults.get('template_key', ''),
        category_defaults.get('template_key', ''),
        category_defaults.get('section_key', ''),
        line.section_key,
        category.name if category else '',
        category_defaults.get('document_group_key', ''),
        line.name,
    ]
    for value in candidates:
        key = product_group_key_from_value(value)
        if key:
            return key
    return ''


def get_default_route(organization, product_group_key=''):
    key = product_group_key_from_value(product_group_key)
    qs = ProductionRouteTemplate.objects.filter(organization=organization, is_active=True).prefetch_related('steps__station__department')
    if key:
        route = qs.filter(product_group_key=key).first()
        if route:
            return route
    route = qs.filter(is_default=True).first()
    if route:
        return route
    raise ProductionError('Bu urun grubu icin aktif uretim rotasi yok.')


def generic_factory_preset_payload():
    return {
        'departments': [
            {'code': dep_code, 'name': dep_name, 'color': color, 'order': dep_order, 'stations': [
                {
                    'code': code,
                    'name': name,
                    'order': st_order,
                    'max_workers': capacity,
                    'is_handover': handover,
                    'is_final': final,
                }
                for st_order, (code, name, handover, final) in enumerate(station_rows)
            ]}
            for dep_order, (dep_code, dep_name, color, capacity, station_rows) in enumerate(GENERIC_PRESET_ROUTE)
        ],
        'routes': [{'name': 'Örnek Modüler Üretim Rotası', 'product_group_key': 'moduler_urun', 'is_default': False}],
        'data_fields': [
            {'key': 'counter_total', 'label': 'Toplam sayaç', 'field_type': 'number', 'source': 'device'},
            {'key': 'machine_status', 'label': 'Makine durumu', 'field_type': 'text', 'source': 'device'},
            {'key': 'operator_id', 'label': 'Operatör', 'field_type': 'text', 'source': 'device'},
        ],
        'device_maps': [
            {'source_path': '$.line_id', 'target_key': 'line_id', 'target_type': 'number', 'is_required': True},
            {'source_path': '$.counter.total', 'target_key': 'counter_value', 'target_type': 'number'},
            {'source_path': '$.quantity_delta', 'target_key': 'quantity_delta', 'target_type': 'number'},
            {'source_path': '$.machine.status', 'target_key': 'machine_status', 'target_type': 'text'},
            {'source_path': '$.operator_id', 'target_key': 'operator_id', 'target_type': 'text'},
        ],
    }


def ensure_default_template_presets():
    preset, _ = ProductionTemplatePreset.objects.update_or_create(
        key='generic_modular_factory',
        defaults={
            'name': 'Örnek Modüler Fabrika',
            'description': 'Ürüne veya fabrikaya özel olmayan, kopyalanıp değiştirilebilir örnek üretim akışı.',
            'payload': generic_factory_preset_payload(),
            'is_active': True,
        },
    )
    return preset


@transaction.atomic
def clone_template_preset(preset, organization):
    payload = deepcopy(preset.payload or {})
    stations = []
    first_station = None
    sample_device = None
    for dep_row in payload.get('departments', []):
        department, _ = ProductionDepartment.objects.update_or_create(
            organization=organization,
            code=dep_row['code'],
            defaults={
                'name': dep_row.get('name') or dep_row['code'],
                'color': dep_row.get('color', ''),
                'order': dep_row.get('order', 0),
                'is_active': True,
            },
        )
        for st_row in dep_row.get('stations', []):
            station, _ = ProductionStation.objects.update_or_create(
                organization=organization,
                code=st_row['code'],
                defaults={
                    'department': department,
                    'name': st_row.get('name') or st_row['code'],
                    'order': st_row.get('order', 0),
                    'max_workers': st_row.get('max_workers', 2),
                    'is_handover': st_row.get('is_handover', False),
                    'is_final': st_row.get('is_final', False),
                    'is_active': True,
                },
            )
            first_station = first_station or station
            stations.append(station)
    created_routes = []
    for route_row in payload.get('routes', []):
        route, _ = ProductionRouteTemplate.objects.update_or_create(
            organization=organization,
            name=route_row.get('name') or preset.name,
            defaults={
                'product_group_key': product_group_key_from_value(route_row.get('product_group_key') or preset.key),
                'is_default': route_row.get('is_default', False),
                'is_active': True,
            },
        )
        route.steps.all().delete()
        for idx, station in enumerate(stations):
            ProductionRouteStep.objects.create(route=route, station=station, order=idx, is_required=True)
        created_routes.append(route)
    fields_by_key = {}
    for idx, field_row in enumerate(payload.get('data_fields', [])):
        field, _ = ProductionDataField.objects.update_or_create(
            organization=organization,
            station=first_station,
            key=field_row['key'],
            defaults={
                'label': field_row.get('label') or field_row['key'],
                'field_type': field_row.get('field_type', 'text'),
                'source': field_row.get('source', 'device'),
                'order': idx,
                'is_visible': True,
            },
        )
        fields_by_key[field.key] = field
    if first_station and payload.get('device_maps'):
        sample_device, _ = ProductionDevice.objects.get_or_create(
            organization=organization,
            station=first_station,
            name=f'{preset.name} Örnek RPi',
            defaults={'is_active': True, 'token': make_device_token()},
        )
        if not sample_device.is_active:
            sample_device.is_active = True
            sample_device.save(update_fields=['is_active'])
        for idx, map_row in enumerate(payload.get('device_maps', [])):
            ProductionDevicePayloadMap.objects.update_or_create(
                organization=organization,
                device=sample_device,
                source_path=map_row['source_path'],
                target_key=map_row['target_key'],
                defaults={
                    'station': first_station,
                    'data_field': fields_by_key.get(map_row['target_key']),
                    'target_type': map_row.get('target_type', 'text'),
                    'is_required': map_row.get('is_required', False),
                    'is_active': True,
                    'order': idx,
                },
            )
    return {
        'preset_id': preset.id,
        'departments': len(payload.get('departments', [])),
        'stations': len(stations),
        'device_id': sample_device.id if sample_device else None,
        'device_maps': len(payload.get('device_maps', [])) if sample_device else 0,
        'routes': [{'id': route.id, 'name': route.name} for route in created_routes],
    }


def generate_work_order_number(organization):
    timestamp = timezone.localtime(timezone.now()).strftime('%y%m%d%H%M')
    prefix = (getattr(organization, 'code', '') or 'ORG')[:4].upper()
    base = f'UR-{prefix}-{timestamp}'
    candidate = base
    suffix = 2
    while ProductionWorkOrder.objects.filter(organization=organization, number=candidate).exists():
        candidate = f'{base}-{suffix}'
        suffix += 1
    return candidate


def create_progress_steps(line, route):
    steps = list(route.steps.select_related('station__department').order_by('order', 'id'))
    if not steps:
        raise ProductionError('Uretim rotasinda istasyon yok.')
    rows = []
    for step_idx, route_step in enumerate(steps):
        initial_status = 'ready' if step_idx == 0 or route_step.start_policy == 'parallel' else 'locked'
        rows.append(
            ProductionStepProgress(
                line=line,
                route_step=route_step,
                station=route_step.station,
                order=route_step.order,
                target_quantity=line.quantity,
                status=initial_status,
            )
        )
    ProductionStepProgress.objects.bulk_create(rows)


def _line_detail(line, key, fallback=''):
    details = dict(line.details or {})
    return _norm(details.get(key) or details.get(key.replace('_', '-')) or fallback)


def quote_line_payload(line):
    product = line.product
    details = deepcopy(line.details or {})
    return {
        'product': product,
        'product_sku': _norm(getattr(product, 'sku', '') or details.get('code') or details.get('sku')),
        'product_name': _norm(line.name or getattr(product, 'name', '') or 'Ürün'),
        'detail_1': _line_detail(line, 'primary') or _line_detail(line, 'detail_1') or _line_detail(line, 'measure'),
        'detail_2': _line_detail(line, 'secondary') or _line_detail(line, 'detail_2') or _line_detail(line, 'color'),
        'quantity': _decimal(line.qty),
        'technical_notes': _norm(details.get('technical_notes') or details.get('note') or ''),
        'details': details,
        'sort_order': int(line.sort_order or 0),
    }


@transaction.atomic
def create_work_order_from_contract(quote, *, user=None):
    if quote.document_type != 'Contract' or quote.status != 'Approved':
        return None
    existing = ProductionWorkOrder.objects.filter(
        organization=quote.organization,
        source_type='contract',
        source_id=str(quote.id),
    ).first()
    if existing:
        return existing

    route_lines = []
    for line in quote.lines.select_related('product__category').all().order_by('sort_order', 'id'):
        group_key = quote_line_product_group_key(line)
        if not group_key:
            continue
        route = ProductionRouteTemplate.objects.filter(
            organization=quote.organization,
            product_group_key=group_key,
            is_active=True,
        ).prefetch_related('steps__station__department').first()
        if route:
            route_lines.append((line, route))
    lines = [line for line, _route in route_lines]
    if not lines:
        return None

    route = route_lines[0][1]
    if not route.steps.exists():
        raise ProductionError('Secilen uretim rotasinda istasyon yok.')

    try:
        order = ProductionWorkOrder.objects.create(
            organization=quote.organization,
            number=generate_work_order_number(quote.organization),
            source_type='contract',
            source_id=str(quote.id),
            source_number=quote.number,
            customer_name=getattr(quote.customer, 'name', ''),
            status='waiting',
            route=route,
            planned_start=timezone.localdate(),
            due_date=quote.valid_until,
            notes=f'{quote.number} sozlesmesinden otomatik olustu.',
            created_by=user or quote.prepared_by or quote.owner,
        )
    except IntegrityError:
        return ProductionWorkOrder.objects.get(organization=quote.organization, source_type='contract', source_id=str(quote.id))

    for idx, (ql, line_route) in enumerate(route_lines):
        payload = quote_line_payload(ql)
        line = ProductionWorkOrderLine.objects.create(work_order=order, route=line_route, **payload)
        create_progress_steps(line, line_route)

    config = deepcopy(quote.contract_config or {})
    config['production_work_order_id'] = order.id
    config['production_work_order_number'] = order.number
    quote.contract_config = config
    quote.save(update_fields=['contract_config'])
    return order


@transaction.atomic
def create_manual_work_order(*, organization, user=None, customer_name='', due_date=None, notes='', source_number='', route=None, product_group_key=''):
    route = route or get_default_route(organization, product_group_key)
    return ProductionWorkOrder.objects.create(
        organization=organization,
        number=generate_work_order_number(organization),
        source_type='manual',
        source_id=f'manual-{uuid4().hex}',
        source_number=source_number or '',
        customer_name=customer_name or '',
        status='waiting',
        route=route,
        planned_start=timezone.localdate(),
        due_date=due_date,
        notes=notes or '',
        created_by=user,
    )


@transaction.atomic
def add_manual_work_order_line(*, work_order, product=None, product_sku='', product_name='', detail_1='', detail_2='', quantity=0, technical_notes='', route=None):
    qty = _decimal(quantity)
    if qty <= 0:
        raise ProductionError('Miktar sifirdan buyuk olmalidir.')
    if product and not product_sku:
        product_sku = product.sku
    if product and not product_name:
        product_name = product.name
    if not _norm(product_name):
        raise ProductionError('Urun adi zorunludur.')
    selected_route = route if isinstance(route, ProductionRouteTemplate) else None
    if route and not selected_route:
        selected_route = ProductionRouteTemplate.objects.filter(organization=work_order.organization, pk=route, is_active=True).first()
    selected_route = selected_route or work_order.route
    line = ProductionWorkOrderLine.objects.create(
        work_order=work_order,
        route=selected_route,
        product=product,
        product_sku=_norm(product_sku),
        product_name=_norm(product_name),
        detail_1=_norm(detail_1),
        detail_2=_norm(detail_2),
        quantity=qty,
        technical_notes=_norm(technical_notes),
        sort_order=(work_order.lines.aggregate(max_order=Max('sort_order'))['max_order'] or 0) + 1,
    )
    if not selected_route:
        raise ProductionError('Uretim rotasi zorunludur.')
    create_progress_steps(line, selected_route)
    return line


def _json_path(payload, path):
    if not path or not path.startswith('$.'):
        raise ProductionError('JSON path $. ile baslamalidir.')
    current = payload
    for part in path[2:].split('.'):
        if isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError) as exc:
                raise KeyError(path) from exc
        elif isinstance(current, dict) and part in current:
            current = current[part]
        else:
            raise KeyError(path)
    return current


def _cast_mapping_value(value, target_type):
    if value in ('', None):
        return value
    if target_type == 'number':
        return float(_decimal(value, 'Mapping degeri'))
    if target_type == 'boolean':
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {'1', 'true', 'yes', 'evet', 'on'}
    if target_type == 'json':
        return value
    return str(value)


def apply_device_payload_maps(device, raw_payload):
    normalized = {}
    errors = []
    maps = ProductionDevicePayloadMap.objects.filter(device=device, is_active=True).order_by('order', 'id')
    for row in maps:
        try:
            value = _json_path(raw_payload, row.source_path)
        except KeyError:
            if row.is_required:
                errors.append({'source_path': row.source_path, 'target_key': row.target_key, 'error': 'missing'})
                if row.default_value == '':
                    continue
            elif row.default_value != '':
                value = row.default_value
            else:
                continue
        try:
            normalized[row.target_key] = _cast_mapping_value(value, row.target_type)
        except ProductionError as exc:
            errors.append({'source_path': row.source_path, 'target_key': row.target_key, 'error': str(exc)})
    return normalized, errors


def make_pi_idempotency_key(device, raw_payload, normalized_payload):
    basis = {
        'device_id': device.id,
        'counter': normalized_payload.get('counter_value') or raw_payload.get('counter'),
        'timestamp': normalized_payload.get('timestamp') or raw_payload.get('timestamp'),
        'payload': raw_payload,
    }
    digest = hashlib.sha256(json.dumps(basis, sort_keys=True, default=str).encode('utf-8')).hexdigest()
    return f'pi-{device.id}-{digest[:48]}'


def _rule_value(config, context, key='value'):
    if config.get(f'{key}_source') == 'normalized':
        return context.get('normalized_payload', {}).get(config.get(f'{key}_key', ''))
    if config.get(f'{key}_source') == 'context':
        return context.get(config.get(f'{key}_key', ''))
    return config.get(key)


def _condition_matches(config, context):
    left = _rule_value(config, context, 'left')
    right = _rule_value(config, context, 'right')
    op = config.get('operator', 'eq')
    if op == 'neq':
        return left != right
    if op == 'gt':
        return Decimal(str(left or 0)) > Decimal(str(right or 0))
    if op == 'gte':
        return Decimal(str(left or 0)) >= Decimal(str(right or 0))
    if op == 'lt':
        return Decimal(str(left or 0)) < Decimal(str(right or 0))
    if op == 'lte':
        return Decimal(str(left or 0)) <= Decimal(str(right or 0))
    if op == 'contains':
        return str(right) in str(left)
    return left == right


def apply_rule_blocks(context):
    station = context.get('station')
    route = context.get('route')
    if not station:
        return context
    rule_sets = ProductionRuleSet.objects.filter(
        organization=context['organization'],
        is_active=True,
        trigger_event=context.get('trigger_event', 'pi_event'),
    ).filter(
        models.Q(scope='global') | models.Q(scope='station', station=station) | models.Q(scope='route', route=route)
    ).prefetch_related('blocks').order_by('order', 'id')
    for rule_set in rule_sets:
        active = True
        for block in rule_set.blocks.all():
            if not block.is_active or not active:
                continue
            config = block.config or {}
            if block.block_type == 'condition':
                active = _condition_matches(config, context)
            elif block.block_type == 'assign':
                target = config.get('target_key')
                if target:
                    context['normalized_payload'][target] = _rule_value(config, context)
            elif block.block_type == 'increment_quantity':
                context['event_type'] = 'quantity'
                context['quantity_delta'] = _rule_value(config, context, 'delta') or context.get('quantity_delta') or 0
            elif block.block_type == 'change_status':
                context['event_type'] = config.get('event_type') or context.get('event_type') or 'quantity'
            elif block.block_type in {'open_next_step', 'stock_in'}:
                context.setdefault('post_actions', []).append(block.block_type)
    return context


def _active_worker_count(station):
    return (
        ProductionEvent.objects.filter(
            station=station,
            event_type='start',
            step__status='in_progress',
            created_at__date=timezone.localdate(),
        )
        .values('user_id')
        .distinct()
        .count()
    )


def _next_step(step):
    return (
        ProductionStepProgress.objects.filter(line=step.line, order__gt=step.order)
        .order_by('order', 'id')
        .first()
    )


def _previous_step_summary(step):
    previous = (
        ProductionStepProgress.objects.filter(line=step.line, order__lt=step.order)
        .select_related('station')
        .order_by('-order', '-id')
        .first()
    )
    if not previous:
        return None
    last_session = (
        ProductionWorkSession.objects.filter(step=previous, status__in=['closed', 'handover'])
        .select_related('user', 'station')
        .order_by('-ended_at', '-id')
        .first()
    )
    return {
        'station_code': previous.station.code,
        'station_name': previous.station.name,
        'completed_quantity': previous.completed_quantity,
        'machine_quantity': previous.machine_quantity,
        'status': previous.status,
        'last_user': (last_session.user.get_full_name() or last_session.user.username) if last_session else '',
        'last_closed_at': last_session.ended_at if last_session else previous.completed_at,
        'has_discrepancy': bool(last_session and last_session.discrepancy_status == 'needs_review'),
    }


def _step_for_session_action(organization, line_id, station_code):
    line = (
        ProductionWorkOrderLine.objects.select_for_update()
        .select_related('work_order')
        .get(pk=line_id, work_order__organization=organization)
    )
    station = ProductionStation.objects.get(organization=organization, code=station_code, is_active=True)
    step = (
        ProductionStepProgress.objects.select_for_update()
        .select_related('station', 'line__work_order')
        .get(line=line, station=station)
    )
    return line, station, step


def _active_session_for_step(step):
    return (
        ProductionWorkSession.objects.select_for_update()
        .filter(step=step, status__in=ACTIVE_SESSION_STATUSES)
        .select_related('user')
        .order_by('-started_at', '-id')
        .first()
    )


def _active_sessions_for_step(step):
    return (
        ProductionWorkSession.objects.select_for_update()
        .filter(step=step, status__in=ACTIVE_SESSION_STATUSES)
        .select_related('user')
        .order_by('slot_index', 'started_at', 'id')
    )


def _latest_handover_session(step):
    return (
        ProductionWorkSession.objects.filter(step=step, status='handover')
        .select_related('user')
        .order_by('-ended_at', '-id')
        .first()
    )


def _create_session_event(*, session, event_type, quantity_delta=0, counter_value=None, note='', idempotency_key='', source='ui',
                          device=None, raw_payload=None, normalized_payload=None, mapping_errors=None):
    if idempotency_key:
        existing = ProductionEvent.objects.filter(organization=session.organization, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    return ProductionEvent.objects.create(
        organization=session.organization,
        work_order=session.work_order,
        line=session.line,
        step=session.step,
        station=session.station,
        session=session,
        event_type=event_type,
        quantity_delta=_signed_decimal(quantity_delta),
        counter_value=counter_value,
        note=note or '',
        idempotency_key=idempotency_key or '',
        source=source,
        device=device,
        user=session.user if source != 'pi' else None,
        raw_payload=raw_payload or {},
        normalized_payload=normalized_payload or {},
        mapping_errors=mapping_errors or [],
    )


def _create_unmatched_machine_event(*, organization, line, step, station, quantity_delta=0, counter_value=None, note='', idempotency_key='',
                                    device=None, raw_payload=None, normalized_payload=None, mapping_errors=None):
    if idempotency_key:
        existing = ProductionEvent.objects.filter(organization=organization, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    return ProductionEvent.objects.create(
        organization=organization,
        work_order=line.work_order,
        line=line,
        step=step,
        station=station,
        session=None,
        event_type='quantity',
        quantity_delta=_signed_decimal(quantity_delta),
        counter_value=counter_value,
        note=note or 'Eşleşmemiş makine verisi: açık kullanıcı oturumu yok.',
        idempotency_key=idempotency_key or '',
        source='pi',
        device=device,
        user=None,
        raw_payload=raw_payload or {},
        normalized_payload=normalized_payload or {},
        mapping_errors=mapping_errors or [],
    )


def _open_window_for_tablet(tablet, step, *, start_total=None, sessions=None, note=''):
    sessions = list(sessions if sessions is not None else ProductionWorkSession.objects.filter(
        organization=tablet.organization,
        tablet=tablet,
        station=tablet.station,
        step=step,
        status='started',
    ).select_related('user'))
    if not sessions:
        return None
    existing = ProductionCountingWindow.objects.filter(
        organization=tablet.organization,
        tablet=tablet,
        step=step,
        status='open',
    ).first()
    if existing:
        return existing
    if start_total is None:
        latest = ProductionCountingWindow.objects.filter(
            organization=tablet.organization,
            tablet=tablet,
            step=step,
            status='closed',
        ).order_by('-closed_at', '-id').first()
        start_total = latest.close_total if latest and latest.close_total is not None else Decimal('0')
    window = ProductionCountingWindow.objects.create(
        organization=tablet.organization,
        work_order=step.line.work_order if step else None,
        line=step.line if step else None,
        step=step,
        station=tablet.station,
        tablet=tablet,
        start_total=_signed_decimal(start_total),
        note=note or '',
    )
    for session in sessions:
        ProductionCountingParticipant.objects.get_or_create(
            organization=tablet.organization,
            window=window,
            session=session,
            defaults={'user': session.user, 'start_total': window.start_total},
        )
    return window


def _open_window_for_current_sessions(tablet, step, *, start_total=None, note=''):
    sessions = list(
        ProductionWorkSession.objects.filter(
            organization=tablet.organization,
            tablet=tablet,
            station=tablet.station,
            step=step,
            status='started',
        ).select_related('user')
    )
    return _open_window_for_tablet(tablet, step, start_total=start_total, sessions=sessions, note=note)


def _active_tablet_sessions(tablet, *, step=None):
    qs = ProductionWorkSession.objects.filter(
        organization=tablet.organization,
        tablet=tablet,
        station=tablet.station,
        status__in=ACTIVE_SESSION_STATUSES,
    ).select_related('user', 'line', 'work_order', 'step')
    if step:
        qs = qs.filter(step=step)
    return list(qs.order_by('slot_index', 'started_at', 'id'))


def _require_checkpoint_payload(active_sessions, checkpoint_total=None, participant_totals=None):
    if not active_sessions:
        return {}
    if participant_totals:
        return {int(key): value for key, value in participant_totals.items()}
    if checkpoint_total is None or checkpoint_total == '':
        raise ProductionError('Mevcut ekip degismeden once ortak uretim toplamı girilmelidir.')
    return {session.id: checkpoint_total for session in active_sessions}


def _participant_today_total(organization, user, day):
    session_ids = list(
        ProductionWorkSession.objects.filter(
            organization=organization,
            user=user,
            started_at__date=day,
        ).values_list('id', flat=True)
    )
    total = Decimal('0')
    for session_id in session_ids:
        total += (
            ProductionCountingParticipant.objects.filter(organization=organization, session_id=session_id)
            .aggregate(total=Sum('credited_quantity'))['total']
            or Decimal('0')
        )
    return total


def _station_target_payload(organization, station, day):
    target, _ = ProductionStationTarget.objects.get_or_create(
        organization=organization,
        station=station,
        target_date=day,
        defaults={'target_quantity': Decimal('0')},
    )
    actual = (
        ProductionCountingWindow.objects.filter(
            organization=organization,
            station=station,
            status='closed',
            closed_at__date=day,
        ).aggregate(total=Sum('official_delta'))['total']
        or Decimal('0')
    )
    return {
        'id': target.id,
        'date': target.target_date,
        'target_quantity': target.target_quantity,
        'actual_quantity': actual,
        'remaining_quantity': max(target.target_quantity - actual, Decimal('0')),
        'note': target.note,
    }


def _serialize_window_for_tablet(window):
    if not window:
        return None
    return {
        'id': window.id,
        'line_id': window.line_id,
        'step_id': window.step_id,
        'status': window.status,
        'start_total': window.start_total,
        'machine_delta': window.machine_delta,
        'opened_at': window.opened_at,
        'participants': [
            {
                'id': participant.id,
                'session_id': participant.session_id,
                'user_id': participant.user_id,
                'user_name': participant.user.get_full_name() or participant.user.username,
                'start_total': participant.start_total,
                'declared_total': participant.declared_total,
                'credited_quantity': participant.credited_quantity,
                'discrepancy_status': participant.discrepancy_status,
            }
            for participant in window.participants.select_related('user', 'session').all()
        ],
    }


def _close_counting_window(*, tablet, step, declared_totals, reason='manual', note=''):
    window = (
        ProductionCountingWindow.objects.select_for_update()
        .filter(organization=tablet.organization, tablet=tablet, step=step, status='open')
        .first()
    )
    if not window:
        return None
    clean_totals = {}
    for key, value in (declared_totals or {}).items():
        if value is None or value == '':
            continue
        clean_totals[int(key)] = _decimal(value, 'Ortak üretim toplamı')
    if not clean_totals:
        raise ProductionError('Checkpoint icin en az bir uretim toplamı girilmelidir.')
    official_delta = max(clean_totals.values())
    if official_delta < 0:
        raise ProductionError('Üretim miktarı 0\'dan küçük olamaz.')
    close_total = window.start_total + official_delta
    window.status = 'closed'
    window.closed_at = timezone.now()
    window.close_total = close_total
    window.official_delta = official_delta
    window.close_reason = reason
    window.note = note or window.note
    window.save(update_fields=['status', 'closed_at', 'close_total', 'official_delta', 'close_reason', 'note'])

    participants = list(window.participants.select_related('session', 'user').select_for_update())
    for participant in participants:
        declared = clean_totals.get(participant.session_id, official_delta)
        participant.declared_total = declared
        participant.credited_quantity = declared
        participant.discrepancy_quantity = declared - official_delta
        participant.discrepancy_status = 'needs_review' if participant.discrepancy_quantity != 0 else 'none'
        participant.note = note or participant.note
        participant.save(update_fields=['declared_total', 'credited_quantity', 'discrepancy_quantity', 'discrepancy_status', 'note'])
        session = participant.session
        session.declared_good_quantity = ProductionCountingParticipant.objects.filter(session=session).aggregate(total=Sum('credited_quantity'))['total'] or Decimal('0')
        session.discrepancy_quantity = max(session.discrepancy_quantity, abs(participant.discrepancy_quantity))
        if participant.discrepancy_status == 'needs_review':
            session.discrepancy_status = 'needs_review'
        session.save(update_fields=['declared_good_quantity', 'discrepancy_quantity', 'discrepancy_status', 'updated_at'])

    if official_delta > 0:
        progress = None
        if step:
            progress = ProductionStepProgress.objects.select_for_update().get(pk=step.pk)
            progress.completed_quantity = min(progress.target_quantity, progress.completed_quantity + official_delta)
            if progress.status == 'ready':
                progress.status = 'in_progress'
                progress.started_at = progress.started_at or timezone.now()
            progress.save(update_fields=['completed_quantity', 'status', 'started_at'])
        ProductionEvent.objects.create(
            organization=tablet.organization,
            work_order=window.work_order,
            line=window.line,
            step=progress,
            station=tablet.station,
            event_type='quantity',
            quantity_delta=official_delta,
            note=note or f'Tablet checkpoint: {reason}',
            source='tablet_checkpoint',
            user=None,
        )
        if window.line:
            _refresh_line_and_order(window.line)
    return window


def _active_break_for_session(session):
    return session.breaks.filter(ended_at__isnull=True).order_by('-started_at', '-id').first()


def _open_break(session, note=''):
    row = _active_break_for_session(session)
    if row:
        return row
    return ProductionSessionBreak.objects.create(
        organization=session.organization,
        session=session,
        user=session.user,
        note=note or '',
    )


def _close_active_break(session, note=''):
    row = _active_break_for_session(session)
    if not row:
        return None
    row.ended_at = timezone.now()
    row.note = note or row.note
    row.save(update_fields=['ended_at', 'note'])
    return row


@transaction.atomic
def start_work_session(*, organization, user, line_id=None, station_code, start_counter=None, note='', allow_unassigned=False,
                       tablet_token='', tablet=None, slot_index=None):
    if line_id:
        line, station, step = _step_for_session_action(organization, line_id, station_code)
    else:
        line, station, step = None, ProductionStation.objects.get(organization=organization, code=station_code, is_active=True), None

    if tablet_token:
        tablet = _tablet_by_token(tablet_token)
    if tablet and tablet.station_id != station.id:
        raise ProductionError('Tablet bu istasyona bağlı değil.')
    if not allow_unassigned and not _is_station_user(organization, user, station):
        raise ProductionError('Bu istasyonda işlem yapmaya atanmış kullanıcı değilsiniz.')
    if step:
        if step.status == 'locked':
            raise ProductionError('Bu istasyon henuz acik degil.')
        if step.status in ('completed', 'skipped'):
            raise ProductionError('Tamamlanan istasyonda yeni oturum acilamaz.')

    user_active = (
        ProductionWorkSession.objects.select_for_update()
        .filter(organization=organization, user=user, status__in=ACTIVE_SESSION_STATUSES)
        .first()
    )
    if user_active:
        if (step and user_active.step_id == step.id) or (not step and not user_active.step_id):
            if user_active.status == 'paused':
                _close_active_break(user_active, 'Tablet yeniden girişinde mola otomatik kapandı.')
                user_active.status = 'started'
                user_active.save(update_fields=['status', 'updated_at'])
            return user_active
        raise ProductionError('Bu kullanıcının açık üretim oturumu var. Yeni işe geçmeden önce mevcut işi kapatın.')

    if step:
        active_sessions = list(_active_sessions_for_step(step))
    else:
        active_sessions = list(
            ProductionWorkSession.objects.select_for_update()
            .filter(organization=organization, station=station, status__in=ACTIVE_SESSION_STATUSES)
            .select_related('user')
        )

    if len(active_sessions) >= station.max_workers:
        raise ProductionError(f'{station.code} kapasitesi dolu.')
    if slot_index is not None:
        if slot_index < 0 or slot_index >= station.max_workers:
            raise ProductionError('Geçersiz tablet slotu.')
        if any(item.slot_index == slot_index and (not tablet or item.tablet_id == tablet.id) for item in active_sessions):
            raise ProductionError('Bu tablet slotu dolu.')
    previous = _latest_handover_session(step) if step else None
    session = ProductionWorkSession.objects.create(
        organization=organization,
        work_order=line.work_order if line else None,
        line=line,
        step=step,
        station=station,
        user=user,
        tablet=tablet,
        slot_index=slot_index,
        previous_session=previous,
        start_counter=start_counter,
        note=note or '',
    )
    if step:
        if step.status in ('ready', 'waiting_handover'):
            step.status = 'in_progress'
            step.started_at = step.started_at or timezone.now()
            step.save(update_fields=['status', 'started_at'])
        line.work_order.status = 'in_progress'
        line.work_order.save(update_fields=['status', 'updated_at'])
    _create_session_event(session=session, event_type='start', counter_value=start_counter, note=note)
    return session


@transaction.atomic
def pause_work_session(*, organization, user, session_id, note=''):
    session = ProductionWorkSession.objects.select_for_update().get(pk=session_id, organization=organization)
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu molaya alabilirsiniz.')
    if session.status != 'started':
        raise ProductionError('Yalniz aktif oturum molaya alinabilir.')
    session.status = 'paused'
    session.note = note or session.note
    session.save(update_fields=['status', 'note', 'updated_at'])
    _open_break(session, note)
    return _create_session_event(session=session, event_type='pause', note=note)


@transaction.atomic
def resume_work_session(*, organization, user, session_id, note=''):
    session = ProductionWorkSession.objects.select_for_update().get(pk=session_id, organization=organization)
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu devam ettirebilirsiniz.')
    if session.status != 'paused':
        raise ProductionError('Yalniz moladaki oturum devam ettirilebilir.')
    _close_active_break(session, note)
    session.status = 'started'
    session.note = note or session.note
    session.save(update_fields=['status', 'note', 'updated_at'])
    return _create_session_event(session=session, event_type='resume', note=note)


@transaction.atomic
def handover_work_session(*, organization, user, session_id, note=''):
    session = ProductionWorkSession.objects.select_for_update().get(pk=session_id, organization=organization)
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu devredebilirsiniz.')
    if session.status not in ACTIVE_SESSION_STATUSES:
        raise ProductionError('Yalniz acik oturum devredilebilir.')
    session.status = 'handover'
    session.ended_at = timezone.now()
    session.note = note or session.note
    _close_active_break(session, note)
    session.save(update_fields=['status', 'ended_at', 'note', 'updated_at'])
    step = session.step
    if step:
        if step.status == 'in_progress':
            step.status = 'waiting_handover'
            step.save(update_fields=['status'])
    return _create_session_event(session=session, event_type='handover', note=note)


@transaction.atomic
def close_work_session(*, organization, user, session_id, declared_good_quantity, end_counter=None, note=''):
    session = (
        ProductionWorkSession.objects.select_for_update()
        .get(pk=session_id, organization=organization)
    )
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu kapatabilirsiniz.')
    if session.status not in ACTIVE_SESSION_STATUSES:
        raise ProductionError('Yalniz acik oturum kapatilabilir.')
    good = _decimal(declared_good_quantity, 'Saglam adet')
    if end_counter is not None and session.start_counter is not None:
        counter_delta = _signed_decimal(end_counter, 'Bitis sayaci') - session.start_counter
        if counter_delta >= 0:
            session.machine_quantity = counter_delta
    discrepancy = session.machine_quantity - good
    session.status = 'closed'
    session.ended_at = timezone.now()
    session.end_counter = end_counter
    session.declared_good_quantity = good
    session.discrepancy_quantity = discrepancy
    session.discrepancy_status = 'needs_review' if discrepancy != 0 else 'none'
    session.note = note or session.note
    _close_active_break(session, note)
    session.save(update_fields=[
        'status',
        'ended_at',
        'end_counter',
        'machine_quantity',
        'declared_good_quantity',
        'discrepancy_quantity',
        'discrepancy_status',
        'note',
        'updated_at',
    ])

    if session.step_id:
        step = ProductionStepProgress.objects.select_for_update().get(pk=session.step_id)
        step.completed_quantity = min(step.target_quantity, step.completed_quantity + good)
        if step.completed_quantity >= step.target_quantity:
            step.status = 'completed'
            step.completed_at = timezone.now()
            step.completed_by = user
        else:
            step.status = 'waiting_handover'
        step.save(update_fields=['completed_quantity', 'status', 'completed_at', 'completed_by'])

        event = _create_session_event(session=session, event_type='complete', quantity_delta=good, counter_value=end_counter, note=note)
        if step.status == 'completed':
            nxt = _next_step(step)
            if nxt and nxt.status == 'locked':
                nxt.status = 'ready'
                nxt.save(update_fields=['status'])
    else:
        event = _create_session_event(session=session, event_type='complete', quantity_delta=good, counter_value=end_counter, note=note)

    if session.line:
        _refresh_line_and_order(session.line)
    return event


@transaction.atomic
def review_session_discrepancy(*, organization, user, session_id, action, corrected_good_quantity=None, note=''):
    session = (
        ProductionWorkSession.objects.select_for_update()
        .get(pk=session_id, organization=organization)
    )
    if session.discrepancy_status != 'needs_review':
        raise ProductionError('Bu oturumda incelenecek fark yok.')
    if action == 'corrected':
        if corrected_good_quantity is None:
            raise ProductionError('Duzeltme icin saglam adet zorunludur.')
        corrected = _decimal(corrected_good_quantity, 'Duzeltilmis saglam adet')
        delta = corrected - session.declared_good_quantity
        if session.step_id:
            step = ProductionStepProgress.objects.select_for_update().get(pk=session.step_id)
            step.completed_quantity = max(Decimal('0'), min(step.target_quantity, step.completed_quantity + delta))
            if step.completed_quantity >= step.target_quantity:
                step.status = 'completed'
                step.completed_at = step.completed_at or timezone.now()
                step.completed_by = step.completed_by or user
            elif step.status == 'completed':
                step.status = 'waiting_handover'
                step.completed_at = None
                step.completed_by = None
            step.save(update_fields=['completed_quantity', 'status', 'completed_at', 'completed_by'])
        session.declared_good_quantity = corrected
        session.discrepancy_quantity = session.machine_quantity - corrected
        session.discrepancy_status = 'corrected'
        if session.line:
            _refresh_line_and_order(session.line)
    else:
        session.discrepancy_status = 'approved'
    session.reviewed_by = user
    session.reviewed_at = timezone.now()
    session.review_note = note or ''
    session.save(update_fields=[
        'declared_good_quantity',
        'discrepancy_quantity',
        'discrepancy_status',
        'reviewed_by',
        'reviewed_at',
        'review_note',
        'updated_at',
    ])
    return session


@transaction.atomic
def record_machine_session_event(*, organization, line_id, station_code, quantity_delta=0, counter_value=None, note='',
                                 idempotency_key='', device=None, raw_payload=None, normalized_payload=None, mapping_errors=None):
    if idempotency_key:
        existing = ProductionEvent.objects.filter(organization=organization, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    line, station, step = _step_for_session_action(organization, line_id, station_code)
    qty = _decimal(quantity_delta)
    active_rows = list(_active_sessions_for_step(step).filter(status='started'))
    operator_hint = (normalized_payload or {}).get('operator_id') or (normalized_payload or {}).get('user_id') or (raw_payload or {}).get('operator_id')
    active = None
    if operator_hint:
        hint = str(operator_hint)
        active = next(
            (
                item for item in active_rows
                if str(item.user_id) == hint or item.user.username == hint or str(getattr(item.user, 'email', '')) == hint
            ),
            None,
        )
    elif len(active_rows) == 1:
        active = active_rows[0]
    if not active:
        if active_rows:
            step.machine_quantity = step.machine_quantity + qty
            step.save(update_fields=['machine_quantity'])
        return _create_unmatched_machine_event(
            organization=organization,
            line=line,
            step=step,
            station=station,
            quantity_delta=qty,
            counter_value=counter_value,
            note=note or ('Eşleşmemiş makine verisi: birden fazla açık kullanıcı oturumu var.' if active_rows else ''),
            idempotency_key=idempotency_key,
            device=device,
            raw_payload=raw_payload,
            normalized_payload=normalized_payload,
            mapping_errors=mapping_errors,
        )
    active.machine_quantity = active.machine_quantity + qty
    active.save(update_fields=['machine_quantity', 'updated_at'])
    step.machine_quantity = step.machine_quantity + qty
    step.save(update_fields=['machine_quantity'])
    if active.tablet_id:
        window = ProductionCountingWindow.objects.filter(
            organization=organization,
            tablet=active.tablet,
            step=step,
            status='open',
        ).first()
        if window:
            window.machine_delta = window.machine_delta + qty
            window.save(update_fields=['machine_delta'])
    return _create_session_event(
        session=active,
        event_type='quantity',
        quantity_delta=qty,
        counter_value=counter_value,
        note=note,
        idempotency_key=idempotency_key,
        source='pi',
        device=device,
        raw_payload=raw_payload,
        normalized_payload=normalized_payload,
        mapping_errors=mapping_errors,
    )


def _serialize_session_for_tablet(session):
    active_break = _active_break_for_session(session)
    return {
        'id': session.id,
        'user_id': session.user_id,
        'user_name': session.user.get_full_name() or session.user.username,
        'line_id': session.line_id,
        'work_order_number': session.work_order.number if session.work_order else '',
        'product_sku': session.line.product_sku if session.line else '',
        'product_name': session.line.product_name if session.line else 'Genel Çalışma',
        'status': session.status,
        'slot_index': session.slot_index,
        'started_at': session.started_at,
        'machine_quantity': session.machine_quantity,
        'declared_good_quantity': session.declared_good_quantity,
        'break_seconds': sum(item.duration_seconds for item in session.breaks.all()),
        'active_break_id': active_break.id if active_break else None,
        'active_break_started_at': active_break.started_at if active_break else None,
    }


def _work_item_for_step(step, tablet=None):
    line = step.line
    assignments = list(step.tablet_assignments.all())
    assignment = next((item for item in assignments if tablet and item.tablet_id == tablet.id), None)
    return {
        'line_id': line.id,
        'work_order_id': line.work_order_id,
        'work_order_number': line.work_order.number,
        'customer_name': line.work_order.customer_name,
        'product_sku': line.product_sku,
        'product_name': line.product_name,
        'detail_1': line.detail_1,
        'detail_2': line.detail_2,
        'status': step.status,
        'target_quantity': step.target_quantity,
        'completed_quantity': step.completed_quantity,
        'machine_quantity': step.machine_quantity,
        'remaining_quantity': max(step.target_quantity - step.completed_quantity, 0),
        'visibility': 'selected_tablets' if assignments else 'all_tablets',
        'is_pinned': bool(assignment and assignment.is_pinned),
        'priority': assignment.priority if assignment else 0,
        'start_policy': step.route_step.start_policy,
        'assigned_tablet_ids': [item.tablet_id for item in assignments],
    }


def tablet_context(token):
    tablet = _tablet_by_token(token)
    station = tablet.station
    shift_payload = _tablet_shift_payload(tablet)
    open_statuses = ['ready', 'in_progress', 'waiting_handover']
    steps = (
        ProductionStepProgress.objects.filter(
            line__work_order__organization=tablet.organization,
            station=station,
            status__in=open_statuses,
        )
        .select_related('line__work_order', 'station', 'route_step')
        .prefetch_related('tablet_assignments')
        .order_by('line__work_order__due_date', 'line__work_order__number', 'order')[:100]
    )
    visible_steps = []
    for step in steps:
        assignments = list(step.tablet_assignments.all())
        if assignments and not any(item.tablet_id == tablet.id for item in assignments):
            continue
        visible_steps.append(step)
    active_sessions = list(
        ProductionWorkSession.objects.filter(
            organization=tablet.organization,
            station=station,
            status__in=ACTIVE_SESSION_STATUSES,
        )
        .select_related('user', 'line', 'work_order')
        .prefetch_related('breaks')
        .order_by('slot_index', 'started_at', 'id')
    )
    assigned = (
        ProductionStationUser.objects.filter(organization=tablet.organization, station=station, is_active=True, user__is_active=True)
        .select_related('user')
        .order_by('role', 'user__first_name', 'user__username')
    )
    today = timezone.localdate()
    target_payload = _station_target_payload(tablet.organization, station, today)
    operators = []
    for row in assigned:
        profile = ProductionOperatorProfile.objects.filter(organization=tablet.organization, user=row.user, is_active=True).first()
        if not _has_tablet_operator_perm(row.user):
            continue
        operators.append({
            'id': row.user_id,
            'name': row.user.get_full_name() or row.user.username,
            'role': row.role,
            'has_pin': bool(profile and profile.pin_hash),
            'today_total': _participant_today_total(tablet.organization, row.user, today),
        })
    alerts = list(
        ProductionStationAlert.objects.filter(organization=tablet.organization)
        .filter(
            models.Q(station=station)
            | models.Q(department=station.department)
            | models.Q(work_order__lines__steps__station=station)
        )
        .exclude(acks__tablet=tablet)
        .filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now()))
        .distinct()
        .order_by('-created_at')[:20]
    )
    return {
        'tablet': {'id': tablet.id, 'name': tablet.name, 'token': tablet.token},
        'station': {
            'id': station.id,
            'code': station.code,
            'name': station.name,
            'department_name': station.department.name,
            'max_workers': station.max_workers,
        },
        'daily_target': target_payload,
        'shift_state': shift_payload,
        'operators': operators,
        'work_items': sorted(
            [_work_item_for_step(step, tablet) for step in visible_steps],
            key=lambda item: (0 if item.get('is_pinned') else 1, item.get('priority') or 0, item.get('work_order_number') or ''),
        ),
        'slots': [_serialize_session_for_tablet(session) for session in active_sessions],
        'active_window': _serialize_window_for_tablet(
            ProductionCountingWindow.objects.filter(
                organization=tablet.organization,
                tablet=tablet,
                status='open',
            ).select_related('line', 'step').prefetch_related('participants__user', 'participants__session').first()
        ),
        'alerts': [
            {
                'id': alert.id,
                'title': alert.title,
                'message': alert.message,
                'severity': alert.severity,
                'requires_ack': alert.requires_ack,
                'created_at': alert.created_at,
            }
            for alert in alerts
        ],
    }


@transaction.atomic
def tablet_login_slot(*, token, user_id, pin, line_id=None, slot_index, start_counter=None, note='', checkpoint_total=None, participant_totals=None):
    tablet = _tablet_by_token(token)
    _assert_tablet_shift_open(tablet)
    user = _operator_from_pin(organization=tablet.organization, station=tablet.station, user_id=user_id, pin=pin)
    if line_id:
        line, station, step = _step_for_session_action(tablet.organization, line_id, tablet.station.code)
    else:
        line, station, step = None, tablet.station, None
    active_before = _active_tablet_sessions(tablet, step=step)
    closed_win = None
    if active_before:
        totals = _require_checkpoint_payload(active_before, checkpoint_total=checkpoint_total, participant_totals=participant_totals)
        closed_win = _close_counting_window(tablet=tablet, step=step, declared_totals=totals, reason='login', note=note)
    session = start_work_session(
        organization=tablet.organization,
        user=user,
        line_id=line_id,
        station_code=tablet.station.code,
        start_counter=start_counter,
        note=note,
        tablet=tablet,
        slot_index=slot_index,
    )
    active_after = _active_tablet_sessions(tablet, step=step)
    start_total = closed_win.close_total if closed_win else Decimal('0')
    _open_window_for_tablet(tablet, step, start_total=start_total, sessions=[item for item in active_after if item.status == 'started'], note=note)
    return session


@transaction.atomic
def tablet_logout_slot(*, token, user_id, pin, session_id, declared_good_quantity, end_counter=None, note=''):
    tablet = _tablet_by_token(token)
    _assert_tablet_shift_open(tablet)
    user = _operator_from_pin(organization=tablet.organization, station=tablet.station, user_id=user_id, pin=pin)
    session = ProductionWorkSession.objects.select_for_update().filter(pk=session_id, organization=tablet.organization, tablet=tablet).first()
    if not session:
        raise ProductionError('Tablet oturumu bulunamadı.')
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi tablet oturumunuzu kapatabilirsiniz.')
    active = _active_tablet_sessions(tablet, step=session.step)
    totals = _require_checkpoint_payload(active, checkpoint_total=declared_good_quantity)
    closed_win = _close_counting_window(tablet=tablet, step=session.step, declared_totals=totals, reason='logout', note=note)
    if session.status not in ACTIVE_SESSION_STATUSES:
        raise ProductionError('Yalniz acik oturum kapatilabilir.')
    session.status = 'closed'
    session.ended_at = timezone.now()
    session.end_counter = end_counter
    session.note = note or session.note
    _close_active_break(session, note)
    session.save(update_fields=['status', 'ended_at', 'end_counter', 'note', 'updated_at'])
    event = _create_session_event(session=session, event_type='complete', quantity_delta=0, counter_value=end_counter, note=note)
    remaining = [item for item in _active_tablet_sessions(tablet, step=session.step) if item.status == 'started']
    if remaining:
        start_total = closed_win.close_total if closed_win else Decimal('0')
        _open_window_for_tablet(tablet, session.step, start_total=start_total, sessions=remaining, note=note)
    return event


@transaction.atomic
def tablet_pause_session(*, token, session_id, note='', checkpoint_total=None, participant_totals=None):
    tablet = _tablet_by_token(token)
    _assert_tablet_shift_open(tablet)
    session = ProductionWorkSession.objects.filter(pk=session_id, organization=tablet.organization, tablet=tablet).select_related('user').first()
    if not session:
        raise ProductionError('Tablet oturumu bulunamadı.')
    active = _active_tablet_sessions(tablet, step=session.step)
    totals = _require_checkpoint_payload(active, checkpoint_total=checkpoint_total, participant_totals=participant_totals)
    closed_win = _close_counting_window(tablet=tablet, step=session.step, declared_totals=totals, reason='break_start', note=note)
    event = pause_work_session(organization=tablet.organization, user=session.user, session_id=session_id, note=note)
    remaining = [item for item in _active_tablet_sessions(tablet, step=session.step) if item.status == 'started']
    if remaining:
        start_total = closed_win.close_total if closed_win else Decimal('0')
        _open_window_for_tablet(tablet, session.step, start_total=start_total, sessions=remaining, note=note)
    return event


@transaction.atomic
def tablet_resume_session(*, token, session_id, note='', checkpoint_total=None, participant_totals=None):
    tablet = _tablet_by_token(token)
    _assert_tablet_shift_open(tablet)
    session = ProductionWorkSession.objects.filter(pk=session_id, organization=tablet.organization, tablet=tablet).select_related('user').first()
    if not session:
        raise ProductionError('Tablet oturumu bulunamadı.')
    active = [item for item in _active_tablet_sessions(tablet, step=session.step) if item.status == 'started']
    closed_win = None
    if active:
        totals = _require_checkpoint_payload(active, checkpoint_total=checkpoint_total, participant_totals=participant_totals)
        closed_win = _close_counting_window(tablet=tablet, step=session.step, declared_totals=totals, reason='break_end', note=note)
    event = resume_work_session(organization=tablet.organization, user=session.user, session_id=session_id, note=note)
    start_total = closed_win.close_total if closed_win else None
    if start_total is None or start_total == '':
        latest = ProductionCountingWindow.objects.filter(organization=tablet.organization, tablet=tablet, step=session.step, status='closed').order_by('-closed_at', '-id').first()
        start_total = latest.close_total if latest and latest.close_total is not None else Decimal('0')
    _open_window_for_current_sessions(tablet, session.step, start_total=start_total, note=note)
    return event


@transaction.atomic
def tablet_checkpoint(*, token, line_id, checkpoint_total=None, participant_totals=None, reason='manual', note=''):
    tablet = _tablet_by_token(token)
    _assert_tablet_shift_open(tablet)
    line, station, step = _step_for_session_action(tablet.organization, line_id, tablet.station.code)
    active = _active_tablet_sessions(tablet, step=step)
    totals = _require_checkpoint_payload(active, checkpoint_total=checkpoint_total, participant_totals=participant_totals)
    window = _close_counting_window(tablet=tablet, step=step, declared_totals=totals, reason=reason, note=note)
    started = [item for item in _active_tablet_sessions(tablet, step=step) if item.status == 'started']
    if started:
        close_total = window.close_total if window and window.close_total is not None else checkpoint_total
        _open_window_for_tablet(tablet, step, start_total=close_total, sessions=started, note=note)
    return window


@transaction.atomic
def tablet_complete_work_item(*, token, line_id, checkpoint_total=None, participant_totals=None, note=''):
    tablet = _tablet_by_token(token)
    _assert_tablet_shift_open(tablet)
    line, station, step = _step_for_session_action(tablet.organization, line_id, tablet.station.code)
    active = _active_tablet_sessions(tablet, step=step)
    if active:
        totals = _require_checkpoint_payload(active, checkpoint_total=checkpoint_total, participant_totals=participant_totals)
        _close_counting_window(tablet=tablet, step=step, declared_totals=totals, reason='work_complete', note=note)
    step = ProductionStepProgress.objects.select_for_update().get(pk=step.pk)
    step.status = 'completed'
    step.completed_at = timezone.now()
    step.completed_by = None
    step.save(update_fields=['status', 'completed_at', 'completed_by'])
    nxt = _next_step(step)
    if nxt and nxt.status == 'locked':
        nxt.status = 'ready'
        nxt.save(update_fields=['status'])
    _refresh_line_and_order(line)
    return step


@transaction.atomic
def tablet_shift_checkpoint(*, token, line_id=None, checkpoint_total=None, participant_totals=None, note=''):
    tablet = _tablet_by_token(token)
    shift = _tablet_shift_payload(tablet)
    if shift['state'] != 'checkpoint_required':
        raise ProductionError('Bu tablet için zorunlu vardiya checkpoint yok.')
    active_window = (
        ProductionCountingWindow.objects.select_for_update()
        .filter(organization=tablet.organization, tablet=tablet, status='open')
        .first()
    )
    if not active_window:
        raise ProductionError('Kapatılacak açık üretim penceresi yok.')
    if line_id and active_window.line_id and int(line_id) != active_window.line_id:
        raise ProductionError('Checkpoint aktif iş emriyle eşleşmiyor.')
    active = _active_tablet_sessions(tablet, step=active_window.step)
    totals = _require_checkpoint_payload(active, checkpoint_total=checkpoint_total, participant_totals=participant_totals)
    reason = 'scheduled_break' if shift.get('active_break') else 'shift_end'
    window = _close_counting_window(tablet=tablet, step=active_window.step, declared_totals=totals, reason=reason, note=note)
    checkpoint = ProductionShiftCheckpoint.objects.create(
        organization=tablet.organization,
        occurrence_id=(shift.get('active_shift') or {}).get('id'),
        break_row_id=(shift.get('active_break') or {}).get('id'),
        window=window,
        station=tablet.station,
        tablet=tablet,
        reason=reason,
        participant_totals={str(key): str(value) for key, value in totals.items()},
        official_delta=window.official_delta if window else Decimal('0'),
        note=note or '',
    )
    now = timezone.now()
    if reason == 'scheduled_break':
        for session in active:
            if session.status == 'started':
                session.status = 'paused'
                session.save(update_fields=['status', 'updated_at'])
                _open_break(session, note or 'Planlı mola')
    else:
        for session in active:
            session.status = 'closed'
            session.ended_at = now
            session.note = note or session.note
            _close_active_break(session, note)
            session.save(update_fields=['status', 'ended_at', 'note', 'updated_at'])
            _create_session_event(session=session, event_type='complete', quantity_delta=0, note=note or 'Vardiya sonu')
    return checkpoint


def send_station_alert(*, organization, user, target_type, title, message, severity='info', station=None, department=None, work_order=None, expires_at=None):
    alert = ProductionStationAlert.objects.create(
        organization=organization,
        target_type=target_type,
        station=station,
        department=department,
        work_order=work_order,
        title=title,
        message=message,
        severity=severity or 'info',
        created_by=user,
        expires_at=expires_at,
    )
    push_event({
        'type': 'production.station_alert',
        'alert_id': alert.id,
        'target_type': alert.target_type,
        'station_id': station.id if station else None,
        'station_code': station.code if station else '',
        'department_id': department.id if department else None,
        'work_order_id': work_order.id if work_order else None,
        'title': alert.title,
        'message': alert.message,
        'severity': alert.severity,
    })
    return alert


def ack_station_alert(*, organization, alert_id, token='', user=None):
    tablet = _tablet_by_token(token) if token else None
    alert = ProductionStationAlert.objects.get(pk=alert_id, organization=organization)
    ack, _ = ProductionStationAlertAck.objects.get_or_create(
        organization=organization,
        alert=alert,
        tablet=tablet,
        user=user,
    )
    return ack


def _refresh_line_and_order(line):
    final_step = line.steps.filter(station__is_final=True).order_by('-order').first()
    if final_step and final_step.status == 'completed':
        line.completed_quantity = final_step.completed_quantity
        line.save(update_fields=['completed_quantity'])
        complete_line_to_stock(line)
    order = line.work_order
    all_lines = order.lines.all()
    if all_lines.exists() and all(item.completed_quantity >= item.quantity for item in all_lines):
        order.status = 'completed'
    elif order.lines.filter(steps__status='in_progress').exists():
        order.status = 'in_progress'
    else:
        order.status = 'waiting'
    order.save(update_fields=['status', 'updated_at'])


@transaction.atomic
def record_station_event(*, organization, line_id, station_code, event_type, quantity_delta=0, counter_value=None, user=None,
                         note='', idempotency_key='', source='ui', device=None, raw_payload=None, normalized_payload=None,
                         mapping_errors=None):
    if idempotency_key:
        existing = ProductionEvent.objects.filter(organization=organization, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    line = (
        ProductionWorkOrderLine.objects.select_for_update()
        .select_related('work_order')
        .get(pk=line_id, work_order__organization=organization)
    )
    station = ProductionStation.objects.get(organization=organization, code=station_code, is_active=True)
    step = (
        ProductionStepProgress.objects.select_for_update()
        .select_related('station', 'line__work_order')
        .get(line=line, station=station)
    )
    context = apply_rule_blocks({
        'organization': organization,
        'line': line,
        'station': station,
        'route': line.route or line.work_order.route,
        'step': step,
        'event_type': event_type,
        'quantity_delta': quantity_delta,
        'counter_value': counter_value,
        'normalized_payload': dict(normalized_payload or {}),
        'trigger_event': 'pi_event' if source == 'pi' else 'ui_event',
        'post_actions': [],
    })
    event_type = context.get('event_type') or event_type
    quantity_delta = context.get('quantity_delta', quantity_delta)
    normalized_payload = context.get('normalized_payload', normalized_payload or {})
    if source == 'pi' and event_type in ('complete', 'handover'):
        raise ProductionError('Makine verisi istasyonu kapatamaz; bitirme/devir operator tarafindan yapilmalidir.')
    if source == 'pi' and event_type == 'quantity' and step.status != 'in_progress':
        raise ProductionError('Makine verisi islenmeden once operator istasyonu baslatmalidir.')
    if step.status == 'locked':
        raise ProductionError('Bu istasyon henuz acik degil.')
    if step.status in ('completed', 'skipped') and event_type not in ('adjust',):
        raise ProductionError('Tamamlanan istasyonda yeni islem yapilamaz.')

    qty = _decimal(quantity_delta)
    if event_type == 'start':
        if _active_worker_count(station) >= station.max_workers:
            raise ProductionError(f'{station.code} kapasitesi dolu.')
        if step.status == 'ready':
            step.status = 'in_progress'
            step.started_at = timezone.now()
            step.save(update_fields=['status', 'started_at'])
    elif event_type == 'quantity':
        if qty <= 0:
            raise ProductionError('Adet girisi sifirdan buyuk olmalidir.')
        step.completed_quantity = min(step.target_quantity, step.completed_quantity + qty)
        if step.completed_quantity >= step.target_quantity:
            if source == 'pi':
                step.status = 'waiting_handover'
                step.completed_at = None
                step.completed_by = None
            else:
                step.status = 'completed'
                step.completed_at = timezone.now()
                step.completed_by = user
        elif step.status == 'ready':
            step.status = 'in_progress'
            step.started_at = step.started_at or timezone.now()
        step.save(update_fields=['completed_quantity', 'status', 'started_at', 'completed_at', 'completed_by'])
    elif event_type in ('complete', 'handover'):
        if step.completed_quantity < step.target_quantity and not _norm(note):
            raise ProductionError('Hedef altinda bitirmek icin aciklama zorunludur.')
        if step.completed_quantity <= 0:
            step.completed_quantity = step.target_quantity
        step.status = 'completed'
        step.completed_at = timezone.now()
        step.completed_by = user
        step.save(update_fields=['completed_quantity', 'status', 'completed_at', 'completed_by'])
    elif event_type in ('pause', 'resume'):
        pass
    elif event_type == 'adjust':
        step.completed_quantity = qty
        if step.completed_quantity >= step.target_quantity:
            step.status = 'completed'
            step.completed_at = timezone.now()
            step.completed_by = user
        elif step.status == 'completed':
            step.status = 'in_progress'
            step.completed_at = None
            step.completed_by = None
        step.save(update_fields=['completed_quantity', 'status', 'completed_at', 'completed_by'])
    elif event_type == 'cancel':
        step.status = 'skipped'
        step.save(update_fields=['status'])
    else:
        raise ProductionError('Gecersiz islem tipi.')

    event = ProductionEvent.objects.create(
        organization=organization,
        work_order=line.work_order,
        line=line,
        step=step,
        station=station,
        event_type=event_type,
        quantity_delta=qty,
        counter_value=counter_value,
        note=note,
        idempotency_key=idempotency_key or '',
        source=source,
        device=device,
        user=user,
        raw_payload=raw_payload or {},
        normalized_payload=normalized_payload or {},
        mapping_errors=mapping_errors or [],
    )

    if step.status == 'completed':
        nxt = _next_step(step)
        if nxt and nxt.status == 'locked':
            nxt.status = 'ready'
            nxt.save(update_fields=['status'])
    if 'open_next_step' in context.get('post_actions', []):
        nxt = _next_step(step)
        if nxt and nxt.status == 'locked':
            nxt.status = 'ready'
            nxt.save(update_fields=['status'])
    if 'stock_in' in context.get('post_actions', []):
        complete_line_to_stock(line)
    _refresh_line_and_order(line)
    return event


@transaction.atomic
def complete_line_to_stock(line):
    line = ProductionWorkOrderLine.objects.select_for_update().select_related('work_order').get(pk=line.pk)
    if line.stock_in_done or not line.product_id:
        return None
    settings_row, _ = ProductionSettings.objects.get_or_create(organization=line.work_order.organization)
    if not settings_row.auto_stock_in_enabled:
        return None
    location = settings_row.default_completion_location
    if not location_id_safe(location, line.work_order.organization):
        return None
    movement = stock_in(
        organization=line.work_order.organization,
        product=line.product,
        location=location,
        quantity=line.completed_quantity or line.quantity,
        user=None,
        reference=line.work_order.number,
        note='Uretim tamamlandi, mamul stok girisi.',
        source_type='production_work_order',
        source_id=str(line.work_order_id),
        detail_1_override=line.detail_1,
        detail_2_override=line.detail_2,
    )
    line.stock_in_done = True
    line.stock_in_movement_id = movement.id
    line.save(update_fields=['stock_in_done', 'stock_in_movement_id'])
    return movement


def location_id_safe(location, organization) -> bool:
    return bool(location and location.organization_id == organization.id and location.is_active and location.warehouse.is_active)


def dashboard_summary(organization):
    today = timezone.localdate()
    return {
        'departments': ProductionDepartment.objects.filter(organization=organization, is_active=True).count(),
        'stations': ProductionStation.objects.filter(organization=organization, is_active=True).count(),
        'active_orders': ProductionWorkOrder.objects.filter(organization=organization, status__in=['waiting', 'in_progress']).count(),
        'completed_today': float(
            ProductionWorkSession.objects.filter(organization=organization, status='closed', ended_at__date=today)
            .aggregate(total=Sum('declared_good_quantity'))['total']
            or Decimal('0')
        ),
        'station_load': list(
            ProductionStepProgress.objects.filter(line__work_order__organization=organization, status__in=['ready', 'in_progress'])
            .values('station__code', 'station__name', 'station__department__name')
            .annotate(total_target=Sum('target_quantity'), total_done=Sum('completed_quantity'))
            .order_by('station__department__order', 'station__order')
        ),
    }


def make_device_token():
    return uuid4().hex + uuid4().hex
