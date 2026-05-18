import re
import unicodedata
from decimal import Decimal, InvalidOperation


DEFAULT_PRICE_LIST_KEY = 'list_1'
DEFAULT_PRICE_LIST_LABEL = '2026/1. LİSTE'
SECONDARY_PRICE_LIST_KEY = 'list_2'
SECONDARY_PRICE_LIST_LABEL = '2026/2. LİSTE'


def _normalize_key(value, fallback):
    raw = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode('ascii')
    normalized = re.sub(r'[^A-Za-z0-9]+', '_', raw).strip('_').lower()
    return (normalized or fallback)[:64]


def default_price_lists(fallback_label=None):
    primary_label = str(fallback_label or DEFAULT_PRICE_LIST_LABEL).strip() or DEFAULT_PRICE_LIST_LABEL
    return [
        {'key': DEFAULT_PRICE_LIST_KEY, 'label': primary_label, 'is_default': True},
        {'key': SECONDARY_PRICE_LIST_KEY, 'label': SECONDARY_PRICE_LIST_LABEL, 'is_default': False},
    ]


def normalize_price_lists(value, fallback_label=None):
    source = value if isinstance(value, list) and value else default_price_lists(fallback_label)
    normalized = []
    seen = set()

    for index, item in enumerate(source):
        if isinstance(item, str):
            item = {'label': item}
        if not isinstance(item, dict):
            continue

        label = str(item.get('label') or item.get('name') or '').strip()
        if not label:
            continue

        fallback_key = f'list_{index + 1}'
        key = _normalize_key(item.get('key') or item.get('id') or label, fallback_key)
        base_key = key
        suffix = 2
        while key in seen:
            key = f'{base_key}_{suffix}'[:64]
            suffix += 1

        seen.add(key)
        normalized.append(
            {
                'key': key,
                'label': label[:120],
                'is_default': bool(item.get('is_default') or item.get('default')),
            }
        )

    if not normalized:
        normalized = default_price_lists(fallback_label)

    if not any(item.get('is_default') for item in normalized):
        normalized[0]['is_default'] = True

    default_seen = False
    for item in normalized:
        if item.get('is_default') and not default_seen:
            default_seen = True
            continue
        item['is_default'] = False

    return normalized


def get_default_price_list(price_lists):
    normalized = normalize_price_lists(price_lists)
    return next((item for item in normalized if item.get('is_default')), normalized[0])


def get_price_list_by_key(price_lists, key=None):
    normalized = normalize_price_lists(price_lists)
    selected_key = str(key or '').strip()
    if selected_key:
        match = next((item for item in normalized if item.get('key') == selected_key), None)
        if match:
            return match
    return get_default_price_list(normalized)


def get_org_price_lists(organization):
    if not organization:
        return default_price_lists()
    from .models import OrganizationSettings

    try:
        settings_row = OrganizationSettings.objects.get(organization=organization)
    except OrganizationSettings.DoesNotExist:
        return default_price_lists()
    return normalize_price_lists(getattr(settings_row, 'price_lists', None), settings_row.price_list_label)


def get_org_price_list_label(organization, key=None):
    return get_price_list_by_key(get_org_price_lists(organization), key).get('label') or DEFAULT_PRICE_LIST_LABEL


def get_org_default_price_list(organization):
    return get_default_price_list(get_org_price_lists(organization))


def normalize_product_price_lists(value, base_price=0):
    source = value if isinstance(value, dict) else {}
    normalized = {}
    for key, price in source.items():
        normalized_key = _normalize_key(key, '')
        if not normalized_key:
            continue
        try:
            decimal_price = Decimal(str(price if price not in [None, ''] else 0))
        except (InvalidOperation, TypeError, ValueError):
            decimal_price = Decimal('0')
        normalized[normalized_key] = str(decimal_price.quantize(Decimal('0.01')))

    if DEFAULT_PRICE_LIST_KEY not in normalized:
        try:
            decimal_price = Decimal(str(base_price if base_price not in [None, ''] else 0))
        except (InvalidOperation, TypeError, ValueError):
            decimal_price = Decimal('0')
        normalized[DEFAULT_PRICE_LIST_KEY] = str(decimal_price.quantize(Decimal('0.01')))

    return normalized


def get_product_price_for_list(product, price_list_key=None):
    price_lists = normalize_product_price_lists(getattr(product, 'price_lists', None), getattr(product, 'price', 0))
    selected_key = str(price_list_key or '').strip()
    price = price_lists.get(selected_key) if selected_key else None
    if price in [None, '']:
        price = price_lists.get(DEFAULT_PRICE_LIST_KEY, getattr(product, 'price', 0))
    try:
        return Decimal(str(price))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(str(getattr(product, 'price', 0) or 0))
