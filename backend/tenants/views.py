from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from organizations.models import Organization
from .models import TenantPlan, TenantSubscription
from .serializers import (
    TenantPlanSerializer,
    TenantSubscriptionSerializer,
    TenantDetailSerializer
)
from core.permissions import IsSuperAdmin


class AdminTenantViewSet(viewsets.ModelViewSet):
    """
    Admin tenant management API - superadmin only.
    CRUD for organizations/tenants.
    """
    permission_classes = [IsSuperAdmin]
    queryset = Organization.objects.all().prefetch_related('users')
    serializer_class = TenantDetailSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['code']
    ordering = ['name']
    
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get all users for a tenant"""
        tenant = self.get_object()
        users = tenant.users.all()
        return Response({
            'count': users.count(),
            'users': [
                {
                    'id': u.id,
                    'username': u.username,
                    'email': u.email,
                    'role': u.role,
                    'is_active': u.is_active
                }
                for u in users
            ]
        })


class AdminPlanViewSet(viewsets.ModelViewSet):
    """
    Admin plan management API - superadmin only.
    CRUD for subscription plans.
    """
    permission_classes = [IsSuperAdmin]
    queryset = TenantPlan.objects.all()
    serializer_class = TenantPlanSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['plan_type', 'is_active']
    ordering = ['price_monthly']


class AdminSubscriptionViewSet(viewsets.ModelViewSet):
    """
    Admin subscription management API - superadmin only.
    CRUD for tenant subscriptions.
    """
    permission_classes = [IsSuperAdmin]
    queryset = TenantSubscription.objects.all().select_related('organization', 'plan')
    serializer_class = TenantSubscriptionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'billing_cycle']
    ordering = ['-created_at']
