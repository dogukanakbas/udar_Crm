from rest_framework import serializers

from .models import Category, Product, Invoice, InvoicePayment, SalesOrder, PurchaseOrder, StockMovement, Vehicle
from organizations.models import Organization


def _ensure_org(request):
    org = getattr(getattr(request, 'user', None), 'organization', None) if request else None
    if org:
        return org
    org = Organization.objects.first()
    if not org:
        org = Organization.objects.create(name='Default Org')
    return org


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


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
        validators = []  # skip unique_together validation; handled manually
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
            'name': {'required': False, 'allow_blank': True},
            'price': {'required': False},
            'stock': {'required': False},
            'reserved': {'required': False},
            'reorder_point': {'required': False},
            'organization': {'required': False, 'allow_null': True},
            'category': {'required': False, 'allow_null': True},
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
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        org = _ensure_org(self.context.get('request'))
        validated_data.setdefault('organization', org)

        # boş/dup SKU için güvenli üretim
        sku = validated_data.get('sku')
        if not sku or str(sku).strip() == '':
            import uuid
            sku = f"SKU-{uuid.uuid4().hex[:6].upper()}"
        sku = str(sku).strip()
        # eşsiz yap
        base = sku
        counter = 1
        while Product.objects.filter(organization=validated_data.get('organization'), sku=sku).exists():
            sku = f"{base}-{counter}"
            counter += 1
        validated_data['sku'] = sku

        name = validated_data.get('name')
        if not name or str(name).strip() == '':
            validated_data['name'] = sku

        # sayısal alanları default 0'a çek
        for field in ['price', 'stock', 'reserved', 'reorder_point']:
            if validated_data.get(field) in [None, '']:
                validated_data[field] = 0

        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance.organization, Organization):
            data['organization'] = instance.organization.id
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
        for p in payments:
            InvoicePayment.objects.create(invoice=invoice, **p)
        return invoice

    def update(self, instance, validated_data):
        payments = validated_data.pop('payments', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if payments is not None:
            instance.payments.all().delete()
            for p in payments:
                InvoicePayment.objects.create(invoice=instance, **p)
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

        # product yoksa sku ile bul veya oluştur
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

