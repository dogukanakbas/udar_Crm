from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.utils import user_has_perm
from crm.models import Quote
from erp.models import Product
from permissions import HasAPIPermission, IsOrgMember

from .models import (
    ProductionDataField,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionDocument,
    ProductionEvent,
    ProductionRuleBlock,
    ProductionRuleSet,
    ProductionRouteTemplate,
    ProductionSettings,
    ProductionStation,
    ProductionStationUser,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
)
from .serializers import (
    PiEventSerializer,
    ProductionDataFieldSerializer,
    ProductionDepartmentSerializer,
    ProductionDeviceSerializer,
    ProductionDevicePayloadMapSerializer,
    ProductionDocumentSerializer,
    ProductionEventSerializer,
    ProductionRuleBlockSerializer,
    ProductionRuleSetSerializer,
    ProductionRouteTemplateSerializer,
    ProductionSettingsSerializer,
    ProductionStationSerializer,
    ProductionStationUserSerializer,
    ProductionTemplatePresetSerializer,
    ProductionWorkOrderSerializer,
    StationEventSerializer,
)
from .services import (
    ProductionError,
    add_manual_work_order_line,
    apply_device_payload_maps,
    clone_template_preset,
    create_manual_work_order,
    create_work_order_from_contract,
    dashboard_summary,
    ensure_default_template_presets,
    make_pi_idempotency_key,
    record_station_event,
)


class OrgScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        return qs

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class ProductionSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'

    def get(self, request):
        row, _ = ProductionSettings.objects.get_or_create(organization=request.user.organization)
        return Response(ProductionSettingsSerializer(row).data)

    def patch(self, request):
        if not user_has_perm(request.user, 'production.manage'):
            return Response({'detail': 'Bu ayari duzenleme yetkiniz yok.'}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ProductionSettings.objects.get_or_create(organization=request.user.organization)
        serializer = ProductionSettingsSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProductionDepartmentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDepartmentSerializer
    queryset = ProductionDepartment.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.manage'
    permission_map = {'create': 'production.manage', 'update': 'production.manage', 'partial_update': 'production.manage', 'destroy': 'production.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['order', 'name']


class ProductionStationViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStationSerializer
    queryset = ProductionStation.objects.select_related('department')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.manage'
    permission_map = {'list': ['production.view', 'production.station.operate'], 'retrieve': ['production.view', 'production.station.operate'], 'create': 'production.manage', 'update': 'production.manage', 'partial_update': 'production.manage', 'destroy': 'production.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'department__name']
    ordering_fields = ['department__order', 'order', 'code']

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.method in permissions.SAFE_METHODS and not user_has_perm(self.request.user, 'production.view'):
            assigned_station_ids = ProductionStationUser.objects.filter(
                organization=self.request.user.organization,
                user=self.request.user,
                is_active=True,
            ).values_list('station_id', flat=True)
            qs = qs.filter(id__in=assigned_station_ids)
        return qs


class ProductionStationUserViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStationUserSerializer
    queryset = ProductionStationUser.objects.select_related('station', 'user')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.station_users.manage'
    permission_map = {'create': 'production.station_users.manage', 'update': 'production.station_users.manage', 'partial_update': 'production.station_users.manage', 'destroy': 'production.station_users.manage'}
    filter_backends = [filters.SearchFilter]
    search_fields = ['station__code', 'user__username', 'user__first_name', 'user__last_name']


class ProductionDeviceViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDeviceSerializer
    queryset = ProductionDevice.objects.select_related('station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.device_maps.manage'
    permission_map = {'create': 'production.device_maps.manage', 'update': 'production.device_maps.manage', 'partial_update': 'production.device_maps.manage', 'destroy': 'production.device_maps.manage'}
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'station__code']


class ProductionDataFieldViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDataFieldSerializer
    queryset = ProductionDataField.objects.select_related('station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.device_maps.manage'
    permission_map = {'create': 'production.device_maps.manage', 'update': 'production.device_maps.manage', 'partial_update': 'production.device_maps.manage', 'destroy': 'production.device_maps.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['key', 'label', 'station__code']
    ordering_fields = ['order', 'key']


class ProductionDevicePayloadMapViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDevicePayloadMapSerializer
    queryset = ProductionDevicePayloadMap.objects.select_related('device', 'station', 'data_field')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.device_maps.manage'
    permission_map = {'create': 'production.device_maps.manage', 'update': 'production.device_maps.manage', 'partial_update': 'production.device_maps.manage', 'destroy': 'production.device_maps.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['device__name', 'source_path', 'target_key', 'station__code']
    ordering_fields = ['order', 'target_key']


class ProductionRouteViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionRouteTemplateSerializer
    queryset = ProductionRouteTemplate.objects.prefetch_related('steps__station__department')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.manage'
    permission_map = {'create': 'production.manage', 'update': 'production.manage', 'partial_update': 'production.manage', 'destroy': 'production.manage'}
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'product_group_key']


class ProductionRuleSetViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionRuleSetSerializer
    queryset = ProductionRuleSet.objects.select_related('station', 'route').prefetch_related('blocks')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.rules.manage'
    permission_map = {'create': 'production.rules.manage', 'update': 'production.rules.manage', 'partial_update': 'production.rules.manage', 'destroy': 'production.rules.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'station__code', 'route__name']
    ordering_fields = ['order', 'name']


class ProductionRuleBlockViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionRuleBlockSerializer
    queryset = ProductionRuleBlock.objects.select_related('rule_set')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.rules.manage'
    permission_map = {'create': 'production.rules.manage', 'update': 'production.rules.manage', 'partial_update': 'production.rules.manage', 'destroy': 'production.rules.manage'}
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['order', 'block_type']


class ProductionTemplatePresetViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductionTemplatePresetSerializer
    queryset = ProductionTemplatePreset.objects.filter(is_active=True)
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    permission_map = {'clone': 'production.templates.manage'}

    def get_queryset(self):
        ensure_default_template_presets()
        return super().get_queryset()

    @action(detail=True, methods=['post'], url_path='clone')
    def clone(self, request, pk=None):
        preset = self.get_object()
        try:
            result = clone_template_preset(preset, request.user.organization)
        except ProductionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_201_CREATED)


class ProductionWorkOrderViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionWorkOrderSerializer
    queryset = ProductionWorkOrder.objects.select_related('route', 'created_by').prefetch_related('lines__steps__station__department')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.work_orders.view'
    write_perm = 'production.work_orders.manage'
    permission_map = {
        'create': 'production.work_orders.manage',
        'update': 'production.work_orders.manage',
        'partial_update': 'production.work_orders.manage',
        'destroy': 'production.work_orders.manage',
        'from_contract': 'production.work_orders.manage',
        'add_line': 'production.work_orders.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['number', 'source_number', 'customer_name', 'lines__product_name', 'lines__product_sku']
    ordering_fields = ['created_at', 'due_date', 'status']

    def perform_create(self, serializer):
        order = create_manual_work_order(
            organization=self.request.user.organization,
            user=self.request.user,
            customer_name=serializer.validated_data.get('customer_name', ''),
            due_date=serializer.validated_data.get('due_date'),
            notes=serializer.validated_data.get('notes', ''),
            source_number=serializer.validated_data.get('source_number', ''),
            route=serializer.validated_data.get('route'),
        )
        serializer.instance = order

    @action(detail=False, methods=['post'], url_path='from-contract')
    def from_contract(self, request):
        quote_id = request.data.get('quote_id') or request.data.get('contract_id')
        quote = (
            Quote.objects.filter(organization=request.user.organization, pk=quote_id)
            .select_related('customer', 'prepared_by', 'owner')
            .prefetch_related('lines__product__category')
            .first()
        )
        if not quote:
            return Response({'detail': 'Sozlesme bulunamadi.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            order = create_work_order_from_contract(quote, user=request.user)
        except ProductionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not order:
            return Response({'detail': 'Aktarilacak uygun rota eslesmesine sahip sozlesme kalemi bulunamadi.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionWorkOrderSerializer(order, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='lines')
    def add_line(self, request, pk=None):
        order = self.get_object()
        product = None
        product_id = request.data.get('product') or request.data.get('product_id')
        if product_id:
            product = Product.objects.filter(organization=request.user.organization, pk=product_id).first()
            if not product:
                return Response({'detail': 'Urun bulunamadi.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            add_manual_work_order_line(
                work_order=order,
                product=product,
                product_sku=request.data.get('product_sku', ''),
                product_name=request.data.get('product_name', ''),
                detail_1=request.data.get('detail_1', ''),
                detail_2=request.data.get('detail_2', ''),
                quantity=request.data.get('quantity', 0),
                technical_notes=request.data.get('technical_notes', ''),
                route=request.data.get('route') or request.data.get('route_id') or order.route_id,
            )
        except ProductionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        return Response(ProductionWorkOrderSerializer(order, context={'request': request}).data)


class ProductionEventViewSet(OrgScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductionEventSerializer
    queryset = ProductionEvent.objects.select_related('work_order', 'line', 'step', 'station', 'user')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.pi_events.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['work_order__number', 'line__product_name', 'station__code', 'event_type']
    ordering_fields = ['created_at']


class ProductionDocumentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDocumentSerializer
    queryset = ProductionDocument.objects.select_related('work_order', 'line', 'station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.documents.manage'
    permission_map = {'create': 'production.documents.manage', 'update': 'production.documents.manage', 'partial_update': 'production.documents.manage', 'destroy': 'production.documents.manage'}

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, uploaded_by=self.request.user)


class ProductionStationConsoleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def get(self, request):
        station_code = request.query_params.get('station_code')
        qs = ProductionWorkOrderLine.objects.filter(work_order__organization=request.user.organization).select_related('work_order', 'product')
        open_statuses = ['ready', 'in_progress', 'waiting_handover']
        qs = qs.filter(steps__status__in=open_statuses).distinct()
        if not user_has_perm(request.user, 'production.manage'):
            assigned_station_ids = ProductionStationUser.objects.filter(
                organization=request.user.organization,
                user=request.user,
                is_active=True,
                station__is_active=True,
            ).values_list('station_id', flat=True)
            qs = qs.filter(steps__station_id__in=assigned_station_ids)
        if station_code:
            qs = qs.filter(steps__station__code=station_code)
        rows = []
        for line in qs.order_by('work_order__due_date', 'work_order__number')[:100]:
            active_step = line.steps.filter(status__in=open_statuses).select_related('station__department').order_by('order').first()
            if not active_step:
                continue
            rows.append({
                'line_id': line.id,
                'work_order_id': line.work_order_id,
                'work_order_number': line.work_order.number,
                'customer_name': line.work_order.customer_name,
                'product_sku': line.product_sku,
                'product_name': line.product_name,
                'detail_1': line.detail_1,
                'detail_2': line.detail_2,
                'quantity': line.quantity,
                'station_code': active_step.station.code,
                'station_name': active_step.station.name,
                'department_name': active_step.station.department.name,
                'status': active_step.status,
                'target_quantity': active_step.target_quantity,
                'completed_quantity': active_step.completed_quantity,
            })
        return Response({'items': rows})

    def post(self, request):
        serializer = StationEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        station_code = serializer.validated_data.get('station_code')
        if not user_has_perm(request.user, 'production.manage'):
            is_assigned = ProductionStationUser.objects.filter(
                organization=request.user.organization,
                user=request.user,
                station__code=station_code,
                station__is_active=True,
                is_active=True,
            ).exists()
            if not is_assigned:
                return Response({'detail': 'Bu istasyonda islem yapmaya atanmamis kullanici.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            event = record_station_event(
                organization=request.user.organization,
                user=request.user,
                source='ui',
                **serializer.validated_data,
            )
        except (ProductionError, ProductionWorkOrderLine.DoesNotExist, ProductionStation.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionPiEventView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = PiEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.pop('token')
        device = ProductionDevice.objects.select_related('station', 'organization').filter(token=token, is_active=True).first()
        if not device:
            return Response({'detail': 'Gecersiz cihaz tokeni.'}, status=status.HTTP_403_FORBIDDEN)
        device.last_seen_at = timezone.now()
        device.save(update_fields=['last_seen_at'])
        raw_payload = dict(request.data)
        raw_payload.pop('token', None)
        normalized_payload, mapping_errors = apply_device_payload_maps(device, raw_payload)
        merged = {**serializer.validated_data, **normalized_payload}
        station_code = merged.get('station_code') or device.station.code
        line_id = merged.get('line_id')
        event_type = merged.get('event_type') or 'quantity'
        if not line_id:
            return Response({'detail': 'line_id mapping veya payload icinde zorunludur.', 'mapping_errors': mapping_errors}, status=status.HTTP_400_BAD_REQUEST)
        idempotency_key = merged.get('idempotency_key') or make_pi_idempotency_key(device, raw_payload, normalized_payload)
        try:
            event = record_station_event(
                organization=device.organization,
                user=None,
                device=device,
                source='pi',
                station_code=station_code,
                line_id=line_id,
                event_type=event_type,
                quantity_delta=merged.get('quantity_delta', 0),
                counter_value=merged.get('counter_value'),
                note=merged.get('note', ''),
                idempotency_key=idempotency_key,
                raw_payload=raw_payload,
                normalized_payload=normalized_payload,
                mapping_errors=mapping_errors,
            )
        except (ProductionError, ProductionWorkOrderLine.DoesNotExist, ProductionStation.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionReportSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.reports.view'

    def get(self, request):
        org = request.user.organization
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        events = ProductionEvent.objects.filter(organization=org)
        if start:
            events = events.filter(created_at__date__gte=start)
        if end:
            events = events.filter(created_at__date__lte=end)
        by_station = list(
            events.values('station__code', 'station__name', 'station__department__name')
            .annotate(total=Sum('quantity_delta'))
            .order_by('station__department__order', 'station__order')
        )
        by_worker = list(
            events.values('user_id', 'user__username')
            .annotate(total=Sum('quantity_delta'))
            .order_by('-total')[:50]
        )
        data = dashboard_summary(org)
        data.update({'by_station': by_station, 'by_worker': by_worker})
        return Response(data)


class ProductionReportExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.reports.view'

    def get(self, request):
        org = request.user.organization
        rows = ProductionEvent.objects.filter(organization=org).select_related('work_order', 'line', 'station', 'user').order_by('-created_at')[:2000]
        lines = ['Tarih,Is Emri,Istasyon,Urun,Islem,Miktar,Kullanici,Not']
        for event in rows:
            lines.append(','.join([
                event.created_at.strftime('%d.%m.%Y %H:%M'),
                event.work_order.number,
                event.station.code,
                event.line.product_name.replace(',', ' '),
                event.event_type,
                str(event.quantity_delta),
                (event.user.username if event.user else ''),
                (event.note or '').replace(',', ' '),
            ]))
        response = HttpResponse('\n'.join(lines), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="imalat_raporu.csv"'
        return response
