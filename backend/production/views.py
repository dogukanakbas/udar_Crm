import tempfile

from django.core.management import call_command
from django.db import IntegrityError, models
from django.db.models import ProtectedError, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.utils import user_has_perm
from crm.models import Quote
from erp.models import Product
from permissions import HasAPIPermission, IsOrgMember

from .models import (
    ProductionDataField,
    ProductionCountingParticipant,
    ProductionCountingWindow,
    ProductionDepartment,
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionDocument,
    ProductionEvent,
    ProductionOperatorProfile,
    ProductionRuleBlock,
    ProductionRuleSet,
    ProductionRouteTemplate,
    ProductionReportTemplate,
    ProductionSettings,
    ProductionSessionBreak,
    ProductionStationAlert,
    ProductionShiftBreak,
    ProductionShiftCheckpoint,
    ProductionShiftOccurrence,
    ProductionShiftSchedule,
    ProductionStationTablet,
    ProductionStation,
    ProductionStationTarget,
    ProductionStationUser,
    ProductionStepTabletAssignment,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkOrderLine,
    ProductionWorkSession,
)
from .serializers import (
    PiEventSerializer,
    ProductionDataFieldSerializer,
    ProductionCountingWindowSerializer,
    ProductionDepartmentSerializer,
    ProductionDeviceSerializer,
    ProductionDevicePayloadMapSerializer,
    ProductionDocumentSerializer,
    ProductionEventSerializer,
    ProductionOperatorProfileSerializer,
    ProductionRuleBlockSerializer,
    ProductionRuleSetSerializer,
    ProductionRouteTemplateSerializer,
    ProductionReportTemplateSerializer,
    ProductionSettingsSerializer,
    ProductionStationAlertSerializer,
    ProductionShiftBreakSerializer,
    ProductionShiftCheckpointSerializer,
    ProductionShiftOccurrenceSerializer,
    ProductionShiftScheduleSerializer,
    ProductionStationTabletSerializer,
    ProductionStationSerializer,
    ProductionStationTargetSerializer,
    ProductionStationUserSerializer,
    ProductionStepTabletAssignmentSerializer,
    ProductionTemplatePresetSerializer,
    ProductionWorkOrderSerializer,
    ProductionWorkSessionSerializer,
    SessionCloseSerializer,
    SessionReviewSerializer,
    SessionStartSerializer,
    SessionStateSerializer,
    StationAlertAckSerializer,
    StationEventSerializer,
    TabletLoginSlotSerializer,
    TabletLogoutSlotSerializer,
    TabletBatchLogoutSlotSerializer,
    TabletCheckpointSerializer,
    TabletCompleteWorkItemSerializer,
    TabletShiftCheckpointSerializer,
    TabletSessionStateSerializer,
    TabletCallManagerSerializer,
)
from .report_exports import (
    build_work_order_report_export,
    list_production_report_placeholders,
    response_for_export,
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
    _previous_step_summary,
    handover_work_session,
    make_pi_idempotency_key,
    pause_work_session,
    record_machine_session_event,
    record_station_event,
    resume_work_session,
    review_session_discrepancy,
    start_work_session,
    ack_station_alert,
    close_work_session,
    send_station_alert,
    tablet_context,
    tablet_checkpoint,
    tablet_complete_work_item,
    tablet_shift_checkpoint,
    tablet_login_slot,
    tablet_logout_slot,
    tablet_batch_logout_slots,
    tablet_pause_session,
    tablet_resume_session,
    tablet_call_manager,
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


class SafeDestroyMixin:
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {'detail': 'Bu kayit rota, is emri, uretim ilerlemesi veya hareket kaydi ile bagli oldugu icin silinemez. Once bagli yapilari kaldirin ya da kaydi pasife alin.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IntegrityError:
            return Response(
                {'detail': 'Bu kayit baska kayitlarla bagli oldugu icin silinemedi. Once bagli kayitlari temizleyin.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class ProductionReportTemplateViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionReportTemplateSerializer
    queryset = ProductionReportTemplate.objects.select_related('created_by')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    required_perm = 'production.report_templates.view'
    write_perm = 'production.report_templates.manage'
    permission_map = {
        'create': 'production.report_templates.manage',
        'update': 'production.report_templates.manage',
        'partial_update': 'production.report_templates.manage',
        'destroy': 'production.report_templates.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'key', 'description']
    ordering_fields = ['name', 'key', 'created_at', 'updated_at']

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, created_by=self.request.user)


class ProductionReportPlaceholderView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.report_templates.view'

    def get(self, request):
        return Response({'groups': list_production_report_placeholders()})


class ProductionDepartmentViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDepartmentSerializer
    queryset = ProductionDepartment.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.manage'
    permission_map = {'create': 'production.manage', 'update': 'production.manage', 'partial_update': 'production.manage', 'destroy': 'production.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['order', 'name']

    @action(detail=False, methods=['get'], url_path='export-config')
    def export_config(self, request):
        if not user_has_perm(request.user, 'production.manage'):
            return Response({'detail': 'Bu veriyi disari aktarma yetkiniz yok.'}, status=status.HTTP_403_FORBIDDEN)
        with tempfile.NamedTemporaryFile(mode='r+', suffix='.json', encoding='utf-8') as handle:
            call_command('export_production_config', output=handle.name, organization=getattr(request.user.organization, 'code', ''), include_presets=True)
            handle.seek(0)
            response = HttpResponse(handle.read(), content_type='application/json; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="production_config.json"'
        return response

    @action(detail=False, methods=['post'], url_path='import-config')
    def import_config(self, request):
        if not user_has_perm(request.user, 'production.manage'):
            return Response({'detail': 'Bu veriyi ice aktarma yetkiniz yok.'}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'JSON dosyasi gerekli.'}, status=status.HTTP_400_BAD_REQUEST)
        with tempfile.NamedTemporaryFile(mode='wb+', suffix='.json') as handle:
            for chunk in uploaded.chunks():
                handle.write(chunk)
            handle.flush()
            call_command('import_production_config', handle.name, organization=getattr(request.user.organization, 'code', ''), include_presets=True)
        return Response({'detail': 'Uretim konfigurasyonu ice aktarildi.'})


class ProductionStationViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
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


class ProductionStationUserViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStationUserSerializer
    queryset = ProductionStationUser.objects.select_related('station', 'user')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.station_users.manage'
    permission_map = {'create': 'production.station_users.manage', 'update': 'production.station_users.manage', 'partial_update': 'production.station_users.manage', 'destroy': 'production.station_users.manage'}
    filter_backends = [filters.SearchFilter]
    search_fields = ['station__code', 'user__username', 'user__first_name', 'user__last_name']


class ProductionDeviceViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDeviceSerializer
    queryset = ProductionDevice.objects.select_related('station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.device_maps.manage'
    permission_map = {'create': 'production.device_maps.manage', 'update': 'production.device_maps.manage', 'partial_update': 'production.device_maps.manage', 'destroy': 'production.device_maps.manage'}
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'station__code']


class ProductionOperatorProfileViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionOperatorProfileSerializer
    queryset = ProductionOperatorProfile.objects.select_related('user')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.tablet.manage'
    write_perm = 'production.tablet.manage'
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'user__email']


class ProductionStationTabletViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStationTabletSerializer
    queryset = ProductionStationTablet.objects.select_related('station__department')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.tablet.manage'
    write_perm = 'production.tablet.manage'
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'token', 'station__code', 'station__name']


class ProductionStationTargetViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStationTargetSerializer
    queryset = ProductionStationTarget.objects.select_related('station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.manage'
    permission_map = {
        'create': 'production.manage',
        'update': 'production.manage',
        'partial_update': 'production.manage',
        'destroy': 'production.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['station__code', 'station__name', 'note']
    ordering_fields = ['target_date', 'target_quantity', 'station__code']

    def get_queryset(self):
        qs = super().get_queryset()
        station_id = self.request.query_params.get('station')
        target_date = self.request.query_params.get('target_date')
        if station_id:
            qs = qs.filter(station_id=station_id)
        if target_date:
            qs = qs.filter(target_date=target_date)
        return qs


class ProductionShiftScheduleViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionShiftScheduleSerializer
    queryset = ProductionShiftSchedule.objects.select_related('department')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.shifts.view'
    write_perm = 'production.shifts.manage'
    permission_map = {
        'create': 'production.shifts.manage',
        'update': 'production.shifts.manage',
        'partial_update': 'production.shifts.manage',
        'destroy': 'production.shifts.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'department__name', 'department__code']
    ordering_fields = ['department__order', 'order', 'start_time']

    def get_queryset(self):
        qs = super().get_queryset()
        department_id = self.request.query_params.get('department')
        if department_id:
            qs = qs.filter(department_id=department_id)
        return qs


class ProductionShiftBreakViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionShiftBreakSerializer
    queryset = ProductionShiftBreak.objects.select_related('department', 'schedule')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.shifts.view'
    write_perm = 'production.shifts.manage'
    permission_map = {
        'create': 'production.shifts.manage',
        'update': 'production.shifts.manage',
        'partial_update': 'production.shifts.manage',
        'destroy': 'production.shifts.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'department__name', 'schedule__name']
    ordering_fields = ['department__order', 'order', 'start_time']

    def get_queryset(self):
        qs = super().get_queryset()
        department_id = self.request.query_params.get('department')
        schedule_id = self.request.query_params.get('schedule')
        if department_id:
            qs = qs.filter(department_id=department_id)
        if schedule_id:
            qs = qs.filter(schedule_id=schedule_id)
        return qs


class ProductionShiftOccurrenceViewSet(OrgScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductionShiftOccurrenceSerializer
    queryset = ProductionShiftOccurrence.objects.select_related('department', 'schedule')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.shift_reports.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'department__name', 'schedule__name']
    ordering_fields = ['report_date', 'starts_at', 'ends_at']

    def get_queryset(self):
        qs = super().get_queryset()
        report_date = self.request.query_params.get('report_date')
        department_id = self.request.query_params.get('department')
        if report_date:
            qs = qs.filter(report_date=report_date)
        if department_id:
            qs = qs.filter(department_id=department_id)
        return qs


class ProductionStepTabletAssignmentViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStepTabletAssignmentSerializer
    queryset = ProductionStepTabletAssignment.objects.select_related('step__line__work_order', 'step__station', 'tablet__station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.work_orders.view'
    write_perm = 'production.work_orders.manage'
    permission_map = {
        'create': 'production.work_orders.manage',
        'update': 'production.work_orders.manage',
        'partial_update': 'production.work_orders.manage',
        'destroy': 'production.work_orders.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['step__line__work_order__number', 'step__line__product_name', 'tablet__name', 'tablet__station__code']
    ordering_fields = ['priority', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        step_id = self.request.query_params.get('step')
        tablet_id = self.request.query_params.get('tablet')
        if step_id:
            qs = qs.filter(step_id=step_id)
        if tablet_id:
            qs = qs.filter(tablet_id=tablet_id)
        return qs


class ProductionDataFieldViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDataFieldSerializer
    queryset = ProductionDataField.objects.select_related('station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.device_maps.manage'
    permission_map = {'create': 'production.device_maps.manage', 'update': 'production.device_maps.manage', 'partial_update': 'production.device_maps.manage', 'destroy': 'production.device_maps.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['key', 'label', 'station__code']
    ordering_fields = ['order', 'key']


class ProductionDevicePayloadMapViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDevicePayloadMapSerializer
    queryset = ProductionDevicePayloadMap.objects.select_related('device', 'station', 'data_field')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.device_maps.manage'
    permission_map = {'create': 'production.device_maps.manage', 'update': 'production.device_maps.manage', 'partial_update': 'production.device_maps.manage', 'destroy': 'production.device_maps.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['device__name', 'source_path', 'target_key', 'station__code']
    ordering_fields = ['order', 'target_key']


class ProductionRouteViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionRouteTemplateSerializer
    queryset = ProductionRouteTemplate.objects.prefetch_related('steps__station__department')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.manage'
    permission_map = {'create': 'production.manage', 'update': 'production.manage', 'partial_update': 'production.manage', 'destroy': 'production.manage'}
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'product_group_key']


class ProductionRuleSetViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionRuleSetSerializer
    queryset = ProductionRuleSet.objects.select_related('station', 'route').prefetch_related('blocks')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.rules.manage'
    permission_map = {'create': 'production.rules.manage', 'update': 'production.rules.manage', 'partial_update': 'production.rules.manage', 'destroy': 'production.rules.manage'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'station__code', 'route__name']
    ordering_fields = ['order', 'name']


class ProductionRuleBlockViewSet(SafeDestroyMixin, OrgScopedMixin, viewsets.ModelViewSet):
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
    queryset = ProductionWorkOrder.objects.select_related('route', 'created_by').prefetch_related('lines__steps__station__department', 'lines__steps__tablet_assignments__tablet')
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
        'export_report': 'production.reports.export',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['number', 'source_number', 'customer_name', 'lines__product_name', 'lines__product_sku']
    ordering_fields = ['created_at', 'due_date', 'status']

    @action(detail=False, methods=['get'], url_path='export')
    def export_orders(self, request):
        if not user_has_perm(request.user, 'production.work_orders.manage'):
            return Response({'detail': 'Bu veriyi disari aktarma yetkiniz yok.'}, status=status.HTTP_403_FORBIDDEN)
        with tempfile.NamedTemporaryFile(mode='r+', suffix='.json', encoding='utf-8') as handle:
            call_command('export_production_work_orders', output=handle.name, organization=getattr(request.user.organization, 'code', ''))
            handle.seek(0)
            response = HttpResponse(handle.read(), content_type='application/json; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="production_work_orders.json"'
        return response

    @action(detail=False, methods=['post'], url_path='import')
    def import_orders(self, request):
        if not user_has_perm(request.user, 'production.work_orders.manage'):
            return Response({'detail': 'Bu veriyi ice aktarma yetkiniz yok.'}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'JSON dosyasi gerekli.'}, status=status.HTTP_400_BAD_REQUEST)
        replace_lines = str(request.data.get('replace_lines', '')).lower() in {'1', 'true', 'yes', 'evet'}
        with tempfile.NamedTemporaryFile(mode='wb+', suffix='.json') as handle:
            for chunk in uploaded.chunks():
                handle.write(chunk)
            handle.flush()
            call_command(
                'import_production_work_orders',
                handle.name,
                organization=getattr(request.user.organization, 'code', ''),
                replace_lines=replace_lines,
            )
        return Response({'detail': 'Uretim is emirleri ice aktarildi.'})

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

    @action(detail=True, methods=['post'], url_path='export-report')
    def export_report(self, request, pk=None):
        order = self.get_object()
        template_id = request.data.get('template_id') or request.data.get('template')
        template = ProductionReportTemplate.objects.filter(
            organization=request.user.organization,
            pk=template_id,
            is_active=True,
        ).first()
        if not template:
            return Response({'detail': 'Aktif rapor şablonu bulunamadı.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            export = build_work_order_report_export(
                order,
                template,
                output_format=request.data.get('format') or template.default_format,
                extra_notes=request.data.get('extra_notes') or '',
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response_for_export(export)


class ProductionEventViewSet(OrgScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductionEventSerializer
    queryset = ProductionEvent.objects.select_related('work_order', 'line', 'step', 'station', 'session', 'user')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.pi_events.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['work_order__number', 'line__product_name', 'station__code', 'event_type']
    ordering_fields = ['created_at']


class ProductionCountingWindowViewSet(OrgScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductionCountingWindowSerializer
    queryset = ProductionCountingWindow.objects.select_related('work_order', 'line', 'step', 'station', 'tablet').prefetch_related('participants__user')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.sessions.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['work_order__number', 'line__product_name', 'station__code']
    ordering_fields = ['opened_at', 'closed_at', 'official_delta', 'machine_delta']


class ProductionWorkSessionViewSet(OrgScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ProductionWorkSessionSerializer
    queryset = ProductionWorkSession.objects.select_related('work_order', 'line', 'step', 'station', 'user', 'reviewed_by')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.sessions.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['work_order__number', 'line__product_name', 'station__code', 'user__username', 'user__first_name', 'user__last_name']
    ordering_fields = ['started_at', 'ended_at', 'declared_good_quantity', 'machine_quantity', 'discrepancy_quantity']

    def get_queryset(self):
        qs = super().get_queryset()
        if not user_has_perm(self.request.user, 'production.sessions.view'):
            qs = qs.filter(user=self.request.user)
        status_param = self.request.query_params.get('status')
        discrepancy = self.request.query_params.get('discrepancy_status')
        if status_param:
            qs = qs.filter(status=status_param)
        if discrepancy:
            qs = qs.filter(discrepancy_status=discrepancy)
        return qs


class ProductionDocumentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionDocumentSerializer
    queryset = ProductionDocument.objects.select_related('work_order', 'line', 'station')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.view'
    write_perm = 'production.documents.manage'
    permission_map = {'create': 'production.documents.manage', 'update': 'production.documents.manage', 'partial_update': 'production.documents.manage', 'destroy': 'production.documents.manage'}

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, uploaded_by=self.request.user)


class ProductionStationAlertViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductionStationAlertSerializer
    queryset = ProductionStationAlert.objects.select_related('station', 'department', 'work_order', 'created_by').prefetch_related('acks')
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.alerts.view'
    write_perm = 'production.alerts.send'
    permission_map = {'create': 'production.alerts.send', 'update': 'production.alerts.send', 'partial_update': 'production.alerts.send', 'destroy': 'production.alerts.send'}
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'message', 'station__code', 'department__name', 'work_order__number']
    ordering_fields = ['created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated:
            if user.role == 'Admin' or getattr(user, 'is_superadmin', False):
                return qs
            from accounts.models import UserGroupMembership
            from django.db.models import Q
            user_groups = UserGroupMembership.objects.filter(user=user).values_list('group_id', flat=True)
            qs = qs.filter(
                Q(target_group__isnull=True) |
                Q(target_group__in=user_groups)
            )
        return qs

    def create(self, request, *args, **kwargs):
        target_type = request.data.get('target_type') or 'station'
        station = None
        department = None
        work_order = None
        if request.data.get('station'):
            station = ProductionStation.objects.filter(organization=request.user.organization, pk=request.data.get('station')).first()
        if request.data.get('department'):
            department = ProductionDepartment.objects.filter(organization=request.user.organization, pk=request.data.get('department')).first()
        if request.data.get('work_order'):
            work_order = ProductionWorkOrder.objects.filter(organization=request.user.organization, pk=request.data.get('work_order')).first()
        if target_type == 'station' and not station:
            return Response({'detail': 'İstasyon seçimi zorunlu.'}, status=status.HTTP_400_BAD_REQUEST)
        if target_type == 'department' and not department:
            return Response({'detail': 'Bölüm seçimi zorunlu.'}, status=status.HTTP_400_BAD_REQUEST)
        if target_type == 'work_order' and not work_order:
            return Response({'detail': 'İş emri seçimi zorunlu.'}, status=status.HTTP_400_BAD_REQUEST)
        alert = send_station_alert(
            organization=request.user.organization,
            user=request.user,
            target_type=target_type,
            station=station,
            department=department,
            work_order=work_order,
            title=request.data.get('title') or 'Üretim bildirimi',
            message=request.data.get('message') or '',
            severity=request.data.get('severity') or 'info',
        )
        return Response(self.get_serializer(alert).data, status=status.HTTP_201_CREATED)


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
            active_sessions = list(
                active_step.sessions.filter(status__in=['started', 'paused'])
                .select_related('user')
                .prefetch_related('breaks')
                .order_by('slot_index', 'started_at', 'id')
            )
            current_user_session = next((item for item in active_sessions if item.user_id == request.user.id), None)
            active_session = current_user_session or (active_sessions[0] if active_sessions else None)
            has_capacity = len(active_sessions) < active_step.station.max_workers
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
                'machine_quantity': active_step.machine_quantity,
                'remaining_quantity': max(active_step.target_quantity - active_step.completed_quantity, 0),
                'active_session': ProductionWorkSessionSerializer(active_session).data if active_session else None,
                'active_sessions': ProductionWorkSessionSerializer(active_sessions, many=True).data,
                'current_user_session': ProductionWorkSessionSerializer(current_user_session).data if current_user_session else None,
                'can_start': has_capacity and active_step.status in ['ready', 'in_progress', 'waiting_handover'],
                'can_take_over': has_capacity and active_step.status == 'waiting_handover',
                'previous_summary': _previous_step_summary(active_step),
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


class ProductionTabletContextView(APIView):
    permission_classes = []

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({'detail': 'Tablet tokeni gerekli.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(tablet_context(token))
        except ProductionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class ProductionTabletLoginSlotView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletLoginSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = tablet_login_slot(**serializer.validated_data)
        except (ProductionError, ProductionWorkOrderLine.DoesNotExist, ProductionStation.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionWorkSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class ProductionTabletLogoutSlotView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletLogoutSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = tablet_logout_slot(**serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionTabletBatchLogoutSlotView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletBatchLogoutSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sessions = tablet_batch_logout_slots(**serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionWorkSessionSerializer(sessions, many=True).data, status=status.HTTP_201_CREATED)


class ProductionTabletBreakStartView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletSessionStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = tablet_pause_session(**serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionTabletBreakEndView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletSessionStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = tablet_resume_session(**serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionTabletCheckpointView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletCheckpointSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            window = tablet_checkpoint(**serializer.validated_data)
        except (ProductionError, ProductionWorkOrderLine.DoesNotExist, ProductionStation.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not window:
            return Response({'detail': 'Kapatılacak açık üretim penceresi yok.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionCountingWindowSerializer(window).data, status=status.HTTP_201_CREATED)


class ProductionTabletShiftCheckpointView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletShiftCheckpointSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            checkpoint = tablet_shift_checkpoint(**serializer.validated_data)
        except ProductionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionShiftCheckpointSerializer(checkpoint).data, status=status.HTTP_201_CREATED)


class ProductionTabletCompleteWorkItemView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletCompleteWorkItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            step = tablet_complete_work_item(**serializer.validated_data)
        except (ProductionError, ProductionWorkOrderLine.DoesNotExist, ProductionStation.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'id': step.id, 'status': step.status, 'completed_quantity': step.completed_quantity})


class ProductionTabletCallManagerView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = TabletCallManagerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            alert = tablet_call_manager(**serializer.validated_data)
        except ProductionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionStationAlertSerializer(alert).data, status=status.HTTP_201_CREATED)


class ProductionStationAlertAckView(APIView):
    permission_classes = []

    def post(self, request, alert_id):
        serializer = StationAlertAckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            if serializer.validated_data.get('token'):
                tablet = ProductionStationTablet.objects.select_related('organization').filter(token=serializer.validated_data.get('token')).first()
                if not tablet:
                    return Response({'detail': 'Geçersiz tablet tokeni.'}, status=status.HTTP_400_BAD_REQUEST)
                user = None
                if serializer.validated_data.get('user_id'):
                    user = tablet.organization.users.filter(pk=serializer.validated_data.get('user_id')).first()
                ack = ack_station_alert(organization=tablet.organization, alert_id=alert_id, token=serializer.validated_data.get('token'), user=user)
            else:
                if not request.user or not request.user.is_authenticated:
                    return Response({'detail': 'Tablet tokeni veya oturum gerekli.'}, status=status.HTTP_401_UNAUTHORIZED)
                ack = ack_station_alert(organization=request.user.organization, alert_id=alert_id, user=request.user)
        except (ProductionError, ProductionStationAlert.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'id': ack.id, 'acknowledged_at': ack.acknowledged_at})


class ProductionSessionStartView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def post(self, request):
        serializer = SessionStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = start_work_session(
                organization=request.user.organization,
                user=request.user,
                allow_unassigned=user_has_perm(request.user, 'production.manage') or user_has_perm(request.user, 'production.sessions.manage'),
                **serializer.validated_data,
            )
        except (ProductionError, ProductionWorkOrderLine.DoesNotExist, ProductionStation.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionWorkSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class ProductionSessionPauseView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def post(self, request):
        serializer = SessionStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = pause_work_session(organization=request.user.organization, user=request.user, **serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionSessionResumeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def post(self, request):
        serializer = SessionStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = resume_work_session(organization=request.user.organization, user=request.user, **serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionSessionHandoverView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def post(self, request):
        serializer = SessionStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = handover_work_session(organization=request.user.organization, user=request.user, **serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionSessionCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def post(self, request):
        serializer = SessionCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            event = close_work_session(organization=request.user.organization, user=request.user, **serializer.validated_data)
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ProductionSessionReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.sessions.review'

    def post(self, request, session_id):
        serializer = SessionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = review_session_discrepancy(
                organization=request.user.organization,
                user=request.user,
                session_id=session_id,
                **serializer.validated_data,
            )
        except (ProductionError, ProductionWorkSession.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductionWorkSessionSerializer(session).data)


class MyDailyProductionSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.station.operate'

    def get(self, request):
        day = request.query_params.get('date') or timezone.localdate().isoformat()
        rows = ProductionWorkSession.objects.filter(
            organization=request.user.organization,
            user=request.user,
            started_at__date=day,
        ).select_related('work_order', 'line', 'step', 'station', 'user', 'reviewed_by')
        return Response({'items': ProductionWorkSessionSerializer(rows, many=True).data})


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
            event = record_machine_session_event(
                organization=device.organization,
                device=device,
                station_code=station_code,
                line_id=line_id,
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
        dept_id = request.query_params.get('department')
        station_id = request.query_params.get('station')
        user_id = request.query_params.get('worker')

        events = ProductionEvent.objects.filter(organization=org)
        sessions = ProductionWorkSession.objects.filter(organization=org)

        if start:
            events = events.filter(created_at__date__gte=start)
            sessions = sessions.filter(started_at__date__gte=start)
        if end:
            events = events.filter(created_at__date__lte=end)
            sessions = sessions.filter(started_at__date__lte=end)
        if dept_id and dept_id != 'all':
            events = events.filter(station__department_id=dept_id)
            sessions = sessions.filter(station__department_id=dept_id)
        if station_id and station_id != 'all':
            events = events.filter(station_id=station_id)
            sessions = sessions.filter(station_id=station_id)
        if user_id and user_id != 'all':
            events = events.filter(user_id=user_id)
            sessions = sessions.filter(user_id=user_id)

        by_station = list(
            events.values('station_id', 'station__code', 'station__name', 'station__department__name')
            .annotate(total=Sum('quantity_delta'))
            .order_by('station__department__order', 'station__order')
        )
        
        by_worker = list(
            sessions.values('user_id', 'user__username', 'user__first_name', 'user__last_name')
            .annotate(
                total=Sum('declared_good_quantity'),
                machine_total=Sum('machine_quantity'),
                discrepancy_total=Sum('discrepancy_quantity'),
            )
            .order_by('-total')[:100]
        )

        by_date = list(
            events.values('created_at__date')
            .annotate(total=Sum('quantity_delta'))
            .order_by('created_at__date')
        )
        for item in by_date:
            if item['created_at__date']:
                item['date'] = item['created_at__date'].strftime('%Y-%m-%d')
                del item['created_at__date']

        worker_station = list(
            sessions.values('user__username', 'user__first_name', 'user__last_name', 'station__code', 'station__name')
            .annotate(total=Sum('declared_good_quantity'))
            .order_by('-total')[:200]
        )

        targets = ProductionStationTarget.objects.filter(organization=org).select_related('station__department')
        windows = ProductionCountingWindow.objects.filter(organization=org, status='closed').select_related('station__department')
        if start:
            targets = targets.filter(target_date__gte=start)
            windows = windows.filter(closed_at__date__gte=start)
        if end:
            targets = targets.filter(target_date__lte=end)
            windows = windows.filter(closed_at__date__lte=end)
        if dept_id and dept_id != 'all':
            targets = targets.filter(station__department_id=dept_id)
            windows = windows.filter(station__department_id=dept_id)
        if station_id and station_id != 'all':
            targets = targets.filter(station_id=station_id)
            windows = windows.filter(station_id=station_id)

        actual_by_station_date = {
            (row['station_id'], row['closed_at__date']): row['total'] or 0
            for row in windows.values('station_id', 'closed_at__date').annotate(total=Sum('official_delta'))
        }
        station_target_performance = []
        for target in targets.order_by('station__department__order', 'station__order', 'target_date', 'id'):
            actual = actual_by_station_date.get((target.station_id, target.target_date), 0)
            target_quantity = target.target_quantity or 0
            percent = float((actual / target_quantity) * 100) if target_quantity else 0
            station_target_performance.append({
                'station_id': target.station_id,
                'station_code': target.station.code,
                'station_name': target.station.name,
                'department_name': target.station.department.name,
                'target_date': target.target_date.isoformat(),
                'target_quantity': target_quantity,
                'actual_quantity': actual,
                'remaining_quantity': max(target_quantity - actual, 0),
                'completion_percent': min(999, round(percent, 1)),
            })

        detailed_sessions = []
        for s in sessions.select_related('user', 'station', 'line__work_order', 'line').order_by('-started_at')[:200]:
            detailed_sessions.append({
                'id': s.id,
                'type': 'work',
                'started_at': s.started_at.isoformat() if s.started_at else None,
                'ended_at': s.ended_at.isoformat() if s.ended_at else None,
                'username': s.user.username,
                'fullname': s.user.get_full_name(),
                'station_code': s.station.code,
                'station_name': s.station.name,
                'work_order_number': s.work_order.number if s.work_order else '',
                'product_name': s.line.product_name if s.line else 'Genel Çalışma',
                'quantity': float(s.declared_good_quantity or 0),
            })

        breaks = ProductionSessionBreak.objects.filter(organization=org).select_related('user', 'session__station')
        if start:
            breaks = breaks.filter(started_at__date__gte=start)
        if end:
            breaks = breaks.filter(started_at__date__lte=end)
        if dept_id and dept_id != 'all':
            breaks = breaks.filter(session__station__department_id=dept_id)
        if station_id and station_id != 'all':
            breaks = breaks.filter(session__station_id=station_id)
        if user_id and user_id != 'all':
            breaks = breaks.filter(user_id=user_id)

        for b in breaks.order_by('-started_at')[:200]:
            detailed_sessions.append({
                'id': f"break-{b.id}",
                'type': 'break',
                'started_at': b.started_at.isoformat() if b.started_at else None,
                'ended_at': b.ended_at.isoformat() if b.ended_at else None,
                'username': b.user.username,
                'fullname': b.user.get_full_name(),
                'station_code': b.session.station.code if b.session else '',
                'station_name': b.session.station.name if b.session else '',
                'work_order_number': 'MOLA',
                'product_name': b.note or 'Kişisel Mola',
                'quantity': 0.0,
            })

        detailed_sessions.sort(key=lambda x: x['started_at'] or '', reverse=True)
        detailed_sessions = detailed_sessions[:200]

        departments = list(ProductionDepartment.objects.filter(organization=org, is_active=True).values('id', 'name'))
        stations_list = list(ProductionStation.objects.filter(organization=org, is_active=True).values('id', 'name', 'code', 'department_id'))
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        workers_list = list(User.objects.filter(organization=org, is_active=True).values('id', 'username', 'first_name', 'last_name'))

        data = dashboard_summary(org)
        data.update({
            'by_station': by_station,
            'by_worker': by_worker,
            'by_date': by_date,
            'worker_station': worker_station,
            'station_target_performance': station_target_performance,
            'detailed_sessions': detailed_sessions,
            'departments_list': departments,
            'stations_list': stations_list,
            'workers_list': workers_list,
            'open_sessions': sessions.filter(status__in=['started', 'paused']).count(),
            'discrepancies_pending': sessions.filter(discrepancy_status='needs_review').count(),
        })
        return Response(data)


class ProductionShiftReportSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.shift_reports.view'

    def get(self, request):
        org = request.user.organization
        report_date = request.query_params.get('report_date') or timezone.localdate().isoformat()
        department_id = request.query_params.get('department')
        windows = ProductionCountingWindow.objects.filter(
            organization=org,
            status='closed',
        ).filter(
            models.Q(closed_at__date=report_date)
            | models.Q(shift_checkpoints__occurrence__report_date=report_date)
        ).select_related('station__department', 'work_order', 'line').distinct()
        checkpoints = ProductionShiftCheckpoint.objects.filter(
            organization=org,
        ).filter(
            models.Q(created_at__date=report_date)
            | models.Q(occurrence__report_date=report_date)
        ).select_related('station__department', 'occurrence', 'break_row', 'tablet')
        participants = ProductionCountingParticipant.objects.filter(
            organization=org,
            window__status='closed',
        ).filter(
            models.Q(window__closed_at__date=report_date)
            | models.Q(window__shift_checkpoints__occurrence__report_date=report_date)
        ).select_related('user', 'window__station__department', 'window__line').distinct()
        if department_id:
            windows = windows.filter(station__department_id=department_id)
            checkpoints = checkpoints.filter(station__department_id=department_id)
            participants = participants.filter(window__station__department_id=department_id)

        by_station = list(
            windows.values('station_id', 'station__code', 'station__name', 'station__department__name')
            .annotate(total=Sum('official_delta'))
            .order_by('station__department__order', 'station__order')
        )
        by_worker = list(
            participants.values('user_id', 'user__username', 'user__first_name', 'user__last_name')
            .annotate(total=Sum('credited_quantity'), discrepancy_total=Sum('discrepancy_quantity'))
            .order_by('-total')[:100]
        )
        return Response({
            'report_date': report_date,
            'total_quantity': windows.aggregate(total=Sum('official_delta'))['total'] or 0,
            'checkpoint_count': checkpoints.count(),
            'by_station': by_station,
            'by_worker': by_worker,
            'checkpoints': ProductionShiftCheckpointSerializer(checkpoints.order_by('-created_at')[:100], many=True).data,
        })


class ProductionReportExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'production.reports.view'

    def get(self, request):
        org = request.user.organization
        rows = ProductionWorkSession.objects.filter(organization=org).select_related('work_order', 'line', 'station', 'user').order_by('-started_at')[:2000]
        lines = ['Baslangic,Bitis,Is Emri,Istasyon,Urun,Saglam Adet,Makine Adedi,Fark,Fark Durumu,Kullanici,Not']
        for session in rows:
            lines.append(','.join([
                session.started_at.strftime('%d.%m.%Y %H:%M'),
                session.ended_at.strftime('%d.%m.%Y %H:%M') if session.ended_at else '',
                session.work_order.number if session.work_order else '',
                session.station.code,
                session.line.product_name.replace(',', ' ') if session.line else 'Genel Çalışma',
                str(session.declared_good_quantity),
                str(session.machine_quantity),
                str(session.discrepancy_quantity),
                session.discrepancy_status,
                session.user.username,
                (session.note or '').replace(',', ' '),
            ]))
        response = HttpResponse('\n'.join(lines), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="imalat_raporu.csv"'
        return response
