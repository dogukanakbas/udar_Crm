from rest_framework import serializers

from organizations.models import Organization

from .models import Category, Invoice, InvoicePayment, Product, PurchaseOrder, SalesOrder, StockMovement, Vehicle


def _ensure_org(request):
    org = getattr(getattr(request, 'user', None), 'organization', None) if request else None
    if org:
        return org
    org = Organization.objects.first()
    if not org:
        org = Organization.objects.create(name='Default Org')
    return org


def _normalize_schema(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _merge_attribute_schema(category_schema, override_schema):
    merged = {}
    ordered_keys = []
    for item in _normalize_schema(category_schema):
        key = str(item.get('field_key') or '').strip()
        if not key:
            continue
        merged[key] = dict(item)
        ordered_keys.append(key)
    for item in _normalize_schema(override_schema):
        key = str(item.get('field_key') or '').strip()
        if not key:
            continue
        merged[key] = {**merged.get(key, {}), **dict(item)}
        if key not in ordered_keys:
            ordered_keys.append(key)
    return [merged[key] for key in ordered_keys if key in merged]


class CategorySerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        required=False,
        allow_null=True,
        queryset=Organization.objects.all(),
        default=None,
    )

    class Meta:
        model = Category
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False, 'allow_null': True},
            'name': {'required': False, 'allow_blank': True},
            'template_defaults': {'required': False},
            'attribute_schema': {'required': False},
        }

    def to_internal_value(self, data):
        mutable = data.copy()
        if 'organization' not in mutable or mutable.get('organization') in [None, '']:
            org = _ensure_org(self.context.get('request'))
            mutable['organization'] = getattr(org, 'id', org)
        mutable['attribute_schema'] = _normalize_schema(mutable.get('attribute_schema'))
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        validated_data.setdefault('organization', _ensure_org(self.context.get('request')))
        validated_data['attribute_schema'] = _normalize_schema(validated_data.get('attribute_schema'))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'attribute_schema' in validated_data:
            validated_data['attribute_schema'] = _normalize_schema(validated_data.get('attribute_schema'))
        return super().update(instance, validated_data)


class ProductSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        required=False,
        allow_null=True,
        queryset=Organization.objects.all(),
        default=None,
    )
    sku = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = Product
        fields = '__all__'
        validators = []
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
            'name': {'required': False, 'allow_blank': True},
            'price': {'required': False},
            'stock': {'required': False},
            'reserved': {'required': False},
            'reorder_point': {'required': False},
            'organization': {'required': False, 'allow_null': True},
            'category': {'required': False, 'allow_null': True},
            'template_defaults': {'required': False},
            'attribute_values': {'required': False},
            'attribute_schema_override': {'required': False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org = _ensure_org(self.context.get('request'))
        self.fields['organization'].required = False
        self.fields['organization'].allow_null = True
        self.fields['organization'].default = getattr(org, 'id', org)
        self.fields['sku'].required = False
        self.fields['sku'].allow_blank = True
        self.fields['sku'].default = ''

    def to_internal_value(self, data):
        mutable = data.copy()
        if 'organization' not in mutable or mutable.get('organization') in [None, '']:
            org = _ensure_org(self.context.get('request'))
            mutable['organization'] = getattr(org, 'id', org)
        if 'sku' not in mutable or mutable.get('sku') in [None]:
            mutable['sku'] = ''
        mutable['attribute_schema_override'] = _normalize_schema(mutable.get('attribute_schema_override'))
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        org = _ensure_org(self.context.get('request'))
        validated_data.setdefault('organization', org)

        sku = validated_data.get('sku')
        if not sku or str(sku).strip() == '':
            import uuid

            sku = f"SKU-{uuid.uuid4().hex[:6].upper()}"
        sku = str(sku).strip()
        base = sku
        counter = 1
        while Product.objects.filter(organization=validated_data.get('organization'), sku=sku).exists():
            sku = f"{base}-{counter}"
            counter += 1
        validated_data['sku'] = sku

        if not validated_data.get('name') or str(validated_data.get('name')).strip() == '':
            validated_data['name'] = sku

        for field in ['price', 'stock', 'reserved', 'reorder_point']:
            if validated_data.get(field) in [None, '']:
                validated_data[field] = 0

        validated_data['attribute_schema_override'] = _normalize_schema(validated_data.get('attribute_schema_override'))
        validated_data['attribute_values'] = dict(validated_data.get('attribute_values') or {})
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'attribute_schema_override' in validated_data:
            validated_data['attribute_schema_override'] = _normalize_schema(validated_data.get('attribute_schema_override'))
        if 'attribute_values' in validated_data:
            validated_data['attribute_values'] = dict(validated_data.get('attribute_values') or {})
        return super().update(instance, validated_data)

    def validate(self, attrs):
        org = attrs.get('organization') or _ensure_org(self.context.get('request'))
        sku = (attrs.get('sku') or '').strip()
        if sku:
            queryset = Product.objects.filter(organization=org, sku=sku)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({'sku': 'Ayni organizasyonda bu SKU zaten var'})
        return super().validate(attrs)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance.organization, Organization):
            data['organization'] = instance.organization.id
        data['category_name'] = instance.category.name if instance.category else ''
        data['category_template_defaults'] = instance.category.template_defaults if instance.category else {}
        data['category_attribute_schema'] = instance.category.attribute_schema if instance.category else []
        data['resolved_attribute_schema'] = _merge_attribute_schema(
            instance.category.attribute_schema if instance.category else [],
            instance.attribute_schema_override,
        )
        return data


class InvoicePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoicePayment
        fields = ['id', 'date', 'amount', 'method']


class InvoiceSerializer(serializers.ModelSerializer):
    payments = InvoicePaymentSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = ['id', 'number', 'customer_name', 'status', 'amount', 'currency', 'due_date', 'issued_at', 'payments']
        read_only_fields = ['number']

    def create(self, validated_data):
        payments = validated_data.pop('payments', [])
        invoice = Invoice.objects.create(**validated_data)
        for payment in payments:
            InvoicePayment.objects.create(invoice=invoice, **payment)
        return invoice

    def update(self, instance, validated_data):
        payments = validated_data.pop('payments', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if payments is not None:
            instance.payments.all().delete()
            for payment in payments:
                InvoicePayment.objects.create(invoice=instance, **payment)
        return instance


class SalesOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesOrder
        fields = '__all__'


class PurchaseOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrder
        fields = '__all__'


class StockMovementSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        required=False,
        allow_null=True,
        queryset=Organization.objects.all(),
        default=None,
    )

    class Meta:
        model = StockMovement
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False, 'allow_null': True},
            'product': {'required': False, 'allow_null': True},
        }

    def to_internal_value(self, data):
        mutable = data.copy()
        if 'organization' not in mutable or mutable.get('organization') in [None, '']:
            org = _ensure_org(self.context.get('request'))
            mutable['organization'] = getattr(org, 'id', org)
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        org = _ensure_org(self.context.get('request'))
        validated_data.setdefault('organization', org)
        product = validated_data.get('product')
        if not product:
            sku = None
            if self.context.get('request'):
                sku = self.context['request'].data.get('sku') or self.context['request'].data.get('product')
            if not sku:
                sku = validated_data.get('sku') or validated_data.get('product')
            if sku:
                sku = str(sku).strip()
                product = Product.objects.filter(organization=org, sku=sku).first()
                if not product:
                    product = Product.objects.create(
                        organization=org,
                        sku=sku,
                        name=sku,
                        price=0,
                        stock=0,
                        reserved=0,
                        reorder_point=0,
                    )
                validated_data['product'] = product
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance.organization, Organization):
            data['organization'] = instance.organization.id
        if isinstance(instance.product, Product):
            data['product'] = instance.product.id
        return data


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False},
            'name': {'required': False, 'allow_blank': True},
            'plate': {'required': False, 'allow_blank': True},
            'driver': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        org = self.context['request'].user.organization if self.context.get('request') else None
        if org:
            validated_data.setdefault('organization', org)
        plate = validated_data.get('plate')
        if not plate:
            import uuid

            validated_data['plate'] = f"PLT-{uuid.uuid4().hex[:6].upper()}"
        if not validated_data.get('name'):
            validated_data['name'] = validated_data['plate']
        return super().create(validated_data)
