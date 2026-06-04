from rest_framework import serializers

from organizations.models import Organization
from accounts.price_lists import normalize_product_price_lists

from organizations.models import Warehouse
from .inventory_service import resolve_product_details
from .models import (
    Category,
    InventoryLocation,
    Invoice,
    InvoicePayment,
    Product,
    ProductTechnicalDrawing,
    PurchaseOrder,
    SalesOrder,
    StockMovement,
    TechnicalDrawingFolder,
    Vehicle,
    WarehouseStock,
)


def technical_drawing_summary_queryset(product):
    return product.technical_drawings.filter(is_active=True).order_by('-uploaded_at', '-id')


def serialize_technical_drawing_summary(row, request=None):
    file_url = row.file.url if row.file else ''
    if request and file_url:
        file_url = request.build_absolute_uri(file_url)
    return {
        'id': row.id,
        'product': row.product_id,
        'product_sku': getattr(row.product, 'sku', ''),
        'product_name': getattr(row.product, 'name', ''),
        'folder': row.folder_id,
        'folder_name': row.folder.name if row.folder else '',
        'title': row.title,
        'version': row.version,
        'tags': row.tags or [],
        'description': row.description,
        'file': file_url,
        'file_url': file_url,
        'file_type': row.file_type,
        'original_filename': row.original_filename,
        'is_active': row.is_active,
        'uploaded_at': row.uploaded_at,
    }


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
    technical_drawing_count = serializers.SerializerMethodField()
    technical_drawings = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
        validators = []
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
            'name': {'required': False, 'allow_blank': True},
            'price': {'required': False},
            'price_lists': {'required': False},
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

    def get_technical_drawing_count(self, obj):
        return technical_drawing_summary_queryset(obj).count()

    def get_technical_drawings(self, obj):
        request = self.context.get('request')
        return [
            serialize_technical_drawing_summary(row, request)
            for row in technical_drawing_summary_queryset(obj).select_related('product', 'folder')[:5]
        ]

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

        validated_data['price_lists'] = normalize_product_price_lists(
            validated_data.get('price_lists'),
            validated_data.get('price'),
        )
        validated_data['attribute_schema_override'] = _normalize_schema(validated_data.get('attribute_schema_override'))
        validated_data['attribute_values'] = dict(validated_data.get('attribute_values') or {})
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if instance.inventory_mode == 'warehouse':
            validated_data.pop('stock', None)
        if 'price_lists' in validated_data or 'price' in validated_data:
            validated_data['price_lists'] = normalize_product_price_lists(
                validated_data.get('price_lists', instance.price_lists),
                validated_data.get('price', instance.price),
            )
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
        data['price_lists'] = normalize_product_price_lists(instance.price_lists, instance.price)
        data['technical_drawing_count'] = self.get_technical_drawing_count(instance)
        data['technical_drawings'] = self.get_technical_drawings(instance)
        data['resolved_attribute_schema'] = _merge_attribute_schema(
            instance.category.attribute_schema if instance.category else [],
            instance.attribute_schema_override,
        )
        return data


class TechnicalDrawingFolderSerializer(serializers.ModelSerializer):
    drawing_count = serializers.SerializerMethodField()

    class Meta:
        model = TechnicalDrawingFolder
        fields = '__all__'
        read_only_fields = ['organization', 'drawing_count']

    def get_drawing_count(self, obj):
        return obj.drawings.filter(is_active=True).count()


class ProductTechnicalDrawingSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True, default='')
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductTechnicalDrawing
        fields = '__all__'
        read_only_fields = [
            'organization',
            'uploaded_by',
            'uploaded_at',
            'updated_at',
            'file_type',
            'original_filename',
            'product_sku',
            'product_name',
            'folder_name',
            'file_url',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org = _ensure_org(self.context.get('request'))
        self.fields['product'].queryset = Product.objects.filter(organization=org)
        self.fields['folder'].queryset = TechnicalDrawingFolder.objects.filter(organization=org)

    def get_file_url(self, obj):
        if not obj.file:
            return ''
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def validate_tags(self, value):
        if value in [None, '']:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(',') if item.strip()]
        if isinstance(value, list):
            return [str(item or '').strip() for item in value if str(item or '').strip()]
        raise serializers.ValidationError('Etiketler liste veya virgüllü metin olmalıdır.')

    def validate_file(self, value):
        extension = (getattr(value, 'name', '') or '').rsplit('.', 1)[-1].lower()
        if extension not in {'png', 'jpg', 'jpeg'}:
            raise serializers.ValidationError('Teknik resim yalnız PNG veya JPG formatında yüklenebilir.')
        return value

    def _apply_uploaded_file_metadata(self, validated_data):
        uploaded = validated_data.get('file')
        if uploaded:
            validated_data['original_filename'] = getattr(uploaded, 'name', '') or ''
            validated_data['file_type'] = 'image'
        if not validated_data.get('title'):
            validated_data['title'] = validated_data.get('original_filename') or 'Teknik resim'
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_uploaded_file_metadata(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_uploaded_file_metadata(validated_data))


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


class WarehouseSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    stock_total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    location_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Warehouse
        fields = '__all__'
        extra_kwargs = {'organization': {'required': False}}

    def to_internal_value(self, data):
        mutable = data.copy()
        org = _ensure_org(self.context.get('request'))
        mutable['organization'] = getattr(org, 'id', org)
        return super().to_internal_value(mutable)


class InventoryLocationSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = InventoryLocation
        fields = '__all__'
        extra_kwargs = {'organization': {'required': False}}

    def to_internal_value(self, data):
        mutable = data.copy()
        org = _ensure_org(self.context.get('request'))
        mutable['organization'] = getattr(org, 'id', org)
        return super().to_internal_value(mutable)

    def validate(self, attrs):
        warehouse = attrs.get('warehouse') or getattr(self.instance, 'warehouse', None)
        org = getattr(getattr(self.context.get('request'), 'user', None), 'organization', None)
        if warehouse and org and warehouse.organization_id != org.id:
            raise serializers.ValidationError({'warehouse': 'Depo bu organizasyona ait değil.'})
        return attrs


class WarehouseStockSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True, default='')
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    location_code = serializers.CharField(source='location.code', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    detail_1 = serializers.SerializerMethodField()
    detail_2 = serializers.SerializerMethodField()

    class Meta:
        model = WarehouseStock
        fields = '__all__'
        read_only_fields = ['organization', 'warehouse', 'location', 'product', 'quantity', 'updated_at']

    def get_detail_1(self, instance):
        return instance.detail_1_override or resolve_product_details(instance.product)[0]

    def get_detail_2(self, instance):
        return instance.detail_2_override or resolve_product_details(instance.product)[1]


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
