DEFAULT_PAYMENT_OPTIONS = [
    '%100 Nakit',
    '%50 peşin / %50 teslimde',
    '%30 peşin / %70 sevkiyat öncesi',
    '%20 nakit / %80 çek 90 gün',
    'Kredi kartı tek çekim',
    'Kredi kartı 3 taksit',
    'Kredi kartı 6 taksit',
    'Barter',
]


def normalize_payment_options(value):
    source = value if isinstance(value, list) and value else DEFAULT_PAYMENT_OPTIONS
    normalized = []
    seen = set()

    for item in source:
        label = str(item.get('label') if isinstance(item, dict) else item or '').strip()
        if not label:
            continue
        key = label.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(label[:160])

    return normalized or list(DEFAULT_PAYMENT_OPTIONS)
