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


def _normalize_reorder_payload(model, org, new_positions, item_label):
    if not isinstance(new_positions, list) or not new_positions:
        return None, Response({'detail': 'new_positions listesi gerekli'}, status=status.HTTP_400_BAD_REQUEST)

    normalized = []
    for index, position in enumerate(new_positions):
        if not isinstance(position, dict) or position.get('id') in [None, '']:
            return None, Response({'detail': f'{item_label} ID bilgisi eksik.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            item_id = int(position.get('id'))
        except (TypeError, ValueError):
            return None, Response({'detail': f'{item_label} ID bilgisi geçersiz.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = int(position.get('order', index))
        except (TypeError, ValueError):
            order = index
        normalized.append((item_id, max(order, 0)))

    ids = [item_id for item_id, _ in normalized]
    if len(ids) != len(set(ids)):
        return None, Response({'detail': f'Aynı {item_label.lower()} birden fazla kez gönderilemez.'}, status=status.HTTP_400_BAD_REQUEST)

    instances_by_id = {
        instance.id: instance
        for instance in model.objects.filter(organization=org, id__in=ids)
    }
    if set(ids) != set(instances_by_id):
        return None, Response(
            {'detail': f'Bazı {item_label.lower()} ID bilgileri geçersiz veya bu organizasyona ait değil.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return [(instances_by_id[item_id], order) for item_id, order in normalized], None


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
        'create': 'products.create',
        'update': 'products.edit',
        'partial_update': 'products.edit',
        'destroy': 'products.delete',
        'import_template_catalog': 'products.import',
        'bulk_delete': 'products.bulk.delete',
        'bulk_upsert': 'products.import',
        'reorder': 'products.edit',
    }
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['order', 'created_at', 'sku', 'name']
    ordering = ['order', 'id']  # Default ordering
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

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """Reorder products by updating their order field. Accepts list of {id, order} tuples."""
        data = request.data if isinstance(request.data, dict) else {}
        org = _ensure_org(request)
        new_positions = data.get('new_positions') or []

        normalized_positions, error = _normalize_reorder_payload(Product, org, new_positions, 'Ürün')
        if error is not None:
            return error

        with transaction.atomic():
            products = []
            for product, order in normalized_positions:
                product.order = order
                products.append(product)
            Product.objects.bulk_update(products, ['order'])

        return Response({'detail': 'Ürünler başarıyla sıralandı.', 'count': len(normalized_positions)})


class CategoryViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'products.view'
    permission_map = {
        'create': 'products.create',
        'update': 'products.edit',
        'partial_update': 'products.edit',
        'destroy': 'products.delete',
        'reorder': 'products.edit',
    }
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['order', 'created_at', 'name']
    ordering = ['order', 'id']  # Default ordering
    queryset = Category.objects.all()

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """Reorder categories by updating their order field. Accepts list of {id, order} tuples."""
        data = request.data if isinstance(request.data, dict) else {}
        org = _ensure_org(request)
        new_positions = data.get('new_positions') or []

        normalized_positions, error = _normalize_reorder_payload(Category, org, new_positions, 'Kategori')
        if error is not None:
            return error

        with transaction.atomic():
            categories = []
            for category, order in normalized_positions:
                category.order = order
                categories.append(category)
            Category.objects.bulk_update(categories, ['order'])

        return Response({'detail': 'Kategoriler başarıyla sıralandı.', 'count': len(normalized_positions)})


class SalesOrderViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = SalesOrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'orders.view'
    permission_map = {
        'create': 'orders.create',
        'update': 'orders.edit',
        'partial_update': 'orders.edit',
        'destroy': 'orders.delete',
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
        'create': 'orders.create',
        'update': 'orders.edit',
        'partial_update': 'orders.edit',
        'destroy': 'orders.delete',
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
