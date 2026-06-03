from rest_framework import serializers

from .models import (
    ProductionDataField,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionDocument,
    ProductionEvent,
    ProductionRuleBlock,
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
from .services import make_device_token


class ProductionSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionSettings
        fields = '__all__'
        read_only_fields = ['organization', 'created_at', 'updated_at']


class ProductionDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionDepartment
        fields = '__all__'
        read_only_fields = ['organization']


class ProductionStationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = ProductionStation
        fields = '__all__'
        read_only_fields = ['organization', 'department_name']


class ProductionStationUserSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionStationUser
        fields = '__all__'
        read_only_fields = ['organization', 'station_code', 'user_name', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class ProductionDeviceSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)

    class Meta:
        model = ProductionDevice
        fields = '__all__'
        read_only_fields = ['organization', 'token', 'station_code', 'last_seen_at', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data.setdefault('token', make_device_token())
        return super().create(validated_data)


class ProductionDataFieldSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)

    class Meta:
        model = ProductionDataField
        fields = '__all__'
        read_only_fields = ['organization', 'station_code']


class ProductionDevicePayloadMapSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    station_code = serializers.CharField(source='station.code', read_only=True)
    data_field_label = serializers.CharField(source='data_field.label', read_only=True)

    class Meta:
        model = ProductionDevicePayloadMap
        fields = '__all__'
        read_only_fields = ['organization', 'device_name', 'station_code', 'data_field_label']


class ProductionRouteStepSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)
    department_name = serializers.CharField(source='station.department.name', read_only=True)

    class Meta:
        model = ProductionRouteStep
        fields = ['id', 'route', 'station', 'station_code', 'station_name', 'department_name', 'order', 'is_required']


class ProductionRouteTemplateSerializer(serializers.ModelSerializer):
    steps = ProductionRouteStepSerializer(many=True, read_only=True)
    step_inputs = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = ProductionRouteTemplate
        fields = '__all__'
        read_only_fields = ['organization', 'created_at', 'updated_at', 'steps']

    def _save_steps(self, route, step_rows):
        if step_rows is None:
            return
        if route.steps.filter(progress_rows__isnull=False).exists():
            raise serializers.ValidationError({'step_inputs': 'Uzerinde is emri ilerlemesi olan rota adimlari degistirilemez.'})
        route.steps.all().delete()
        for idx, row in enumerate(step_rows):
            station_id = row.get('station') or row.get('station_id')
            if not station_id:
                continue
            station = ProductionStation.objects.get(organization=route.organization, pk=station_id)
            ProductionRouteStep.objects.create(
                route=route,
                station=station,
                order=row.get('order', idx),
                is_required=row.get('is_required', True),
            )

    def create(self, validated_data):
        step_rows = validated_data.pop('step_inputs', None)
        route = super().create(validated_data)
        self._save_steps(route, step_rows)
        return route

    def update(self, instance, validated_data):
        step_rows = validated_data.pop('step_inputs', None)
        route = super().update(instance, validated_data)
        self._save_steps(route, step_rows)
        return route


class ProductionRuleBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionRuleBlock
        fields = '__all__'
        read_only_fields = ['organization']


class ProductionRuleSetSerializer(serializers.ModelSerializer):
    blocks = ProductionRuleBlockSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionRuleSet
        fields = '__all__'
        read_only_fields = ['organization', 'created_at', 'blocks']


class ProductionTemplatePresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionTemplatePreset
        fields = ['id', 'key', 'name', 'description', 'payload', 'is_active', 'created_at', 'updated_at']
        read_only_fields = fields


class ProductionStepProgressSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)
    department_name = serializers.CharField(source='station.department.name', read_only=True)
    department_color = serializers.CharField(source='station.department.color', read_only=True)

    class Meta:
        model = ProductionStepProgress
        fields = [
            'id',
            'line',
            'route_step',
            'station',
            'station_code',
            'station_name',
            'department_name',
            'department_color',
            'order',
            'target_quantity',
            'completed_quantity',
            'machine_quantity',
            'status',
            'started_at',
            'completed_at',
            'completed_by',
        ]
        read_only_fields = fields


class ProductionWorkOrderLineSerializer(serializers.ModelSerializer):
    steps = ProductionStepProgressSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionWorkOrderLine
        fields = '__all__'
        read_only_fields = ['completed_quantity', 'stock_in_done', 'stock_in_movement_id', 'steps']


class ProductionWorkOrderSerializer(serializers.ModelSerializer):
    lines = ProductionWorkOrderLineSerializer(many=True, read_only=True)
    route_name = serializers.CharField(source='route.name', read_only=True)

    class Meta:
        model = ProductionWorkOrder
        fields = '__all__'
        read_only_fields = [
            'organization',
            'number',
            'source_type',
            'source_id',
            'source_number',
            'route_name',
            'created_by',
            'created_at',
            'updated_at',
            'lines',
        ]


class ProductionEventSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True)
    product_name = serializers.CharField(source='line.product_name', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionEvent
        fields = '__all__'
        read_only_fields = [
            'id',
            'organization',
            'work_order',
            'line',
            'step',
            'station',
            'session',
            'event_type',
            'quantity_delta',
            'counter_value',
            'note',
            'idempotency_key',
            'source',
            'device',
            'user',
            'raw_payload',
            'normalized_payload',
            'mapping_errors',
            'created_at',
        ]

    def get_user_name(self, obj):
        if not obj.user:
            return ''
        return obj.user.get_full_name() or obj.user.username


class ProductionWorkSessionSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True)
    product_sku = serializers.CharField(source='line.product_sku', read_only=True)
    product_name = serializers.CharField(source='line.product_name', read_only=True)
    user_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionWorkSession
        fields = '__all__'
        read_only_fields = [
            'organization',
            'work_order',
            'line',
            'step',
            'station',
            'user',
            'previous_session',
            'status',
            'started_at',
            'ended_at',
            'machine_quantity',
            'declared_good_quantity',
            'discrepancy_quantity',
            'discrepancy_status',
            'reviewed_by',
            'reviewed_at',
            'created_at',
            'updated_at',
            'station_code',
            'station_name',
            'work_order_number',
            'product_sku',
            'product_name',
            'user_name',
            'reviewed_by_name',
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return ''
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username


class ProductionDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionDocument
        fields = '__all__'
        read_only_fields = ['organization', 'uploaded_by', 'uploaded_at']


class SessionStartSerializer(serializers.Serializer):
    line_id = serializers.IntegerField()
    station_code = serializers.CharField()
    start_counter = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class SessionStateSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, default='')


class SessionCloseSerializer(SessionStateSerializer):
    declared_good_quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    end_counter = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)


class SessionReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approved', 'corrected'])
    corrected_good_quantity = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class StationEventSerializer(serializers.Serializer):
    line_id = serializers.IntegerField()
    station_code = serializers.CharField()
    event_type = serializers.ChoiceField(choices=[item[0] for item in ProductionEvent.EVENT_TYPES])
    quantity_delta = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=0)
    counter_value = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default='')
    idempotency_key = serializers.CharField(required=False, allow_blank=True, default='')


class PiEventSerializer(StationEventSerializer):
    token = serializers.CharField()
    line_id = serializers.IntegerField(required=False)
    station_code = serializers.CharField(required=False, allow_blank=True)
    event_type = serializers.ChoiceField(choices=[item[0] for item in ProductionEvent.EVENT_TYPES], required=False)
