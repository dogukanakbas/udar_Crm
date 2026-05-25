from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import serializers

from accounts.price_lists import (
    get_org_default_price_list,
    get_org_price_list_label,
    get_org_price_lists,
    get_product_price_for_list,
    get_price_list_by_key,
    normalize_product_price_lists,
)
from audit.utils import log_entity_action
from erp.models import Product

from .contracts import (
    DEFAULT_CONTRACT_NOTES_TEXT,
    DEFAULT_GENERAL_TERMS,
    DEFAULT_TERMS_TEXT,
    parse_terms_text,
    resolve_product_document_defaults,
)
from .models import BusinessPartner, Contact, Lead, Opportunity, PricingRule, Quote, QuoteLine

SUPPORTED_CURRENCIES = {'TRY', 'USD', 'EUR'}
TURKEY_ALIASES = {'turkiye', 'türkiye', 'turkey', 'turk', 'türk', 'tr', 'tur'}
MAX_LINE_DISCOUNT = Decimal('50')
MAX_SECONDARY_DISCOUNT = Decimal('12')


def normalize_currency_code(value, default='TRY'):
    normalized = str(value or default or 'TRY').strip().upper()
    return normalized if normalized in SUPPORTED_CURRENCIES else default


def is_turkey_country(value):
    normalized = str(value or '').strip().lower()
    return normalized in TURKEY_ALIASES


def allowed_partner_currencies(country):
    if not str(country or '').strip():
        return {'TRY', 'USD', 'EUR'}
    return {'TRY', 'USD', 'EUR'} if is_turkey_country(country) else {'USD', 'EUR'}


def default_partner_currency(country):
    if not str(country or '').strip():
        return 'TRY'
    return 'TRY' if is_turkey_country(country) else 'USD'


def add_business_days(start_date, days):
    try:
        remaining = max(0, int(days or 0))
    except (TypeError, ValueError):
        remaining = 0
    current = start_date
    while remaining > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            remaining -= 1
    return current


def normalize_validity_days(value, default=7):
    try:
        days = int(value)
    except (TypeError, ValueError):
        return default
    return days if 1 <= days <= 365 else default


class BusinessPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessPartner
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False},
            'name': {'required': False, 'allow_blank': True},
            'group': {
                'required': False,
                'allow_blank': True,
                'error_messages': {'max_length': 'Sektör / grup en fazla 50 karakter olabilir.'},
            },
            'city': {'required': False, 'allow_blank': True},
            'country': {'required': False, 'allow_blank': True},
            'currency': {'required': False, 'allow_blank': True},
            'size': {'required': False, 'allow_blank': True},
            'price_list_key': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
            'tax_office': {'required': False, 'allow_blank': True},
            'tax_number': {'required': False, 'allow_blank': True},
            'authorized_person': {'required': False, 'allow_blank': True},
            'owner': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        org = attrs.get('organization') or (self.context.get('request').user.organization if self.context.get('request') else None)
        email = (attrs.get('email') or '').strip().lower()
        attrs['email'] = email
        country = attrs.get('country', getattr(self.instance, 'country', ''))
        requested_currency = attrs.get('currency', getattr(self.instance, 'currency', ''))
        normalized_currency = normalize_currency_code(requested_currency, default_partner_currency(country))

        if normalized_currency not in allowed_partner_currencies(country):
            raise serializers.ValidationError({'currency': 'Yurt disi sirketlerde para birimi USD veya EUR olmalidir.'})

        attrs['currency'] = normalized_currency
        price_list_key = str(attrs.get('price_list_key', getattr(self.instance, 'price_list_key', '')) or '').strip()
        if org:
            price_lists = get_org_price_lists(org)
            valid_keys = {item.get('key') for item in price_lists}
            if price_list_key and price_list_key not in valid_keys:
                price_list_key = get_price_list_by_key(price_lists, price_list_key).get('key') or ''
        attrs['price_list_key'] = price_list_key
        return super().validate(attrs)


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False},
            'name': {'required': False, 'allow_blank': True},
            'email': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True},
            'company': {'required': False, 'allow_null': True},
        }

    def create(self, validated_data):
        org = self.context['request'].user.organization if self.context.get('request') else None
        company = validated_data.get('company')
        if not company and org:
            company = BusinessPartner.objects.filter(organization=org).first()
            if not company:
                company = BusinessPartner.objects.create(organization=org, name='Default Partner')
            validated_data['company'] = company
        if org:
            validated_data['organization'] = org
        return super().create(validated_data)

    def validate(self, attrs):
        org = attrs.get('organization') or (self.context.get('request').user.organization if self.context.get('request') else None)
        email = (attrs.get('email') or '').strip().lower()
        if email and org:
            qs = Contact.objects.filter(organization=org, email__iexact=email)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'email': 'Bu e-posta ile başka bir kişi zaten kayıtlı'})
        return super().validate(attrs)


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = '__all__'


class OpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Opportunity
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False},
            'name': {'required': False, 'allow_blank': True},
            'lead': {'required': False, 'allow_null': True},
            'company': {'required': False, 'allow_null': True},
            'owner': {'required': False, 'allow_null': True},
            'stage': {'required': False, 'allow_blank': True},
            'value': {'required': False},
            'close_date': {'required': False, 'allow_null': True},
        }


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False},
            'sku': {'required': False, 'allow_blank': True},
            'name': {'required': False, 'allow_blank': True},
            'price': {'required': False},
            'price_lists': {'required': False},
            'stock': {'required': False},
            'reserved': {'required': False},
            'reorder_point': {'required': False},
            'category': {'required': False, 'allow_null': True},
            'template_defaults': {'required': False},
        }

    def create(self, validated_data):
        validated_data['price_lists'] = normalize_product_price_lists(
            validated_data.get('price_lists'),
            validated_data.get('price'),
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'price_lists' in validated_data or 'price' in validated_data:
            validated_data['price_lists'] = normalize_product_price_lists(
                validated_data.get('price_lists', instance.price_lists),
                validated_data.get('price', instance.price),
            )
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['price_lists'] = normalize_product_price_lists(instance.price_lists, instance.price)
        return data


class QuoteLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = QuoteLine
        fields = [
            'id',
            'product',
            'product_sku',
            'product_name',
            'section_key',
            'name',
            'unit',
            'qty',
            'unit_price',
            'discount',
            'discount_secondary',
            'tax',
            'sort_order',
            'details',
        ]

    def get_product_sku(self, obj):
        return obj.product.sku if obj.product else ''

    def get_product_name(self, obj):
        return obj.product.name if obj.product else ''

    def validate(self, attrs):
        hundred = Decimal('100')
        first_discount = Decimal(attrs.get('discount') or 0)
        second_discount = Decimal(attrs.get('discount_secondary') or 0)

        if first_discount > MAX_LINE_DISCOUNT:
            raise serializers.ValidationError('1. iskonto en fazla %50 olabilir.')
        if second_discount > MAX_SECONDARY_DISCOUNT:
            raise serializers.ValidationError('2. iskonto en fazla %12 olabilir.')

        return attrs


class QuoteSerializer(serializers.ModelSerializer):
    lines = QuoteLineSerializer(many=True)
    owner_name = serializers.SerializerMethodField()
    prepared_by_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            'id',
            'document_type',
            'number',
            'customer',
            'customer_name',
            'opportunity',
            'owner',
            'owner_name',
            'prepared_by',
            'prepared_by_name',
            'seller_company_key',
            'status',
            'valid_until',
            'subtotal',
            'discount_total',
            'tax_total',
            'total',
            'currency',
            'payment_terms',
            'delivery_terms',
            'notes',
            'vat_rate',
            'contract_config',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['number', 'prepared_by', 'subtotal', 'discount_total', 'tax_total', 'total', 'created_at', 'updated_at']

    def get_owner_name(self, obj):
        if not obj.owner:
            return ''
        full_name = f"{(obj.owner.first_name or '').strip()} {(obj.owner.last_name or '').strip()}".strip()
        return full_name or obj.owner.username

    def get_prepared_by_name(self, obj):
        if not obj.prepared_by:
            return ''
        full_name = f"{(obj.prepared_by.first_name or '').strip()} {(obj.prepared_by.last_name or '').strip()}".strip()
        return full_name or obj.prepared_by.username

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else ''

    def to_internal_value(self, data):
        mutable = data.copy()

        if 'customerId' in mutable and 'customer' not in mutable:
            mutable['customer'] = mutable.pop('customerId')
        if 'opportunityId' in mutable and 'opportunity' not in mutable:
            mutable['opportunity'] = mutable.pop('opportunityId')
        if 'preparedById' in mutable and 'prepared_by' not in mutable:
            mutable['prepared_by'] = mutable.pop('preparedById')
        if 'documentType' in mutable and 'document_type' not in mutable:
            mutable['document_type'] = mutable.pop('documentType')
        if 'sellerCompanyKey' in mutable and 'seller_company_key' not in mutable:
            mutable['seller_company_key'] = mutable.pop('sellerCompanyKey')
        if 'contractConfig' in mutable and 'contract_config' not in mutable:
            mutable['contract_config'] = mutable.pop('contractConfig')
        if 'validUntil' in mutable:
            mutable['valid_until'] = mutable.pop('validUntil')
        if 'payment' in mutable:
            mutable['payment_terms'] = mutable.pop('payment')
        if 'delivery' in mutable:
            mutable['delivery_terms'] = mutable.pop('delivery')
        if 'vatRate' in mutable and 'vat_rate' not in mutable:
            mutable['vat_rate'] = mutable.pop('vatRate')

        if 'lines' not in mutable:
            return super().to_internal_value(mutable)

        lines = mutable.get('lines', []) or []
        normalized_lines = []
        for idx, line in enumerate(lines):
            if not line:
                continue
            details = dict(line.get('details') or {})
            primary_detail = line.get('detail1') or line.get('primaryDetail') or line.get('measure')
            secondary_detail = line.get('detail2') or line.get('secondaryDetail') or line.get('color')
            if primary_detail not in [None, ''] and 'primary' not in details:
                details['primary'] = primary_detail
            if secondary_detail not in [None, ''] and 'secondary' not in details:
                details['secondary'] = secondary_detail
            code = line.get('sku') or line.get('productCode')
            if code and 'code' not in details:
                details['code'] = code

            normalized_lines.append(
                {
                    'product': line.get('product') or line.get('productId'),
                    'section_key': line.get('section_key') or line.get('sectionKey') or '',
                    'name': line.get('name') or line.get('productName') or 'Satır',
                    'unit': line.get('unit') or '',
                    'qty': line.get('qty') or line.get('quantity') or 1,
                    'unit_price': line.get('unit_price') or line.get('unitPrice') or 0,
                    'discount': line.get('discount') or 0,
                    'discount_secondary': line.get('discount_secondary') or line.get('discountSecondary') or line.get('discount2') or 0,
                    'tax': line.get('tax') or 0,
                    'sort_order': line.get('sort_order') or line.get('sortOrder') or idx,
                    'details': details,
                }
            )
        mutable['lines'] = normalized_lines
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        org = validated_data.get('organization') or (self.context.get('request').user.organization if self.context.get('request') else None)
        if not validated_data.get('customer') and org:
            customer = BusinessPartner.objects.filter(organization=org).first()
            if not customer:
                customer = BusinessPartner.objects.create(organization=org, name='Default Customer')
            validated_data['customer'] = customer
        if not validated_data.get('owner') and self.context.get('request'):
            validated_data['owner'] = self.context['request'].user
        if org:
            validated_data.setdefault('organization', org)
        validated_data['contract_config'] = self._prepare_contract_config(validated_data, validated_data.get('contract_config') or {})
        if not validated_data.get('valid_until'):
            validated_data['valid_until'] = add_business_days(
                timezone.localdate(),
                normalize_validity_days(validated_data['contract_config'].get('validity_days'), 7),
            )
        quote = Quote.objects.create(**validated_data)
        quote._audit_user = self.context.get('request').user if self.context.get('request') else None
        self._create_lines(quote, lines_data)
        self._recalc(quote)
        return quote

    def validate(self, attrs):
        attrs = super().validate(attrs)
        customer = attrs.get('customer') or (self.instance.customer if self.instance else None)
        country = getattr(customer, 'country', '')
        preferred_currency = normalize_currency_code(
            getattr(customer, 'currency', ''),
            default_partner_currency(country),
        )
        requested_currency = attrs.get('currency', getattr(self.instance, 'currency', preferred_currency))
        normalized_currency = normalize_currency_code(requested_currency, preferred_currency)

        if normalized_currency not in allowed_partner_currencies(country):
            raise serializers.ValidationError({'currency': 'Yurt disi musteriler icin TL kullanilamaz.'})

        delivery_terms = attrs.get('delivery_terms', getattr(self.instance, 'delivery_terms', ''))
        if not str(delivery_terms or '').strip():
            raise serializers.ValidationError({'delivery_terms': 'Teslim tarihi zorunludur.'})

        attrs['currency'] = normalized_currency
        return attrs

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        contract_config = validated_data.pop('contract_config', None)
        request_user = self.context.get('request').user if self.context.get('request') else None
        previous_lines_snapshot = self._serialize_quote_lines(instance.lines.all()) if lines_data is not None else None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if contract_config is not None:
            instance.contract_config = self._prepare_contract_config(validated_data, contract_config, instance=instance)
        else:
            instance.contract_config = self._prepare_contract_config(validated_data, instance.contract_config or {}, instance=instance)
        if not getattr(instance, 'valid_until', None):
            instance.valid_until = add_business_days(
                timezone.localdate(),
                normalize_validity_days(instance.contract_config.get('validity_days'), 7),
            )
        instance._audit_user = request_user
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            self._create_lines(instance, lines_data)
            next_lines_snapshot = self._serialize_quote_lines(instance.lines.all())
            if previous_lines_snapshot != next_lines_snapshot:
                log_entity_action(instance, 'updated', user=request_user, field='lines', old_value=previous_lines_snapshot, new_value=next_lines_snapshot)
        self._recalc(instance)
        return instance

    def _serialize_quote_lines(self, lines):
        snapshots = []
        for index, line in enumerate(lines):
            if isinstance(line, dict):
                details = dict(line.get('details') or {})
                snapshots.append(
                    {
                        'index': int(line.get('sort_order', line.get('sortOrder', index))),
                        'name': line.get('name') or 'Satır',
                        'section_key': line.get('section_key') or line.get('sectionKey') or '',
                        'unit': line.get('unit') or '',
                        'qty': str(line.get('qty') or line.get('quantity') or 0),
                        'unit_price': str(line.get('unit_price') or line.get('unitPrice') or 0),
                        'discount': str(line.get('discount') or 0),
                        'discount_secondary': str(line.get('discount_secondary') or line.get('discountSecondary') or 0),
                        'tax': str(line.get('tax') or 0),
                        'code': details.get('code') or line.get('sku') or '',
                        'details': details,
                    }
                )
                continue

            snapshots.append(
                {
                    'index': int(getattr(line, 'sort_order', index)),
                    'name': getattr(line, 'name', 'Satır'),
                    'section_key': getattr(line, 'section_key', ''),
                    'unit': getattr(line, 'unit', ''),
                    'qty': str(getattr(line, 'qty', 0)),
                    'unit_price': str(getattr(line, 'unit_price', 0)),
                    'discount': str(getattr(line, 'discount', 0)),
                    'discount_secondary': str(getattr(line, 'discount_secondary', 0)),
                    'tax': str(getattr(line, 'tax', 0)),
                    'code': (getattr(line, 'details', {}) or {}).get('code') or getattr(getattr(line, 'product', None), 'sku', '') or '',
                    'details': getattr(line, 'details', {}) or {},
                }
            )

        return sorted(snapshots, key=lambda item: item.get('index', 0))

    def _prepare_contract_config(self, validated_data, incoming_config, instance=None):
        config = self._normalize_contract_config(incoming_config or {})

        customer = validated_data.get('customer') or (instance.customer if instance else None)
        prepared_by = validated_data.get('prepared_by') or (instance.prepared_by if instance else None)
        owner = validated_data.get('owner') or (instance.owner if instance else None)
        organization = validated_data.get('organization') or (instance.organization if instance else None)

        snapshot = {}
        if customer:
            snapshot = {
                'name': customer.name,
                'tax_office': customer.tax_office or '',
                'tax_number': customer.tax_number or '',
                'address': customer.address or '',
                'authorized_person': customer.authorized_person or '',
                'phone': customer.phone or '',
                'email': customer.email or '',
                'city': customer.city or '',
                'country': customer.country or '',
                'currency': normalize_currency_code(customer.currency, default_partner_currency(customer.country)),
            }
        snapshot.update(dict(config.get('customer_snapshot') or {}))
        config['customer_snapshot'] = snapshot

        preparer = prepared_by or owner
        if preparer:
            full_name = f"{(preparer.first_name or '').strip()} {(preparer.last_name or '').strip()}".strip() or preparer.username
            config['prepared_by_snapshot'] = {
                'id': preparer.id,
                'name': full_name,
                'email': preparer.email or '',
                'role': preparer.role,
            }

        selected_price_list_key = (
            config.get('price_list_key')
            or config.get('priceListKey')
            or getattr(customer, 'price_list_key', '')
            or get_org_default_price_list(organization).get('key')
        )
        price_list = next(
            (item for item in get_org_price_lists(organization) if item.get('key') == selected_price_list_key),
            get_org_default_price_list(organization),
        )
        config['price_list_key'] = price_list.get('key')
        config['price_list_label'] = get_org_price_list_label(organization, config['price_list_key'])

        config.setdefault('template_mode', 'auto')
        config.setdefault('template_key', '')
        config.setdefault('validity_days', 7)
        config['validity_days'] = normalize_validity_days(config.get('validity_days'), 7)
        config.setdefault('validity_label', f"{config['validity_days']} gün")
        currency_code = str(validated_data.get('currency') or (instance.currency if instance else 'TRY') or 'TRY').upper()
        try:
            exchange_rate = float(config.get('exchange_rate') or 1)
        except (TypeError, ValueError):
            exchange_rate = 1
        config['exchange_rate'] = 1 if currency_code == 'TRY' else (exchange_rate if exchange_rate > 0 else 1)
        config.setdefault('delivery_type', validated_data.get('delivery_terms') or (instance.delivery_terms if instance else ''))
        config.setdefault('payment_option', validated_data.get('payment_terms') or (instance.payment_terms if instance else ''))
        config.setdefault('signature_customer_label', snapshot.get('name') or 'CARİ ÜNVANI')
        existing_config = self._normalize_contract_config(instance.contract_config or {}) if instance else {}
        config['contract_date'] = existing_config.get('contract_date') or timezone.localdate().isoformat()
        config.setdefault('terms_text', DEFAULT_TERMS_TEXT)
        config.setdefault('contract_notes_text', DEFAULT_CONTRACT_NOTES_TEXT)
        config['general_terms'] = parse_terms_text(config.get('terms_text'))
        config['contract_notes'] = parse_terms_text(config.get('contract_notes_text'))
        return config

    def _normalize_contract_config(self, incoming_config):
        config = dict(incoming_config or {})
        key_map = {
            'templateSheet': 'template_sheet',
            'contractDate': 'contract_date',
            'validityLabel': 'validity_label',
            'validityDays': 'validity_days',
            'validityPreset': 'validity_preset',
            'priceListLabel': 'price_list_label',
            'priceListKey': 'price_list_key',
            'deliveryType': 'delivery_type',
            'paymentOption': 'payment_option',
            'signatureCustomerLabel': 'signature_customer_label',
            'customerSnapshot': 'customer_snapshot',
            'preparedBySnapshot': 'prepared_by_snapshot',
            'generalTerms': 'general_terms',
            'termsText': 'terms_text',
            'contractNotes': 'contract_notes',
            'contractNotesText': 'contract_notes_text',
            'serviceExpenses': 'service_expenses',
            'templateMode': 'template_mode',
            'templateKey': 'template_key',
            'exchangeRate': 'exchange_rate',
        }
        for source_key, target_key in key_map.items():
            if source_key in config and target_key not in config:
                config[target_key] = config.pop(source_key)

        snapshot = dict(config.get('customer_snapshot') or {})
        snapshot_key_map = {
            'taxOffice': 'tax_office',
            'taxNumber': 'tax_number',
            'authorizedPerson': 'authorized_person',
        }
        for source_key, target_key in snapshot_key_map.items():
            if source_key in snapshot and target_key not in snapshot:
                snapshot[target_key] = snapshot.pop(source_key)
        config['customer_snapshot'] = snapshot
        if 'terms_text' not in config:
            config['terms_text'] = '\n'.join(config.get('general_terms') or DEFAULT_GENERAL_TERMS)
        config['general_terms'] = parse_terms_text(config.get('terms_text'))
        if 'contract_notes_text' not in config:
            config['contract_notes_text'] = '\n'.join(config.get('contract_notes') or parse_terms_text(DEFAULT_CONTRACT_NOTES_TEXT))
        config['contract_notes'] = parse_terms_text(config.get('contract_notes_text'))
        try:
            config['exchange_rate'] = float(config.get('exchange_rate') or 1)
        except (TypeError, ValueError):
            config['exchange_rate'] = 1
        config['service_expenses'] = self._normalize_service_expenses(config.get('service_expenses'))
        return config

    def _normalize_service_expenses(self, value):
        if not isinstance(value, list):
            return []
        normalized = []
        seen = set()
        for item in value:
            if not isinstance(item, dict):
                continue
            category_key = str(item.get('category_key') or item.get('categoryKey') or '').strip()
            category_label = str(item.get('category_label') or item.get('categoryLabel') or '').strip()
            if not category_key or not category_label or category_key in seen:
                continue
            try:
                quantity = Decimal(str(item.get('quantity') if item.get('quantity') not in [None, ''] else 1))
            except (InvalidOperation, TypeError, ValueError):
                quantity = Decimal('1')
            quantity = max(quantity, Decimal('0'))
            try:
                unit_amount = Decimal(str(item.get('unit_amount') if item.get('unit_amount') not in [None, ''] else item.get('unitAmount', '')))
            except (InvalidOperation, TypeError, ValueError):
                unit_amount = Decimal('-1')
            try:
                amount = Decimal(str(item.get('amount') or 0))
            except (InvalidOperation, TypeError, ValueError):
                amount = Decimal('0')
            if unit_amount < Decimal('0'):
                unit_amount = amount / quantity if quantity > Decimal('0') else amount
            unit_amount = max(unit_amount, Decimal('0'))
            amount = unit_amount * quantity
            try:
                tax = Decimal(str(item.get('tax') if item.get('tax') not in [None, ''] else item.get('tax_rate', item.get('taxRate', 20))))
            except (InvalidOperation, TypeError, ValueError):
                tax = Decimal('20')
            seen.add(category_key)
            normalized.append(
                {
                    'category_key': category_key[:80],
                    'category_label': category_label[:160],
                    'quantity': str(quantity.quantize(Decimal('0.01'))),
                    'unit_amount': str(unit_amount.quantize(Decimal('0.01'))),
                    'amount': str(max(amount, Decimal('0')).quantize(Decimal('0.01'))),
                    'tax': str(max(tax, Decimal('0')).quantize(Decimal('0.01'))),
                }
            )
        return normalized

    def _create_lines(self, quote, lines_data):
        price_list_key = (quote.contract_config or {}).get('price_list_key') or ''
        for idx, line in enumerate(lines_data):
            product = line.get('product')
            details = dict(line.get('details') or {})
            section_key = line.get('section_key') or ''
            unit = line.get('unit') or ''

            if product:
                defaults = product.template_defaults or {}
                document_defaults = resolve_product_document_defaults(product, fallback_section_key=section_key, line_name=line.get('name') or '')
                section_key = document_defaults.get('section_key') or section_key
                unit = unit or defaults.get('unit') or ''
                details.setdefault('code', product.sku)
                if defaults.get('primary') and 'primary' not in details:
                    details['primary'] = defaults.get('primary')
                if defaults.get('secondary') and 'secondary' not in details:
                    details['secondary'] = defaults.get('secondary')
                if product.attribute_values and 'attributes' not in details:
                    details['attributes'] = product.attribute_values
                if 'technicalItems' not in details and 'technical_items' not in details:
                    technical_items = document_defaults.get('technical_items') or []
                    details['technicalItems'] = [str(item or '').strip() for item in technical_items if str(item or '').strip()]
                if line.get('unit_price') in [None, '']:
                    line['unit_price'] = get_product_price_for_list(product, price_list_key)

            QuoteLine.objects.create(
                quote=quote,
                product=product,
                section_key=section_key,
                name=line.get('name') or 'Satır',
                unit=unit,
                qty=line.get('qty') or 0,
                unit_price=line.get('unit_price') or 0,
                discount=line.get('discount') or 0,
                discount_secondary=line.get('discount_secondary') or 0,
                tax=line.get('tax') or 0,
                sort_order=line.get('sort_order') if line.get('sort_order') is not None else idx,
                details=details,
            )

    def _recalc(self, quote):
        org = quote.organization
        rules = PricingRule.objects.filter(organization=org)
        hundred = Decimal('100')
        subtotal = sum((l.qty * l.unit_price for l in quote.lines.all()), Decimal('0'))
        discount = Decimal('0')

        for line in quote.lines.select_related('product__category'):
            base = line.qty * line.unit_price
            discounted_base = base * (Decimal('1') - (line.discount / hundred))
            discounted_base *= Decimal('1') - (line.discount_secondary / hundred)
            discount += base - discounted_base
            if line.product and line.product.category:
                for r in rules.filter(type='category', target=line.product.category.name):
                    discount += base * (r.value / hundred)

        partner_group = quote.customer.group if quote.customer else None
        if partner_group:
            for r in rules.filter(type='customer', target=partner_group):
                discount += subtotal * (r.value / hundred)

        for r in rules.filter(type='volume'):
            try:
                threshold = Decimal(str(r.target))
            except (InvalidOperation, TypeError, ValueError):
                threshold = Decimal('0')
            if subtotal >= threshold:
                discount += subtotal * (r.value / hundred)

        service_subtotal = Decimal('0')
        service_tax = Decimal('0')
        for item in (quote.contract_config or {}).get('service_expenses') or []:
            try:
                amount = Decimal(str(item.get('amount') or 0))
            except (InvalidOperation, TypeError, ValueError):
                amount = Decimal('0')
            try:
                quantity = Decimal(str(item.get('quantity') if item.get('quantity') not in [None, ''] else 1))
            except (InvalidOperation, TypeError, ValueError):
                quantity = Decimal('1')
            try:
                unit_amount = Decimal(str(item.get('unit_amount') if item.get('unit_amount') not in [None, ''] else item.get('unitAmount', '')))
            except (InvalidOperation, TypeError, ValueError):
                unit_amount = Decimal('-1')
            if unit_amount >= Decimal('0'):
                amount = max(unit_amount, Decimal('0')) * max(quantity, Decimal('0'))
            try:
                tax_rate = Decimal(str(item.get('tax') or 0))
            except (InvalidOperation, TypeError, ValueError):
                tax_rate = Decimal('0')
            amount = max(amount, Decimal('0'))
            service_subtotal += amount
            service_tax += amount * (tax_rate / hundred)

        rate = (quote.vat_rate if quote.vat_rate is not None else Decimal('20')) / hundred
        tax = (subtotal - discount) * rate
        quote.subtotal = subtotal + service_subtotal
        quote.discount_total = discount
        quote.tax_total = tax + service_tax
        quote.total = subtotal - discount + tax + service_subtotal + service_tax
        quote.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'total'])


class QuoteListSerializer(QuoteSerializer):
    class Meta(QuoteSerializer.Meta):
        fields = [
            'id',
            'document_type',
            'number',
            'customer',
            'customer_name',
            'opportunity',
            'owner',
            'owner_name',
            'prepared_by',
            'prepared_by_name',
            'seller_company_key',
            'status',
            'valid_until',
            'subtotal',
            'discount_total',
            'tax_total',
            'total',
            'currency',
            'payment_terms',
            'delivery_terms',
            'notes',
            'vat_rate',
            'contract_config',
            'created_at',
            'updated_at',
        ]


class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = '__all__'
