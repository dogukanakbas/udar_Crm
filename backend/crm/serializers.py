from rest_framework import serializers
from .models import Quote, QuoteLine, PricingRule, BusinessPartner, Lead, Opportunity, Contact
from erp.models import Product


class BusinessPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessPartner
        fields = '__all__'
        extra_kwargs = {
            'organization': {'required': False},
            'name': {'required': False, 'allow_blank': True},
            'group': {'required': False, 'allow_blank': True},
            'city': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
        }


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
            # mevcut bir partner yoksa default bir partner oluştur
            from crm.models import BusinessPartner
            company = BusinessPartner.objects.filter(organization=org).first()
            if not company:
                company = BusinessPartner.objects.create(organization=org, name='Default Partner')
            validated_data['company'] = company
        if org:
            validated_data['organization'] = org
        return super().create(validated_data)


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
            'stock': {'required': False},
            'reserved': {'required': False},
            'reorder_point': {'required': False},
            'category': {'required': False, 'allow_null': True},
        }


class QuoteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteLine
        fields = ['id', 'product', 'name', 'qty', 'unit_price', 'discount', 'tax']


class QuoteSerializer(serializers.ModelSerializer):
    lines = QuoteLineSerializer(many=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'number', 'customer', 'opportunity', 'owner', 'status', 'valid_until',
            'subtotal', 'discount_total', 'tax_total', 'total', 'currency',
            'payment_terms', 'delivery_terms', 'notes', 'lines', 'created_at', 'updated_at',
        ]
        read_only_fields = ['number', 'subtotal', 'discount_total', 'tax_total', 'total']

    def to_internal_value(self, data):
        # frontend gönderdiği alternatif alan adlarını normalize et
        mutable = data.copy()
        # customerId -> customer
        if 'customerId' in mutable and 'customer' not in mutable:
            mutable['customer'] = mutable.pop('customerId')
        # validUntil -> valid_until
        if 'validUntil' in mutable:
            mutable['valid_until'] = mutable.pop('validUntil')
        # payment/delivery -> payment_terms/delivery_terms
        if 'payment' in mutable:
            mutable['payment_terms'] = mutable.pop('payment')
        if 'delivery' in mutable:
            mutable['delivery_terms'] = mutable.pop('delivery')
        # lines normalize
        lines = mutable.get('lines', [])
        normalized_lines = []
        for line in lines:
            if not line:
                continue
            normalized_lines.append({
                'product': line.get('product') or line.get('productId'),
                'name': line.get('name') or line.get('productName') or 'Satır',
                'qty': line.get('qty') or line.get('quantity') or 1,
                'unit_price': line.get('unit_price') or line.get('unitPrice') or 0,
                'discount': line.get('discount') or 0,
                'tax': line.get('tax') or 0,
            })
        mutable['lines'] = normalized_lines
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        # customer yoksa org içindeki ilk partneri ata/oluştur
        org = validated_data.get('organization') or (self.context.get('request').user.organization if self.context.get('request') else None)
        if not validated_data.get('customer') and org:
            from crm.models import BusinessPartner
            customer = BusinessPartner.objects.filter(organization=org).first()
            if not customer:
                customer = BusinessPartner.objects.create(organization=org, name='Default Customer')
            validated_data['customer'] = customer
        # owner boşsa giriş yapan kullanıcıyı ata
        if not validated_data.get('owner') and self.context.get('request'):
            validated_data['owner'] = self.context['request'].user
        if org:
            validated_data.setdefault('organization', org)
        quote = Quote.objects.create(**validated_data)
        self._create_lines(quote, lines_data)
        self._recalc(quote)
        return quote

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            self._create_lines(instance, lines_data)
        self._recalc(instance)
        return instance

    def _create_lines(self, quote, lines_data):
        for line in lines_data:
            QuoteLine.objects.create(quote=quote, **line)

    def _recalc(self, quote):
        org = quote.organization
        rules = PricingRule.objects.filter(organization=org)
        subtotal = sum([l.qty * l.unit_price for l in quote.lines.all()])
        discount = sum([(l.qty * l.unit_price) * (l.discount / 100) for l in quote.lines.all()])
        # apply pricing rules
        for line in quote.lines.all():
            base = line.qty * line.unit_price
            # category rule
            if line.product and line.product.category:
                for r in rules.filter(type='category', target=line.product.category.name):
                    discount += base * (r.value / 100)
        # customer rules (by group)
        partner_group = quote.customer.group if quote.customer else None
        if partner_group:
            for r in rules.filter(type='customer', target=partner_group):
                discount += subtotal * (r.value / 100)
        # volume rules
        for r in rules.filter(type='volume'):
            try:
                threshold = float(r.target)
            except Exception:
                threshold = 0
            if subtotal >= threshold:
                discount += subtotal * (r.value / 100)

        tax = (subtotal - discount) * 0.18
        quote.subtotal = subtotal
        quote.discount_total = discount
        quote.tax_total = tax
        quote.total = subtotal - discount + tax
        quote.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'total'])


class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = '__all__'

