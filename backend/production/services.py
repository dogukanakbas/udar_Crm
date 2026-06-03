from __future__ import annotations

import hashlib
import json
import unicodedata
from copy import deepcopy
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from django.db import IntegrityError, models, transaction
from django.db.models import Max, Sum
from django.utils import timezone

from erp.inventory_service import InventoryError, stock_in
from erp.models import InventoryLocation, Product

from .models import (
    ProductionDataField,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionEvent,
    ProductionRuleSet,
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionSettings,
    ProductionStation,
    ProductionStationUser,
    ProductionStepProgress,
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
        rows.append(
            ProductionStepProgress(
                line=line,
                route_step=route_step,
                station=route_step.station,
                order=route_step.order,
                target_quantity=line.quantity,
                status='ready' if step_idx == 0 else 'locked',
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


@transaction.atomic
def start_work_session(*, organization, user, line_id, station_code, start_counter=None, note='', allow_unassigned=False):
    line, station, step = _step_for_session_action(organization, line_id, station_code)
    if not allow_unassigned and not _is_station_user(organization, user, station):
        raise ProductionError('Bu istasyonda işlem yapmaya atanmış kullanıcı değilsiniz.')
    if step.status == 'locked':
        raise ProductionError('Bu istasyon henuz acik degil.')
    if step.status in ('completed', 'skipped'):
        raise ProductionError('Tamamlanan istasyonda yeni oturum acilamaz.')
    active = _active_session_for_step(step)
    if active:
        if active.user_id == user.id:
            return active
        raise ProductionError(f'Bu istasyonda {active.user.get_full_name() or active.user.username} için aktif oturum var.')
    previous = _latest_handover_session(step)
    session = ProductionWorkSession.objects.create(
        organization=organization,
        work_order=line.work_order,
        line=line,
        step=step,
        station=station,
        user=user,
        previous_session=previous,
        start_counter=start_counter,
        note=note or '',
    )
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
    session = ProductionWorkSession.objects.select_for_update().select_related('step').get(pk=session_id, organization=organization)
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu molaya alabilirsiniz.')
    if session.status != 'started':
        raise ProductionError('Yalniz aktif oturum molaya alinabilir.')
    session.status = 'paused'
    session.note = note or session.note
    session.save(update_fields=['status', 'note', 'updated_at'])
    return _create_session_event(session=session, event_type='pause', note=note)


@transaction.atomic
def resume_work_session(*, organization, user, session_id, note=''):
    session = ProductionWorkSession.objects.select_for_update().select_related('step').get(pk=session_id, organization=organization)
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu devam ettirebilirsiniz.')
    if session.status != 'paused':
        raise ProductionError('Yalniz moladaki oturum devam ettirilebilir.')
    session.status = 'started'
    session.note = note or session.note
    session.save(update_fields=['status', 'note', 'updated_at'])
    return _create_session_event(session=session, event_type='resume', note=note)


@transaction.atomic
def handover_work_session(*, organization, user, session_id, note=''):
    session = ProductionWorkSession.objects.select_for_update().select_related('step').get(pk=session_id, organization=organization)
    if session.user_id != user.id:
        raise ProductionError('Yalnızca kendi oturumunuzu devredebilirsiniz.')
    if session.status not in ACTIVE_SESSION_STATUSES:
        raise ProductionError('Yalniz acik oturum devredilebilir.')
    session.status = 'handover'
    session.ended_at = timezone.now()
    session.note = note or session.note
    session.save(update_fields=['status', 'ended_at', 'note', 'updated_at'])
    step = session.step
    if step.status == 'in_progress':
        step.status = 'waiting_handover'
        step.save(update_fields=['status'])
    return _create_session_event(session=session, event_type='handover', note=note)


@transaction.atomic
def close_work_session(*, organization, user, session_id, declared_good_quantity, end_counter=None, note=''):
    session = (
        ProductionWorkSession.objects.select_for_update()
        .select_related('step', 'line__work_order')
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
    _refresh_line_and_order(session.line)
    return event


@transaction.atomic
def review_session_discrepancy(*, organization, user, session_id, action, corrected_good_quantity=None, note=''):
    session = (
        ProductionWorkSession.objects.select_for_update()
        .select_related('step', 'line')
        .get(pk=session_id, organization=organization)
    )
    if session.discrepancy_status != 'needs_review':
        raise ProductionError('Bu oturumda incelenecek fark yok.')
    if action == 'corrected':
        if corrected_good_quantity is None:
            raise ProductionError('Duzeltme icin saglam adet zorunludur.')
        corrected = _decimal(corrected_good_quantity, 'Duzeltilmis saglam adet')
        delta = corrected - session.declared_good_quantity
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
    active = _active_session_for_step(step)
    if not active:
        return _create_unmatched_machine_event(
            organization=organization,
            line=line,
            step=step,
            station=station,
            quantity_delta=qty,
            counter_value=counter_value,
            note=note,
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
