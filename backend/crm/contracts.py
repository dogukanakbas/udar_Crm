from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from openpyxl import load_workbook

XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

DEFAULT_TERMS = [
    '1- Alıcı özellikleri belirtilen ürünlerin satın alma şartlarını kabul eder.',
    '2- Satıcı onaylanan kalemlerin üretimini ve sevkini kabul eder.',
    '3- Onay sonrası teknik ve finansal değişiklikler yeni mutabakat gerektirir.',
    '4- Ödemesi tamamlanmayan siparişler üretime alınmayabilir.',
    '5- Mücbir sebepler kaynaklı gecikmelerde satıcı sorumlu tutulamaz.',
    '6- Teslimden sonra yazılı bildirim gelmezse ürünler eksiksiz kabul edilir.',
    '7- Alıcı gerekli vergi ve yetki belgelerini eksiksiz sunar.',
    '8- İmalat hataları garanti koşulları ve teknik şartname kapsamındadır.',
    '9- İhtilaflarda Malatya Mahkemeleri ve İcra Daireleri yetkilidir.',
]
DEFAULT_TERMS_TEXT = '\n'.join(DEFAULT_TERMS)
DEFAULT_GENERAL_TERMS = DEFAULT_TERMS
DEFAULT_CONTRACT_NOTES = [
    'Ölçüler net ölçü üzerinden değerlendirilmiştir.',
    'Üretim öncesi teyit alınacaktır.',
]
DEFAULT_CONTRACT_NOTES_TEXT = '\n'.join(DEFAULT_CONTRACT_NOTES)

SECTION_FAMILY_MAP = {
    'steel_door': 'steel',
    'interior_door': 'interior',
    'kitchen': 'furniture',
    'wardrobe': 'furniture',
    'bathroom': 'furniture',
    'accessory': 'furniture',
    'laminate': 'furniture',
    'service': 'service',
}

DEFAULT_SELLER_PROFILES = [
    {
        'key': 'ORTKA',
        'display_name': 'ORTKA YAPI ELEMANLARI ÜRETİM SAN. LTD. ŞTİ.',
        'tax_office': 'BEYDAĞI',
        'tax_number': '6480365207',
        'address': '2. OSB 6. CADDE NO:6 YEŞİLYURT / MALATYA',
        'phone': '444 0 932',
        'email': 'muhasebe@aykakapi.com.tr',
        'bank_accounts': [
            {'bank': 'Türkiye İş Bankası', 'iban': 'TR24 0006 4000 0018 6003 9367 45'},
            {'bank': 'Ziraat Bankası', 'iban': 'TR07 0001 0021 6935 0399 4450 09'},
            {'bank': 'Albaraka Türk K.Bank.', 'iban': 'TR66 0020 3000 0056 3735 0000 02'},
            {'bank': 'Vakıflar Bankası', 'iban': 'TR57 0001 5001 5800 7284 2692 06'},
        ],
    },
    {
        'key': 'AYKA',
        'display_name': 'AYKA KAPI SANAYİ TİCARET ANONİM ŞİRKETİ',
        'tax_office': 'BEYDAĞI',
        'tax_number': '1210461108',
        'address': '2. OSB 6. CADDE NO:6 YEŞİLYURT / MALATYA',
        'phone': '444 0 932',
        'email': 'muhasebe@aykakapi.com.tr',
        'bank_accounts': [
            {'bank': 'Garanti BBVA Bankası', 'iban': 'TR14 0006 2000 1120 0006 2913 29'},
            {'bank': 'Ziraat Bankası', 'iban': 'TR72 0001 0021 6994 2088 8850 01'},
            {'bank': 'Albaraka Türk K.Bank.', 'iban': 'TR25 0020 3000 0770 5276 0000 01'},
            {'bank': 'Vakıflar Bankası', 'iban': ''},
        ],
    },
]

ASSETS_DIR = Path(__file__).resolve().parent / 'assets'


def _asset_path(filename: str) -> Path:
    for root in (ASSETS_DIR / 'quote-templates', ASSETS_DIR / 'contract-templates', ASSETS_DIR):
        matches = list(root.rglob(filename))
        if matches:
            return matches[0]
    raise FileNotFoundError(filename)


TEMPLATE_REGISTRY = [
    {
        'document_type': 'Quote',
        'template_key': 'quote_steel',
        'family': 'steel',
        'source_path': _asset_path('CELIK_KAPI_TEKLIF_SABLONU_V12.xltx'),
        'supported_section_keys': ['steel_door'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [{'section_keys': ['steel_door'], 'start_row': 38, 'capacity': 5, 'subtotal_row': 43, 'tax_row': 44, 'grand_row': 45}],
        'commercial_rows': [61, 62, 63, 64, 65, 66, 67],
        'terms_rows': [71, 72, 73, 74, 75],
        'bank_header_row': 79,
        'bank_rows': [80, 81, 82, 83],
        'signature_row': 85,
    },
    {
        'document_type': 'Quote',
        'template_key': 'quote_interior',
        'family': 'interior',
        'source_path': _asset_path('IC_ODA_TEKLIF_SABLONU_V12.xltx'),
        'supported_section_keys': ['interior_door'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [{'section_keys': ['interior_door'], 'start_row': 38, 'capacity': 7, 'subtotal_row': 45, 'tax_row': 46, 'grand_row': 47}],
        'commercial_rows': [61, 62, 63, 64, 65, 66, 67],
        'terms_rows': [71, 72, 73, 74, 75],
        'bank_header_row': 79,
        'bank_rows': [80, 81, 82, 83],
        'signature_row': 85,
    },
    {
        'document_type': 'Quote',
        'template_key': 'quote_furniture',
        'family': 'furniture',
        'source_path': _asset_path('MOBILYA_TEKLIF_SABLONU_V12.xltx'),
        'supported_section_keys': ['kitchen', 'wardrobe', 'bathroom', 'accessory', 'laminate'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [
            {'section_keys': ['kitchen'], 'start_row': 38, 'capacity': 3, 'subtotal_row': 41, 'tax_row': 42, 'grand_row': 43},
            {'section_keys': ['wardrobe'], 'start_row': 59, 'capacity': 3, 'subtotal_row': 62, 'tax_row': 63, 'grand_row': 64},
            {'section_keys': ['bathroom', 'accessory', 'laminate'], 'start_row': 71, 'capacity': 3, 'subtotal_row': 74, 'tax_row': 75, 'grand_row': 76},
        ],
        'commercial_rows': [82, 83, 84, 85, 86, 87, 88],
        'terms_rows': [92, 93, 94, 95, 96],
        'bank_header_row': 100,
        'bank_rows': [101, 102, 103, 104],
        'signature_row': 106,
    },
    {
        'document_type': 'Quote',
        'template_key': 'quote_service',
        'family': 'service',
        'source_path': _asset_path('MONTAJ_TEKLIF_SABLONU_V12.xltx'),
        'supported_section_keys': ['service'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [{'section_keys': ['service'], 'start_row': 38, 'capacity': 9, 'subtotal_row': 47, 'tax_row': 48, 'grand_row': 49}],
        'commercial_rows': [63, 64, 65, 66, 67, 68, 69],
        'terms_rows': [73, 74, 75, 76, 77],
        'bank_header_row': 81,
        'bank_rows': [82, 83, 84, 85],
        'signature_row': 87,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_steel',
        'family': 'steel',
        'source_path': _asset_path('CELIK_KAPI_SOZLESME_SABLONU_V1.xltx'),
        'supported_section_keys': ['steel_door'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [{'section_keys': ['steel_door'], 'start_row': 38, 'capacity': 5, 'subtotal_row': 43, 'tax_row': 44, 'grand_row': 45}],
        'commercial_rows': [59, 60, 61, 62, 63, 64, 65],
        'terms_rows': [69, 70, 71, 72, 73, 74, 75, 76, 77],
        'bank_header_row': 80,
        'bank_rows': [81, 82, 83, 84],
        'signature_row': 86,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_interior',
        'family': 'interior',
        'source_path': _asset_path('IC_KAPI_SOZLESME_SABLONU_V11.xltx'),
        'supported_section_keys': ['interior_door'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [{'section_keys': ['interior_door'], 'start_row': 38, 'capacity': 7, 'subtotal_row': 45, 'tax_row': 46, 'grand_row': 47}],
        'commercial_rows': [61, 62, 63, 64, 65, 66, 67],
        'terms_rows': [71, 72, 73, 74, 75, 76, 77, 78, 79],
        'bank_header_row': 82,
        'bank_rows': [83, 84, 85, 86],
        'signature_row': 88,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_furniture',
        'family': 'furniture',
        'source_path': _asset_path('MOBILYA_SOZLESME_SABLONU_V11.xltx'),
        'supported_section_keys': ['kitchen', 'wardrobe', 'bathroom', 'accessory', 'laminate'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [
            {'section_keys': ['kitchen'], 'start_row': 38, 'capacity': 3, 'subtotal_row': 41, 'tax_row': 42, 'grand_row': 43},
            {'section_keys': ['wardrobe'], 'start_row': 56, 'capacity': 3, 'subtotal_row': 59, 'tax_row': 60, 'grand_row': 61},
            {'section_keys': ['bathroom', 'accessory', 'laminate'], 'start_row': 68, 'capacity': 3, 'subtotal_row': 71, 'tax_row': 72, 'grand_row': 73},
        ],
        'commercial_rows': [79, 80, 81, 82, 83, 84, 85],
        'terms_rows': [89, 90, 91, 92, 93, 94, 95, 96, 97],
        'bank_header_row': 102,
        'bank_rows': [103, 104, 105, 106],
        'signature_row': 108,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_service',
        'family': 'service',
        'source_path': _asset_path('MONTAJ_SOZLESME_SABLONU_V11.xltx'),
        'supported_section_keys': ['service'],
        'is_combined': False,
        'selection_priority': 10,
        'line_blocks': [{'section_keys': ['service'], 'start_row': 38, 'capacity': 9, 'subtotal_row': 47, 'tax_row': 48, 'grand_row': 49}],
        'commercial_rows': [64, 65, 66, 67, 68, 69, 70],
        'terms_rows': [73, 74, 75, 76, 77, 78, 79, 80, 81],
        'bank_header_row': 84,
        'bank_rows': [85, 86, 87, 88],
        'signature_row': 90,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_ck_ik_mob_montajli',
        'family': 'bundle',
        'source_path': _asset_path('CK_IK_MOB_MONTAJLI_SOZLESME_SABLONU_V12.xltx'),
        'supported_section_keys': ['steel_door', 'interior_door', 'kitchen', 'wardrobe', 'bathroom', 'accessory', 'laminate', 'service'],
        'required_families': ['steel', 'interior', 'furniture', 'service'],
        'is_combined': True,
        'selection_priority': 100,
        'line_blocks': [
            {'section_keys': ['steel_door'], 'start_row': 38, 'capacity': 5, 'subtotal_row': 43, 'tax_row': 44, 'grand_row': 45},
            {'section_keys': ['interior_door'], 'start_row': 63, 'capacity': 7, 'subtotal_row': 70, 'tax_row': 71, 'grand_row': 72},
            {'section_keys': ['kitchen', 'wardrobe', 'bathroom', 'accessory', 'laminate'], 'start_row': 80, 'capacity': 9, 'subtotal_row': 88, 'tax_row': 89, 'grand_row': 90},
            {'section_keys': ['service'], 'start_row': 112, 'capacity': 9, 'subtotal_row': 121, 'tax_row': 122, 'grand_row': 123},
        ],
        'commercial_rows': [127, 128, 129, 130, 131, 132],
        'terms_rows': [136, 137, 138, 139, 140, 141, 142, 143, 144],
        'bank_header_row': 147,
        'bank_rows': [148, 149, 150, 151],
        'signature_row': 153,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_ck_ik_montajli',
        'family': 'bundle',
        'source_path': _asset_path('CK_IK_MONTAJLI_SOZLESME_SABLONU_V12.xltx'),
        'supported_section_keys': ['steel_door', 'interior_door', 'service'],
        'required_families': ['steel', 'interior', 'service'],
        'is_combined': True,
        'selection_priority': 90,
        'line_blocks': [
            {'section_keys': ['steel_door'], 'start_row': 38, 'capacity': 5, 'subtotal_row': 43, 'tax_row': 44, 'grand_row': 45},
            {'section_keys': ['interior_door'], 'start_row': 63, 'capacity': 7, 'subtotal_row': 70, 'tax_row': 71, 'grand_row': 72},
            {'section_keys': ['service'], 'start_row': 80, 'capacity': 9, 'subtotal_row': 89, 'tax_row': 90, 'grand_row': 91},
        ],
        'commercial_rows': [113, 114, 115, 116, 117, 118],
        'terms_rows': [122, 123, 124, 125, 126, 127, 128, 129, 130],
        'bank_header_row': 133,
        'bank_rows': [134, 135, 136, 137],
        'signature_row': 139,
    },
    {
        'document_type': 'Contract',
        'template_key': 'contract_ck_ik_montajsiz',
        'family': 'bundle',
        'source_path': _asset_path('CK_IK_MONTAJSIZ_SOZLESME_SABLONU_V12.xltx'),
        'supported_section_keys': ['steel_door', 'interior_door'],
        'required_families': ['steel', 'interior'],
        'is_combined': True,
        'selection_priority': 80,
        'line_blocks': [
            {'section_keys': ['steel_door'], 'start_row': 38, 'capacity': 5, 'subtotal_row': 43, 'tax_row': 44, 'grand_row': 45},
            {'section_keys': ['interior_door'], 'start_row': 63, 'capacity': 7, 'subtotal_row': 70, 'tax_row': 71, 'grand_row': 72},
        ],
        'commercial_rows': [78, 79, 80, 81, 82, 83],
        'terms_rows': [87, 88, 89, 90, 91, 92, 93, 94, 95],
        'bank_header_row': 98,
        'bank_rows': [99, 100, 101, 102],
        'signature_row': 104,
    },
]


def get_seller_profiles(organization):
    settings = getattr(organization, 'contract_settings', {}) or {}
    profiles = settings.get('seller_profiles')
    if isinstance(profiles, list) and profiles:
        return profiles
    return deepcopy(DEFAULT_SELLER_PROFILES)


def list_document_exports(quote):
    return [
        {
            'template_key': template['template_key'],
            'filename': f"{quote.number}-{template['template_key']}.xlsx",
        }
        for template in _select_templates(quote)
    ]


def build_document_export(quote, template_key: str | None = None):
    outputs = []
    for template in _select_templates(quote, template_key=template_key):
        workbook = load_workbook(template['source_path'])
        workbook.template = False
        worksheet = workbook['1'] if '1' in workbook.sheetnames else workbook[workbook.sheetnames[0]]
        _fill_shared_header(worksheet, quote)
        _fill_line_blocks(worksheet, quote, template)
        _fill_commercial_rows(worksheet, quote, template)
        _fill_terms(worksheet, quote, template)
        _fill_bank_accounts(worksheet, quote, template)
        _fill_signature_block(worksheet, quote, template)
        output = BytesIO()
        workbook.save(output)
        outputs.append((template, output.getvalue()))

    if not outputs:
        raise ValueError('No template output generated')
    if len(outputs) > 1:
        raise ValueError('Multiple templates selected; request a specific template_key')

    template, content = outputs[0]
    stream = BytesIO(content)
    stream.seek(0)
    return {
        'content': stream,
        'filename': f"{quote.number}-{template['template_key']}.xlsx",
        'content_type': XLSX_CONTENT_TYPE,
    }


def parse_terms_text(value):
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    if isinstance(value, list):
        return [str(line).strip() for line in value if str(line).strip()]
    return []


def parse_contract_notes_text(value):
    return parse_terms_text(value)


def _select_templates(quote, template_key: str | None = None):
    config = quote.contract_config or {}
    requested_key = str(template_key or config.get('template_key') or '').strip()
    registry = [item for item in TEMPLATE_REGISTRY if item['document_type'] == quote.document_type]
    if requested_key:
        selected = next((item for item in registry if item['template_key'] == requested_key), None)
        if selected:
            return [selected]

    families = _quote_families(quote)
    if quote.document_type == 'Contract':
        combined = [
            item
            for item in registry
            if item.get('is_combined') and set(item.get('required_families') or []) == families
        ]
        if combined:
            return sorted(combined, key=lambda item: item['selection_priority'], reverse=True)[:1]

    family_order = ['steel', 'interior', 'furniture', 'service']
    selected = []
    for family in family_order:
        if family not in families:
            continue
        selected.append(next(item for item in registry if item['family'] == family and not item.get('is_combined')))
    return selected


def _quote_families(quote):
    families = set()
    for line in quote.lines.select_related('product__category').all():
        section_key = (line.section_key or _category_section_key(line)).strip()
        family = SECTION_FAMILY_MAP.get(section_key)
        if family:
            families.add(family)
    return families


def _fill_shared_header(ws, quote):
    config = quote.contract_config or {}
    customer = _customer_snapshot(config)
    prepared_by = (config.get('prepared_by_snapshot') or {}).get('name') or ''
    seller_key = (quote.seller_company_key or 'AYKA').strip().upper()
    profiles = {profile['key'].upper(): profile for profile in get_seller_profiles(quote.organization)}
    ortka = profiles.get('ORTKA', DEFAULT_SELLER_PROFILES[0])
    ayka = profiles.get('AYKA', DEFAULT_SELLER_PROFILES[1])
    doc_date = _parse_date(config.get('contract_date')) or _timezone_fallback(quote.created_at)

    _set_cell_value(ws, 'L14', doc_date)
    _set_cell_value(ws, 'D23', customer.get('name') or getattr(quote.customer, 'name', ''))
    _set_cell_value(ws, 'D24', _join_tax(customer.get('tax_office'), customer.get('tax_number')))
    _set_cell_value(ws, 'D25', customer.get('address') or '')
    _set_cell_value(ws, 'D26', customer.get('authorized_person') or '')
    _set_cell_value(ws, 'D27', _join_contact(customer.get('phone'), customer.get('email')))
    _set_cell_value(ws, 'D30', quote.number)
    _set_cell_value(ws, 'D31', prepared_by)
    _set_cell_value(ws, 'D32', config.get('validity_label') or format_validity_text(quote.valid_until))
    _set_cell_value(ws, 'D33', config.get('price_list_label') or '')
    _set_cell_value(ws, 'C16', _choice_text(_normalize_display_name(ortka.get('display_name', '')), seller_key == 'ORTKA'))
    _set_cell_value(ws, 'J16', _choice_text(_normalize_display_name(ayka.get('display_name', '')), seller_key == 'AYKA'))
    _set_cell_value(ws, 'C17', f"VERGİ DAİRESİ: {ortka.get('tax_office', '')}")
    _set_cell_value(ws, 'J17', f"VERGİ DAİRESİ: {ayka.get('tax_office', '')}")
    _set_cell_value(ws, 'C18', f"VERGİ NO: {ortka.get('tax_number', '')}")
    _set_cell_value(ws, 'J18', f"VERGİ NO: {ayka.get('tax_number', '')}")
    _set_cell_value(ws, 'C19', _join_contact(ortka.get('email', ''), ortka.get('phone', '')))
    _set_cell_value(ws, 'J19', _join_contact(ayka.get('email', ''), ayka.get('phone', '')))


def _fill_line_blocks(ws, quote, template):
    ordered_lines = list(quote.lines.select_related('product__category').order_by('sort_order', 'id'))
    for block in template['line_blocks']:
        lines = [line for line in ordered_lines if (line.section_key or _category_section_key(line)).strip() in block['section_keys']]
        visible = bool(lines)
        for row in range(block['start_row'] - 2, block['grand_row'] + 1):
            ws.row_dimensions[row].hidden = not visible

        for offset in range(block['capacity']):
            row_number = block['start_row'] + offset
            _clear_line_row(ws, row_number)
            if offset >= len(lines):
                continue
            line = lines[offset]
            details = dict(line.details or {})
            attributes = details.get('attributes') if isinstance(details.get('attributes'), dict) else {}
            primary, secondary = _resolve_detail_texts(details, attributes)
            net_unit = _net_unit_price(line)
            line_total = Decimal(line.qty) * net_unit

            _set_cell_value(ws, f'C{row_number}', details.get('code') or getattr(line.product, 'sku', '') or '')
            _set_cell_value(ws, f'D{row_number}', line.name)
            _set_cell_value(ws, f'E{row_number}', primary)
            _set_cell_value(ws, f'F{row_number}', secondary)
            _set_cell_value(ws, f'G{row_number}', float(line.qty))
            _set_cell_value(ws, f'H{row_number}', float(line.unit_price))
            _set_cell_value(ws, f'I{row_number}', float(Decimal(line.discount or 0)))
            _set_cell_value(ws, f'J{row_number}', 0)
            _set_cell_value(ws, f'K{row_number}', line.unit or 'Adet')
            _set_cell_value(ws, f'L{row_number}', float(net_unit))
            _set_cell_value(ws, f'M{row_number}', float(line_total))

        subtotal_value = sum((_line_subtotal(line) for line in lines), Decimal('0'))
        tax_value = sum((_line_tax(line) for line in lines), Decimal('0'))
        grand_value = subtotal_value + tax_value
        _set_cell_value(ws, f'M{block["subtotal_row"]}', float(subtotal_value) if visible else '')
        _set_cell_value(ws, f'M{block["tax_row"]}', float(tax_value) if visible else '')
        _set_cell_value(ws, f'M{block["grand_row"]}', float(grand_value) if visible else '')


def _fill_commercial_rows(ws, quote, template):
    config = quote.contract_config or {}
    commercial_values = [
        quote.number,
        (config.get('prepared_by_snapshot') or {}).get('name') or '',
        quote.payment_terms or '',
        quote.delivery_terms or '',
        config.get('validity_label') or format_validity_text(quote.valid_until),
        (config.get('delivery_type') or '').strip(),
        (config.get('payment_option') or '').strip(),
    ]
    for row, value in zip(template['commercial_rows'], commercial_values, strict=False):
        _set_cell_value(ws, f'D{row}', value)


def _fill_terms(ws, quote, template):
    terms = parse_terms_text((quote.contract_config or {}).get('terms_text'))
    for row in template['terms_rows']:
        _set_cell_value(ws, f'C{row}', '')
    for row, term in zip(template['terms_rows'], terms, strict=False):
        _set_cell_value(ws, f'C{row}', term)
    if quote.document_type == 'Contract':
        _fill_contract_notes(ws, quote, template)


def _fill_contract_notes(ws, quote, template):
    config = quote.contract_config or {}
    note_rows = list(template['terms_rows'][1:7])
    closing_row = template['terms_rows'][-1]
    notes = parse_contract_notes_text(config.get('contract_notes_text') or DEFAULT_CONTRACT_NOTES_TEXT)
    for index, row in enumerate(note_rows, start=1):
        text = notes[index - 1] if index - 1 < len(notes) else ''
        _set_cell_value(ws, f'I{row}', f'{index}- {text}'.rstrip())

    contract_date = _parse_date(config.get('contract_date')) or _timezone_fallback(quote.created_at)
    _set_cell_value(
        ws,
        f'I{closing_row}',
        f'İşbu sözleşme {contract_date.strftime("%d/%m/%Y")} tarihinde iki nüsha olarak imzalanmış ve yürürlüğe girmiştir.',
    )


def _fill_bank_accounts(ws, quote, template):
    profiles = {profile['key'].upper(): profile for profile in get_seller_profiles(quote.organization)}
    ortka = profiles.get('ORTKA', DEFAULT_SELLER_PROFILES[0])
    ayka = profiles.get('AYKA', DEFAULT_SELLER_PROFILES[1])
    header_row = template['bank_header_row']
    _set_cell_value(ws, f'C{header_row}', f"{_normalize_display_name(ortka.get('display_name', ''))} TL")
    _set_cell_value(ws, f'K{header_row}', f"{_normalize_display_name(ayka.get('display_name', ''))} TL")
    ortka_accounts = ortka.get('bank_accounts') or []
    ayka_accounts = ayka.get('bank_accounts') or []
    for index, row in enumerate(template['bank_rows']):
        left = ortka_accounts[index] if index < len(ortka_accounts) else {}
        right = ayka_accounts[index] if index < len(ayka_accounts) else {}
        _set_cell_value(ws, f'C{row}', _normalize_bank_name(left.get('bank', '')))
        _set_cell_value(ws, f'D{row}', left.get('iban', ''))
        _set_cell_value(
            ws,
            f'K{row}',
            ' '.join(part for part in [_normalize_bank_name(right.get('bank', '')), right.get('iban', '')] if part),
        )


def _fill_signature_block(ws, quote, template):
    customer = _customer_snapshot(quote.contract_config or {})
    profiles = {profile['key'].upper(): profile for profile in get_seller_profiles(quote.organization)}
    seller = profiles.get((quote.seller_company_key or 'AYKA').strip().upper(), DEFAULT_SELLER_PROFILES[1])
    row = template['signature_row']
    _set_cell_value(ws, f'C{row}', f"{_normalize_display_name(seller.get('display_name', ''))} ADINA İMZA")
    _set_cell_value(ws, f'J{row}', customer.get('name') or getattr(quote.customer, 'name', '') or '')


def _resolve_detail_texts(details, attributes):
    attribute_lines = []
    for key, value in (attributes or {}).items():
        if value in [None, '']:
            continue
        label = str(key).replace('_', ' ').strip().title()
        attribute_lines.append(f"{label}: {value}")
    primary = details.get('primary') or (attribute_lines[0] if attribute_lines else '')
    secondary_parts = []
    if details.get('secondary'):
        secondary_parts.append(str(details.get('secondary')))
    secondary_parts.extend(attribute_lines[1:3])
    return primary, ' | '.join(part for part in secondary_parts if part)


def _normalize_bank_name(value):
    normalized = {
        'Turkiye Is Bankasi': 'Türkiye İş Bankası',
        'Ziraat Bankasi': 'Ziraat Bankası',
        'Albaraka Turk': 'Albaraka Türk',
        'Albaraka Turk K.Bank': 'Albaraka Türk K.Bank.',
        'Albaraka Turk K.Bank.': 'Albaraka Türk K.Bank.',
        'Vakiflar Bankasi': 'Vakıflar Bankası',
    }
    text = str(value or '').strip()
    return normalized.get(text, text)


def _normalize_display_name(value):
    normalized = {
        'ORTKA YAPI ELEMANLARI URETIM SAN. LTD. STI.': 'ORTKA YAPI ELEMANLARI ÜRETİM SAN. LTD. ŞTİ.',
        'AYKA KAPI SANAYI TICARET ANONIM SIRKETI': 'AYKA KAPI SANAYİ TİCARET ANONİM ŞİRKETİ',
    }
    text = str(value or '').strip()
    return normalized.get(text, text)


def _clear_line_row(ws, row_number):
    for column in ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']:
        _set_cell_value(ws, f'{column}{row_number}', '')


def _set_cell_value(ws, coordinate, value):
    cell = ws[coordinate]
    if cell.__class__.__name__ == 'MergedCell':
        for merged_range in ws.merged_cells.ranges:
            if coordinate in merged_range:
                cell = ws.cell(merged_range.min_row, merged_range.min_col)
                break
    cell.value = value


def _line_subtotal(line):
    return Decimal(line.qty) * _net_unit_price(line)


def _line_tax(line):
    return _line_subtotal(line) * (Decimal(line.tax or 0) / Decimal('100'))


def _net_unit_price(line):
    return Decimal(line.unit_price) * (Decimal('1') - (Decimal(line.discount or 0) / Decimal('100')))


def _customer_snapshot(config):
    snapshot = dict((config or {}).get('customer_snapshot') or {})
    return {
        'name': snapshot.get('name', ''),
        'tax_office': snapshot.get('tax_office') or snapshot.get('taxOffice', ''),
        'tax_number': snapshot.get('tax_number') or snapshot.get('taxNumber', ''),
        'address': snapshot.get('address', ''),
        'authorized_person': snapshot.get('authorized_person') or snapshot.get('authorizedPerson', ''),
        'phone': snapshot.get('phone', ''),
        'email': snapshot.get('email', ''),
    }


def _category_section_key(line):
    product = getattr(line, 'product', None)
    category = getattr(product, 'category', None) if product else None
    defaults = getattr(category, 'template_defaults', {}) or {}
    return defaults.get('section_key', '')


def _parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def _join_tax(tax_office, tax_number):
    left = (tax_office or '').strip()
    right = (tax_number or '').strip()
    if left and right:
        return f'{left} / {right}'
    return left or right


def _join_contact(first, second):
    return ' / '.join(part.strip() for part in [first, second] if part and str(part).strip())


def _timezone_fallback(value):
    if isinstance(value, datetime):
        return value.date()
    return date.today()


def _choice_text(label, selected):
    return f'X {label}' if label and selected else label


def format_validity_text(valid_until):
    parsed = _parse_date(valid_until)
    return parsed.strftime('%d.%m.%Y') if parsed else ''
