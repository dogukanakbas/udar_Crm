from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization, Warehouse
from .inventory_service import InventoryError, adjust, allocate_opening_balance, stock_in, stock_out, transfer
from .models import FulfillmentRequest, InventoryLocation, Product, StockMovement, WarehouseStock


class InventoryServiceTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test', code='TEST')
        self.warehouse = Warehouse.objects.create(organization=self.org, name='Ana Depo', code='ANA')
        self.target_warehouse = Warehouse.objects.create(organization=self.org, name='Şube', code='SUBE')
        self.location = InventoryLocation.objects.create(organization=self.org, warehouse=self.warehouse, code='A-01', name='A Rafı')
        self.target = InventoryLocation.objects.create(organization=self.org, warehouse=self.target_warehouse, code='B-01', name='B Rafı')
        self.product = Product.objects.create(organization=self.org, sku='SKU-1', name='Kapı', stock=0, inventory_mode='warehouse')

    def test_stock_in_out_and_aggregate(self):
        stock_in(organization=self.org, product=self.product, location=self.location, quantity=170)
        stock_out(organization=self.org, product=self.product, location=self.location, quantity=50, note='Teslim')
        self.product.refresh_from_db()
        row = WarehouseStock.objects.get(product=self.product, location=self.location)
        self.assertEqual(row.quantity, Decimal('120'))
        self.assertEqual(self.product.stock, Decimal('120'))
        self.assertEqual(StockMovement.objects.count(), 2)

    def test_negative_stock_is_blocked(self):
        stock_in(organization=self.org, product=self.product, location=self.location, quantity=10)
        with self.assertRaises(InventoryError):
            stock_out(organization=self.org, product=self.product, location=self.location, quantity=11, note='Fazla çıkış')

    def test_stock_variants_are_tracked_separately(self):
        stock_in(organization=self.org, product=self.product, location=self.location, quantity=10, detail_1_override='Beyaz', detail_2_override='Mat')
        stock_in(organization=self.org, product=self.product, location=self.location, quantity=5, detail_1_override='Antrasit', detail_2_override='Mat')
        stock_out(organization=self.org, product=self.product, location=self.location, quantity=3, note='Sevk', detail_1_override='Beyaz', detail_2_override='Mat')
        self.product.refresh_from_db()

        self.assertEqual(WarehouseStock.objects.get(product=self.product, location=self.location, detail_1_override='Beyaz').quantity, Decimal('7'))
        self.assertEqual(WarehouseStock.objects.get(product=self.product, location=self.location, detail_1_override='Antrasit').quantity, Decimal('5'))
        self.assertEqual(self.product.stock, Decimal('12'))
        self.assertEqual(StockMovement.objects.latest('id').detail_1, 'Beyaz')

    def test_adjust_and_transfer(self):
        stock_in(organization=self.org, product=self.product, location=self.location, quantity=100)
        adjust(organization=self.org, product=self.product, location=self.location, target_quantity=90, note='Sayım')
        transfer(organization=self.org, product=self.product, location_from=self.location, location_to=self.target, quantity=40, note='Sevk')
        self.product.refresh_from_db()
        self.assertEqual(WarehouseStock.objects.get(product=self.product, location=self.location).quantity, Decimal('50'))
        self.assertEqual(WarehouseStock.objects.get(product=self.product, location=self.target).quantity, Decimal('40'))
        self.assertEqual(self.product.stock, Decimal('90'))

    def test_opening_balance_requires_exact_legacy_total(self):
        legacy = Product.objects.create(organization=self.org, sku='SKU-2', name='Pencere', stock=75)
        with self.assertRaises(InventoryError):
            allocate_opening_balance(organization=self.org, product=legacy, allocations=[{'location_id': self.location.id, 'quantity': 70}])
        allocate_opening_balance(organization=self.org, product=legacy, allocations=[{'location_id': self.location.id, 'quantity': 75}])
        legacy.refresh_from_db()
        self.assertEqual(legacy.inventory_mode, 'warehouse')
        self.assertEqual(legacy.stock, Decimal('75'))

    def test_fulfillment_source_is_idempotent(self):
        FulfillmentRequest.objects.create(organization=self.org, source_type='contract', source_id='42')
        with self.assertRaises(Exception):
            FulfillmentRequest.objects.create(organization=self.org, source_type='contract', source_id='42')


class WarehouseApiTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='API Test', code='API')
        self.user = User.objects.create_user(username='admin', password='test-password', organization=self.org, role='Admin', is_superuser=True)
        self.warehouse = Warehouse.objects.create(organization=self.org, name='Ana Depo', code='ANA')
        self.location = InventoryLocation.objects.create(organization=self.org, warehouse=self.warehouse, code='A-01')
        self.product = Product.objects.create(organization=self.org, sku='SKU-API', name='API Ürünü', inventory_mode='warehouse')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_warehouse_list_dashboard_and_stock_action(self):
        self.assertEqual(self.client.get('/api/warehouses/').status_code, 200)
        self.assertEqual(self.client.get('/api/inventory-locations/').status_code, 200)
        response = self.client.post('/api/warehouse-stocks/stock-in/', {'product_id': self.product.id, 'location_id': self.location.id, 'quantity': 12}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.client.get('/api/warehouse-stocks/?q=API').status_code, 200)
        self.assertEqual(self.client.get('/api/warehouse-dashboard/').status_code, 200)

    def test_warehouse_and_location_create_use_authenticated_organization(self):
        warehouse_response = self.client.post('/api/warehouses/', {'code': 'YENI', 'name': 'Yeni Depo'}, format='json')
        self.assertEqual(warehouse_response.status_code, 201, warehouse_response.data)
        warehouse = Warehouse.objects.get(code='YENI')
        self.assertEqual(warehouse.organization, self.org)

        location_response = self.client.post(
            '/api/inventory-locations/',
            {'warehouse': warehouse.id, 'code': 'Y-01', 'name': 'Yeni Raf'},
            format='json',
        )
        self.assertEqual(location_response.status_code, 201, location_response.data)
        self.assertEqual(InventoryLocation.objects.get(code='Y-01').organization, self.org)

    def test_zero_balance_catalog_product_can_enter_warehouse_with_details(self):
        legacy = Product.objects.create(organization=self.org, sku='SKU-LEGACY', name='Katalog Ürünü', stock=0)
        response = self.client.post(
            '/api/warehouse-stocks/stock-in/',
            {'product_id': legacy.id, 'location_id': self.location.id, 'quantity': 4, 'detail_1_override': 'Beyaz', 'detail_2_override': 'Mat'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        legacy.refresh_from_db()
        self.assertEqual(legacy.inventory_mode, 'warehouse')
        self.assertEqual(WarehouseStock.objects.get(product=legacy).detail_1_override, 'Beyaz')
