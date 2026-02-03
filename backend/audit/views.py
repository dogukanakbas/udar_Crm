from rest_framework import viewsets, permissions, filters
from permissions import IsOrgMember, HasAPIPermission
from .models import AuditLog, AccessLog
from .serializers import AuditLogSerializer, AccessLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'audit.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['entity', 'entity_id', 'action', 'field']
    ordering_fields = ['created_at']
    queryset = AuditLog.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        entity = self.request.query_params.get('entity')
        entity_id = self.request.query_params.get('entity_id')
        if entity:
            qs = qs.filter(entity=entity)
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs.order_by('-created_at')


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AccessLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'audit.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['path', 'method']
    ordering_fields = ['created_at']
    queryset = AccessLog.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        return qs.order_by('-created_at')
