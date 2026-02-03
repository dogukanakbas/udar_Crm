from rest_framework import viewsets, permissions, filters
from rest_framework.response import Response
from permissions import IsOrgMember, HasAPIPermission
from audit.utils import log_entity_action
from organizations.models import Organization, NumberRange
from .models import Invoice, Product, Category, SalesOrder, PurchaseOrder, StockMovement, Vehicle
from .serializers import (
    InvoiceSerializer,
    ProductSerializer,
    CategorySerializer,
    SalesOrderSerializer,
    PurchaseOrderSerializer,
    StockMovementSerializer,
    VehicleSerializer,
)


def _ensure_org(request):
    org = getattr(getattr(request, 'user', None), 'organization', None) if request else None
    if org:
        return org
    org = Organization.objects.first()
    if not org:
        org = Organization.objects.create(name='Default Org')
    return org


class OrgScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        return qs

    def perform_create(self, serializer):
        org = _ensure_org(getattr(self, 'request', None))
        serializer.save(organization=org)


class InvoiceViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'invoices.view'
    permission_map = {
        'create': 'invoices.edit',
        'update': 'invoices.edit',
        'partial_update': 'invoices.edit',
        'destroy': 'invoices.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['number', 'customer_name', 'status']
    ordering_fields = ['issued_at', 'amount']
    queryset = Invoice.objects.all()


class ProductViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'products.view'
    permission_map = {
        'create': 'products.edit',
        'update': 'products.edit',
        'partial_update': 'products.edit',
        'destroy': 'products.edit',
    }
    queryset = Product.objects.all()

    def create(self, request, *args, **kwargs):
        import uuid
        data = request.data.copy()
        org = _ensure_org(request)
        sku = (data.get('sku') or '').strip()
        if not sku:
            sku = f"SKU-{uuid.uuid4().hex[:6].upper()}"
        # unique per org
        base = sku
        counter = 1
        while Product.objects.filter(organization=org, sku=sku).exists():
            sku = f"{base}-{counter}"
            counter += 1
        name = (data.get('name') or '').strip() or sku
        category = data.get('category')
        category_obj = None
        if category:
            try:
                category_obj = Category.objects.filter(organization=org, id=category).first()
            except Exception:
                category_obj = None
        product = Product.objects.create(
            organization=org,
            sku=sku,
            name=name,
            price=data.get('price') or 0,
            stock=data.get('stock') or 0,
            reserved=data.get('reserved') or 0,
            reorder_point=data.get('reorder_point') or 0,
            category=category_obj,
        )
        serializer = self.get_serializer(product)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=201, headers=headers)


class CategoryViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'products.view'
    permission_map = {
        'create': 'products.edit',
        'update': 'products.edit',
        'partial_update': 'products.edit',
        'destroy': 'products.edit',
    }
    queryset = Category.objects.all()


class SalesOrderViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = SalesOrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'orders.view'
    permission_map = {
        'create': 'orders.edit',
        'update': 'orders.edit',
        'partial_update': 'orders.edit',
        'destroy': 'orders.edit',
    }
    queryset = SalesOrder.objects.all()

    def create(self, request, *args, **kwargs):
        org = _ensure_org(request)
        number_range, _ = NumberRange.objects.get_or_create(organization=org, doc_type='SO', defaults={'prefix': 'SO-'})
        number = number_range.next_number()
        data = request.data.copy()
        data.setdefault('organization', org.id if hasattr(org, 'id') else org)
        data.setdefault('number', number)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=201, headers=headers)


class PurchaseOrderViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'orders.view'
    permission_map = {
        'create': 'orders.edit',
        'update': 'orders.edit',
        'partial_update': 'orders.edit',
        'destroy': 'orders.edit',
    }
    queryset = PurchaseOrder.objects.all()


class StockMovementViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'inventory.view'
    permission_map = {
        'create': 'inventory.edit',
        'update': 'inventory.edit',
        'partial_update': 'inventory.edit',
        'destroy': 'inventory.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reference', 'movement_type']
    ordering_fields = ['created_at', 'quantity']
    queryset = StockMovement.objects.all()


class VehicleViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'logistics.view'
    permission_map = {
        'create': 'logistics.edit',
        'update': 'logistics.edit',
        'partial_update': 'logistics.edit',
        'destroy': 'logistics.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['plate', 'driver', 'status']
    ordering_fields = ['last_update', 'distance_today']
    queryset = Vehicle.objects.all()
