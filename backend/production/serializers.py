from pathlib import Path

from rest_framework import serializers

from accounts.utils import user_has_any_perm
from erp.serializers import serialize_technical_drawing_summary, technical_drawing_summary_queryset

from .models import (
    ProductionDataField,
    ProductionCountingParticipant,
    ProductionCountingWindow,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionDocument,
    ProductionEvent,
    ProductRecipe,
    ProductRecipeMaterial,
    ProductRecipeOperation,
    ProductionMaterialConsumption,
    ProductionMaterialRequirement,
    ProductionOperatorProfile,
    ProductionRuleBlock,
    ProductionRuleSet,
    ProductionRouteStep,
    ProductionRouteTemplate,
    ProductionReportTemplate,
    ProductionSettings,
    ProductionSessionBreak,
    ProductionShiftBreak,
    ProductionShiftCheckpoint,
    ProductionShiftOccurrence,
    ProductionShiftSchedule,
    ProductionStation,
    ProductionStationTarget,
    ProductionStationAlert,
    ProductionStationAlertAck,
    ProductionStationTablet,
    ProductionStationUser,
    ProductionStepProgress,
    ProductionStepTabletAssignment,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
    ProductionWorkSession,
)
from .services import make_device_token


PRODUCTION_OPERATOR_PERMISSIONS = ('production.view', 'production.tablet.operate', 'production.station.operate')


def validate_production_operator_user(user):
    if not user_has_any_perm(user, PRODUCTION_OPERATOR_PERMISSIONS):
        raise serializers.ValidationError('Kullanıcı üretim/tablet kullanım iznine sahip değil.')
    return user


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


class ProductionReportTemplateSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductionReportTemplate
        fields = '__all__'
        read_only_fields = ['organization', 'created_by', 'created_at', 'updated_at', 'file_url']

    def get_file_url(self, obj):
        if not obj.file:
            return ''
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def validate_file(self, value):
        extension = Path(getattr(value, 'name', '') or '').suffix.lower()
        if extension not in {'.xlsx', '.xltx'}:
            raise serializers.ValidationError('Yalnızca .xlsx veya .xltx Excel şablonu yükleyebilirsiniz.')
        return value


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

    def validate_user(self, user):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        if organization and getattr(user, 'organization_id', None) != organization.id:
            raise serializers.ValidationError('Kullanıcı bu organizasyona ait değil.')
        return validate_production_operator_user(user)


class ProductionDeviceSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)

    class Meta:
        model = ProductionDevice
        fields = '__all__'
        read_only_fields = ['organization', 'token', 'station_code', 'last_seen_at', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data.setdefault('token', make_device_token())
        return super().create(validated_data)


class ProductionOperatorProfileSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_pin = serializers.SerializerMethodField()

    class Meta:
        model = ProductionOperatorProfile
        fields = ['id', 'organization', 'user', 'user_name', 'pin', 'has_pin', 'is_active', 'last_pin_change_at', 'updated_at']
        read_only_fields = ['organization', 'user_name', 'has_pin', 'last_pin_change_at', 'updated_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_has_pin(self, obj):
        return bool(obj.pin_hash)

    def validate_user(self, user):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        if organization and getattr(user, 'organization_id', None) != organization.id:
            raise serializers.ValidationError('Kullanıcı bu organizasyona ait değil.')
        return validate_production_operator_user(user)

    def create(self, validated_data):
        raw_pin = validated_data.pop('pin', '')
        obj = super().create(validated_data)
        if raw_pin:
            obj.set_pin(raw_pin)
            obj.save(update_fields=['pin_hash', 'last_pin_change_at', 'updated_at'])
        return obj

    def update(self, instance, validated_data):
        raw_pin = validated_data.pop('pin', '')
        obj = super().update(instance, validated_data)
        if raw_pin:
            obj.set_pin(raw_pin)
            obj.save(update_fields=['pin_hash', 'last_pin_change_at', 'updated_at'])
        return obj


class ProductionStationTabletSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)

    class Meta:
        model = ProductionStationTablet
        fields = '__all__'
        read_only_fields = ['organization', 'token', 'station_code', 'station_name', 'last_seen_at', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data.setdefault('token', make_device_token())
        return super().create(validated_data)

    def validate_station(self, station):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        if organization and getattr(station, 'organization_id', None) != organization.id:
            raise serializers.ValidationError('İstasyon bu organizasyona ait değil.')
        return station


class ProductionStationTargetSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)

    class Meta:
        model = ProductionStationTarget
        fields = '__all__'
        read_only_fields = ['organization', 'station_code', 'station_name', 'created_at', 'updated_at']

    def validate_station(self, station):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        if organization and station.organization_id != organization.id:
            raise serializers.ValidationError('İstasyon bu organizasyona ait değil.')
        return station


class ProductionShiftScheduleSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = ProductionShiftSchedule
        fields = '__all__'
        read_only_fields = ['organization', 'department_name', 'created_at', 'updated_at']

    def validate_department(self, department):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        if organization and department.organization_id != organization.id:
            raise serializers.ValidationError('Bölüm bu organizasyona ait değil.')
        return department

    def validate_weekdays(self, value):
        rows = value or []
        clean = []
        for item in rows:
            day = int(item)
            if day < 0 or day > 6:
                raise serializers.ValidationError('Hafta günü 0-6 arasında olmalı.')
            if day not in clean:
                clean.append(day)
        return clean


class ProductionShiftBreakSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    schedule_name = serializers.CharField(source='schedule.name', read_only=True)

    class Meta:
        model = ProductionShiftBreak
        fields = '__all__'
        read_only_fields = ['organization', 'department_name', 'schedule_name', 'created_at', 'updated_at']

    def validate(self, attrs):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        department = attrs.get('department') or getattr(self.instance, 'department', None)
        schedule = attrs.get('schedule') or getattr(self.instance, 'schedule', None)
        if organization and department and department.organization_id != organization.id:
            raise serializers.ValidationError({'department': 'Bölüm bu organizasyona ait değil.'})
        if schedule:
            if organization and schedule.organization_id != organization.id:
                raise serializers.ValidationError({'schedule': 'Vardiya bu organizasyona ait değil.'})
            if department and schedule.department_id != department.id:
                raise serializers.ValidationError({'schedule': 'Vardiya aynı bölüme ait olmalı.'})
        return attrs


class ProductionShiftOccurrenceSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    schedule_name = serializers.CharField(source='schedule.name', read_only=True)

    class Meta:
        model = ProductionShiftOccurrence
        fields = '__all__'
        read_only_fields = fields


class ProductionShiftCheckpointSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    tablet_name = serializers.CharField(source='tablet.name', read_only=True)
    shift_name = serializers.CharField(source='occurrence.name', read_only=True)
    break_name = serializers.CharField(source='break_row.name', read_only=True)

    class Meta:
        model = ProductionShiftCheckpoint
        fields = '__all__'
        read_only_fields = fields


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
        fields = ['id', 'route', 'station', 'station_code', 'station_name', 'department_name', 'order', 'is_required', 'start_policy']


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
                start_policy=row.get('start_policy') or 'after_previous',
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
    start_policy = serializers.CharField(source='route_step.start_policy', read_only=True)
    assigned_tablets = serializers.SerializerMethodField()

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
            'start_policy',
            'assigned_tablets',
        ]
        read_only_fields = fields

    def get_assigned_tablets(self, obj):
        return [
            {
                'id': row.id,
                'tablet': row.tablet_id,
                'tablet_name': row.tablet.name,
                'priority': row.priority,
                'is_pinned': row.is_pinned,
                'note': row.note,
            }
            for row in obj.tablet_assignments.all()
        ]


class ProductionStepTabletAssignmentSerializer(serializers.ModelSerializer):
    tablet_name = serializers.CharField(source='tablet.name', read_only=True)
    tablet_station = serializers.CharField(source='tablet.station.code', read_only=True)
    step_station = serializers.CharField(source='step.station.code', read_only=True)
    work_order_number = serializers.CharField(source='step.line.work_order.number', read_only=True)
    product_name = serializers.CharField(source='step.line.product_name', read_only=True)

    class Meta:
        model = ProductionStepTabletAssignment
        fields = '__all__'
        read_only_fields = ['organization', 'created_at', 'tablet_name', 'tablet_station', 'step_station', 'work_order_number', 'product_name']

    def validate(self, attrs):
        request = self.context.get('request')
        organization = getattr(getattr(request, 'user', None), 'organization', None)
        step = attrs.get('step') or getattr(self.instance, 'step', None)
        tablet = attrs.get('tablet') or getattr(self.instance, 'tablet', None)
        if organization:
            if step and step.line.work_order.organization_id != organization.id:
                raise serializers.ValidationError({'step': 'İş adımı bu organizasyona ait değil.'})
            if tablet and tablet.organization_id != organization.id:
                raise serializers.ValidationError({'tablet': 'Tablet bu organizasyona ait değil.'})
        if step and tablet and step.station_id != tablet.station_id:
            raise serializers.ValidationError({'tablet': 'Tablet, iş adımının istasyonuna bağlı olmalı.'})
        return attrs


class ProductionWorkOrderLineSerializer(serializers.ModelSerializer):
    steps = ProductionStepProgressSerializer(many=True, read_only=True)
    technical_drawings = serializers.SerializerMethodField()
    material_requirements = serializers.SerializerMethodField()

    class Meta:
        model = ProductionWorkOrderLine
        fields = '__all__'
        read_only_fields = ['completed_quantity', 'stock_in_done', 'stock_in_movement_id', 'steps']

    def get_technical_drawings(self, obj):
        if not obj.product_id:
            return []
        request = self.context.get('request')
        return [
            serialize_technical_drawing_summary(row, request)
            for row in technical_drawing_summary_queryset(obj.product).select_related('product', 'folder')[:10]
        ]

    def get_material_requirements(self, obj):
        rows = obj.material_requirements.select_related('station', 'material_product', 'default_location__warehouse').order_by('station__order', 'id')[:50]
        return ProductionMaterialRequirementSerializer(rows, many=True, context=self.context).data


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


class ProductRecipeSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    operations = serializers.SerializerMethodField()

    class Meta:
        model = ProductRecipe
        fields = '__all__'
        read_only_fields = ['organization', 'published_by', 'published_at', 'created_by', 'created_at', 'updated_at', 'product_sku', 'product_name', 'operations']

    def validate(self, attrs):
        org = getattr(getattr(self.context.get('request'), 'user', None), 'organization', None)
        product = attrs.get('product') or getattr(self.instance, 'product', None)
        if org and product and product.organization_id != org.id:
            raise serializers.ValidationError({'product': 'Ürün bu organizasyona ait değil.'})
        return attrs

    def get_operations(self, obj):
        return ProductRecipeOperationSerializer(
            obj.operations.select_related('station__department').prefetch_related('materials__material_product', 'materials__default_location__warehouse').all(),
            many=True,
            context=self.context,
        ).data


class ProductRecipeOperationSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)
    department_name = serializers.CharField(source='station.department.name', read_only=True)
    materials = serializers.SerializerMethodField()

    class Meta:
        model = ProductRecipeOperation
        fields = '__all__'
        read_only_fields = ['organization', 'station_code', 'station_name', 'department_name', 'materials']

    def get_materials(self, obj):
        return ProductRecipeMaterialSerializer(
            obj.materials.select_related('material_product', 'default_location__warehouse').all(),
            many=True,
            context=self.context,
        ).data

    def validate(self, attrs):
        org = getattr(getattr(self.context.get('request'), 'user', None), 'organization', None)
        recipe = attrs.get('recipe') or getattr(self.instance, 'recipe', None)
        station = attrs.get('station') or getattr(self.instance, 'station', None)
        if org and recipe and recipe.organization_id != org.id:
            raise serializers.ValidationError({'recipe': 'Reçete bu organizasyona ait değil.'})
        if org and station and station.organization_id != org.id:
            raise serializers.ValidationError({'station': 'İstasyon bu organizasyona ait değil.'})
        return attrs


class ProductRecipeMaterialSerializer(serializers.ModelSerializer):
    material_sku = serializers.CharField(source='material_product.sku', read_only=True)
    material_name = serializers.CharField(source='material_product.name', read_only=True)
    operation_station = serializers.CharField(source='operation.station.code', read_only=True)
    recipe = serializers.IntegerField(source='operation.recipe_id', read_only=True)
    default_location_label = serializers.SerializerMethodField()

    class Meta:
        model = ProductRecipeMaterial
        fields = '__all__'
        read_only_fields = ['organization', 'material_sku', 'material_name', 'operation_station', 'recipe', 'default_location_label']

    def validate(self, attrs):
        org = getattr(getattr(self.context.get('request'), 'user', None), 'organization', None)
        operation = attrs.get('operation') or getattr(self.instance, 'operation', None)
        material_product = attrs.get('material_product') or getattr(self.instance, 'material_product', None)
        default_location = attrs.get('default_location') or getattr(self.instance, 'default_location', None)
        if org and operation and operation.organization_id != org.id:
            raise serializers.ValidationError({'operation': 'Operasyon bu organizasyona ait değil.'})
        if org and material_product and material_product.organization_id != org.id:
            raise serializers.ValidationError({'material_product': 'Ham madde ürünü bu organizasyona ait değil.'})
        if org and default_location and default_location.organization_id != org.id:
            raise serializers.ValidationError({'default_location': 'Depo/raf bu organizasyona ait değil.'})
        if (attrs.get('quantity_type') or getattr(self.instance, 'quantity_type', 'fixed')) == 'formula':
            formula = attrs.get('formula') if 'formula' in attrs else getattr(self.instance, 'formula', '')
            if not formula:
                raise serializers.ValidationError({'formula': 'Formül tipi seçildiğinde formül zorunludur.'})
        return attrs

    def get_default_location_label(self, obj):
        if not obj.default_location:
            return ''
        warehouse = obj.default_location.warehouse
        return f'{warehouse.code} / {obj.default_location.code}{(" - " + obj.default_location.name) if obj.default_location.name else ""}'


class ProductionMaterialRequirementSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)
    location_label = serializers.SerializerMethodField()
    remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = ProductionMaterialRequirement
        fields = '__all__'
        read_only_fields = ['organization', 'work_order', 'line', 'step', 'station_code', 'station_name', 'location_label', 'remaining_quantity', 'created_at']

    def get_location_label(self, obj):
        if not obj.default_location:
            return ''
        warehouse = obj.default_location.warehouse
        return f'{warehouse.code} / {obj.default_location.code}{(" - " + obj.default_location.name) if obj.default_location.name else ""}'

    def get_remaining_quantity(self, obj):
        return max(obj.planned_quantity - obj.consumed_quantity, 0)


class ProductionMaterialConsumptionSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True)
    product_name = serializers.CharField(source='line.product_name', read_only=True)
    material_sku = serializers.CharField(source='material_product.sku', read_only=True)
    material_name = serializers.CharField(source='material_product.name', read_only=True)
    location_label = serializers.SerializerMethodField()

    class Meta:
        model = ProductionMaterialConsumption
        fields = '__all__'
        read_only_fields = ['organization', 'stock_movement_id', 'created_at', 'station_code', 'work_order_number', 'product_name', 'material_sku', 'material_name', 'location_label']

    def get_location_label(self, obj):
        warehouse = obj.location.warehouse
        return f'{warehouse.code} / {obj.location.code}{(" - " + obj.location.name) if obj.location.name else ""}'


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
    break_seconds = serializers.SerializerMethodField()
    active_break_id = serializers.SerializerMethodField()
    active_break_started_at = serializers.SerializerMethodField()

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
            'break_seconds',
            'active_break_id',
            'active_break_started_at',
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return ''
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def get_break_seconds(self, obj):
        return sum(item.duration_seconds for item in obj.breaks.all()) if hasattr(obj, '_prefetched_objects_cache') and 'breaks' in obj._prefetched_objects_cache else sum(item.duration_seconds for item in obj.breaks.all())

    def get_active_break_id(self, obj):
        active = obj.breaks.filter(ended_at__isnull=True).order_by('-started_at', '-id').first()
        return active.id if active else None

    def get_active_break_started_at(self, obj):
        active = obj.breaks.filter(ended_at__isnull=True).order_by('-started_at', '-id').first()
        return active.started_at if active else None


class ProductionSessionBreakSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionSessionBreak
        fields = '__all__'
        read_only_fields = ['organization', 'user', 'started_at', 'ended_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class ProductionCountingParticipantSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionCountingParticipant
        fields = '__all__'
        read_only_fields = fields

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class ProductionCountingWindowSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    tablet_name = serializers.CharField(source='tablet.name', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True)
    product_name = serializers.CharField(source='line.product_name', read_only=True)
    participants = ProductionCountingParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionCountingWindow
        fields = '__all__'
        read_only_fields = fields


class ProductionStationAlertAckSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    tablet_name = serializers.CharField(source='tablet.name', read_only=True)

    class Meta:
        model = ProductionStationAlertAck
        fields = '__all__'
        read_only_fields = ['organization', 'acknowledged_at', 'user_name', 'tablet_name']

    def get_user_name(self, obj):
        if not obj.user:
            return ''
        return obj.user.get_full_name() or obj.user.username


class ProductionStationAlertSerializer(serializers.ModelSerializer):
    station_code = serializers.CharField(source='station.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    acks = ProductionStationAlertAckSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionStationAlert
        fields = '__all__'
        read_only_fields = ['organization', 'created_by', 'created_at', 'station_code', 'department_name', 'work_order_number', 'created_by_name', 'acks']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name() or obj.created_by.username


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
    tablet_token = serializers.CharField(required=False, allow_blank=True, default='')
    slot_index = serializers.IntegerField(required=False, allow_null=True)


class SessionStateSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, default='')


class SessionCloseSerializer(SessionStateSerializer):
    declared_good_quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    end_counter = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)


class TabletLoginSlotSerializer(serializers.Serializer):
    token = serializers.CharField()
    user_id = serializers.IntegerField()
    pin = serializers.CharField()
    line_id = serializers.IntegerField(required=False, allow_null=True)
    slot_index = serializers.IntegerField()
    start_counter = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    checkpoint_total = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    participant_totals = serializers.DictField(child=serializers.DecimalField(max_digits=14, decimal_places=2), required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class TabletSessionStateSerializer(serializers.Serializer):
    token = serializers.CharField()
    session_id = serializers.IntegerField()
    checkpoint_total = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    participant_totals = serializers.DictField(child=serializers.DecimalField(max_digits=14, decimal_places=2), required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class TabletLogoutSlotSerializer(TabletSessionStateSerializer):
    user_id = serializers.IntegerField()
    pin = serializers.CharField()
    declared_good_quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    end_counter = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)


class TabletBatchLogoutSlotSerializer(serializers.Serializer):
    token = serializers.CharField()
    user_id = serializers.IntegerField()
    pin = serializers.CharField()
    session_ids = serializers.ListField(child=serializers.IntegerField())
    declared_good_quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class StationAlertAckSerializer(serializers.Serializer):
    token = serializers.CharField(required=False, allow_blank=True, default='')
    user_id = serializers.IntegerField(required=False, allow_null=True)


class TabletCheckpointSerializer(serializers.Serializer):
    token = serializers.CharField()
    line_id = serializers.IntegerField()
    checkpoint_total = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    participant_totals = serializers.DictField(child=serializers.DecimalField(max_digits=14, decimal_places=2), required=False)
    reason = serializers.CharField(required=False, allow_blank=True, default='manual')
    note = serializers.CharField(required=False, allow_blank=True, default='')


class TabletShiftCheckpointSerializer(serializers.Serializer):
    token = serializers.CharField()
    line_id = serializers.IntegerField(required=False, allow_null=True)
    checkpoint_total = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    participant_totals = serializers.DictField(child=serializers.DecimalField(max_digits=14, decimal_places=2), required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')


class TabletCompleteWorkItemSerializer(serializers.Serializer):
    token = serializers.CharField()
    line_id = serializers.IntegerField()
    checkpoint_total = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    participant_totals = serializers.DictField(child=serializers.DecimalField(max_digits=14, decimal_places=2), required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')


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


class TabletCallManagerSerializer(serializers.Serializer):
    token = serializers.CharField()
    title = serializers.CharField(max_length=160)
    message = serializers.CharField(required=False, allow_blank=True, default='')
