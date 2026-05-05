from rest_framework import serializers

from .models import MdfMovement, MdfSku


class MdfSkuSerializer(serializers.ModelSerializer):
    class Meta:
        model = MdfSku
        fields = ['id', 'thickness_mm', 'width_cm', 'height_cm', 'min_threshold', 'quantity', 'created_at', 'updated_at']
        read_only_fields = ['id', 'quantity', 'created_at', 'updated_at']


class MdfSkuThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = MdfSku
        fields = ['min_threshold']


class MdfStockInSerializer(serializers.Serializer):
    thickness_mm = serializers.IntegerField(min_value=1, max_value=999)
    width_cm = serializers.IntegerField(min_value=1, max_value=9999)
    height_cm = serializers.IntegerField(min_value=1, max_value=9999)
    quantity = serializers.IntegerField(min_value=1, max_value=1_000_000)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    movement_date = serializers.DateField(required=False)


class MdfStockOutSerializer(serializers.Serializer):
    sku = serializers.PrimaryKeyRelatedField(queryset=MdfSku.objects.all())
    movement_date = serializers.DateField()
    quantity = serializers.IntegerField(min_value=1, max_value=1_000_000)
    usage = serializers.CharField(required=False, allow_blank=True, max_length=500)


class MdfMovementSerializer(serializers.ModelSerializer):
    thickness_mm = serializers.IntegerField(source='sku.thickness_mm', read_only=True)
    width_cm = serializers.IntegerField(source='sku.width_cm', read_only=True)
    height_cm = serializers.IntegerField(source='sku.height_cm', read_only=True)

    class Meta:
        model = MdfMovement
        fields = [
            'id',
            'kind',
            'quantity',
            'movement_date',
            'note',
            'thickness_mm',
            'width_cm',
            'height_cm',
            'created_at',
        ]
