from django.db import transaction
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from permissions import IsOrgMember, HasAPIPermission
from organizations.models import Organization, NumberRange
from .models import Invoice, Product, Category, SalesOrder, PurchaseOrder, StockMovement, Vehicle
from .template_catalog_import import upsert_product_catalog, upsert_template_catalog
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
        'import_template_catalog': 'products.edit',
        'bulk_delete': 'products.edit',
        'bulk_upsert': 'products.edit',
    }
    queryset = Product.objects.all()

    @action(detail=False, methods=['post'], url_path='import-template-catalog')
    def import_template_catalog(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        categories_data = data.get('categories') or []
        products_data = data.get('products') or []
        if not isinstance(categories_data, list) or not isinstance(products_data, list):
            return Response({'detail': 'categories ve products liste olmalidir'}, status=status.HTTP_400_BAD_REQUEST)

        org = _ensure_org(request)

        with transaction.atomic():
            result = upsert_template_catalog(org, categories_data, products_data, user=request.user)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='bulk-upsert')
    def bulk_upsert(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        categories_data = data.get('categories') or []
        products_data = data.get('products') or []
        if not isinstance(categories_data, list) or not isinstance(products_data, list):
            return Response({'detail': 'categories ve products liste olmalidir'}, status=status.HTTP_400_BAD_REQUEST)

        org = _ensure_org(request)
        with transaction.atomic():
            result = upsert_product_catalog(
                org,
                categories_data,
                products_data,
                user=request.user,
                audit_entity='BulkProductImport',
                audit_entity_id='bulk-product-import',
                audit_action='imported',
                audit_field='bulk_product_import',
            )
        return Response(result)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        org = _ensure_org(request)
        ids = data.get('ids') or []
        delete_all = bool(data.get('all'))

        queryset = Product.objects.filter(organization=org)
        if delete_all:
            if data.get('confirm') is not True:
                return Response({'detail': 'Tüm ürünleri silmek için confirm=true gönderilmelidir.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not isinstance(ids, list) or not ids:
                return Response({'detail': 'Silinecek ürün id listesi veya all=true gerekli.'}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(id__in=ids)

        product_count = queryset.count()
        stock_movement_count = StockMovement.objects.filter(organization=org, product__in=queryset).count()
        with transaction.atomic():
            queryset.delete()

        return Response(
            {
                'deleted_products': product_count,
                'deleted_stock_movements': stock_movement_count,
            }
        )


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
    required_perm = 'sales_orders.admin'
    permission_map = {
        'create': 'sales_orders.admin',
        'update': 'sales_orders.admin',
        'partial_update': 'sales_orders.admin',
        'destroy': 'sales_orders.admin',
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
