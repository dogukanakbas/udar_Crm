from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Permission, RolePermission, User
from crm.models import BusinessPartner, Quote, QuoteLine
from erp.models import Category, InventoryLocation, Product, StockMovement, WarehouseStock
from organizations.models import Organization, Warehouse

from .automation import schedule_contract_production_if_approved
from .models import ProductionDevice, ProductionDevicePayloadMap, ProductionEvent, ProductionSettings, ProductionStepProgress, ProductionTemplatePreset, ProductionWorkOrder
from .services import ProductionError, clone_template_preset, create_work_order_from_contract, ensure_default_template_presets, record_station_event


class ProductionAutomationTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Demo Fabrika', code='DEMO')
        self.user = User.objects.create_user(username='admin', password='x', organization=self.org, role='Admin')
        self.customer = BusinessPartner.objects.create(organization=self.org, name='Demo Müşteri')
        self.category = Category.objects.create(
            organization=self.org,
            name='Modüler Ürün Grubu',
            template_defaults={'production_group_key': 'moduler_urun'},
        )
        self.product = Product.objects.create(
            organization=self.org,
            sku='PRD-001',
            name='Örnek Mamul',
            category=self.category,
            product_type='finished',
        )
        self.warehouse = Warehouse.objects.create(organization=self.org, name='Mamul Depo', code='MAMUL')
        self.location = InventoryLocation.objects.create(
            organization=self.org,
            warehouse=self.warehouse,
            code='A1',
            name='Tamamlanan ürünler',
        )
        ProductionSettings.objects.create(
            organization=self.org,
            default_completion_warehouse=self.warehouse,
            default_completion_location=self.location,
            auto_stock_in_enabled=True,
        )
        clone_template_preset(ensure_default_template_presets(), self.org)
        self.quote_counter = 0

    def make_contract(self, status='Approved', document_type='Contract'):
        self.quote_counter += 1
        quote = Quote.objects.create(
            organization=self.org,
            document_type=document_type,
            number=f'AY-S-260603{self.quote_counter:03d}',
            customer=self.customer,
            owner=self.user,
            prepared_by=self.user,
            status=status,
            valid_until=timezone.localdate(),
        )
        QuoteLine.objects.create(
            quote=quote,
            product=self.product,
            section_key='moduler_urun',
            name=self.product.name,
            unit='Adet',
            qty=Decimal('2'),
            unit_price=Decimal('1000'),
            tax=Decimal('20'),
            details={'primary': '100*210', 'secondary': 'Antrasit', 'technical_notes': 'Test teknik not'},
        )
        return quote

    def test_contract_creates_single_idempotent_work_order(self):
        quote = self.make_contract()

        first = create_work_order_from_contract(quote, user=self.user)
        second = create_work_order_from_contract(quote, user=self.user)

        self.assertEqual(first.id, second.id)
        self.assertEqual(ProductionWorkOrder.objects.count(), 1)
        line = first.lines.get()
        self.assertEqual(line.product_sku, self.product.sku)
        self.assertEqual(line.quantity, Decimal('2'))
        statuses = list(line.steps.order_by('order').values_list('status', flat=True))
        self.assertEqual(statuses[0], 'ready')
        self.assertTrue(all(status == 'locked' for status in statuses[1:]))

    def test_non_approved_or_non_contract_does_not_create_work_order(self):
        self.assertIsNone(create_work_order_from_contract(self.make_contract(status='Pending'), user=self.user))
        self.assertIsNone(create_work_order_from_contract(self.make_contract(document_type='Quote'), user=self.user))
        self.assertEqual(ProductionWorkOrder.objects.count(), 0)

    def test_approved_contract_schedules_delayed_task(self):
        quote = self.make_contract()

        with patch('production.tasks.enqueue_contract_for_production.apply_async') as apply_async:
            with self.captureOnCommitCallbacks(execute=True):
                schedule_contract_production_if_approved(quote, countdown=60)

        apply_async.assert_called_once()
        self.assertEqual(apply_async.call_args.kwargs['countdown'], 60)

    def test_contract_without_matching_route_does_not_create_work_order(self):
        ProductionWorkOrder.objects.all().delete()
        quote = self.make_contract()
        quote.organization.production_route_templates.all().delete()

        self.assertIsNone(create_work_order_from_contract(quote, user=self.user))
        self.assertEqual(ProductionWorkOrder.objects.count(), 0)

    def test_station_flow_completes_and_stocks_in_once(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()

        for step in line.steps.select_related('station').order_by('order'):
            event = record_station_event(
                organization=self.org,
                user=self.user,
                line_id=line.id,
                station_code=step.station.code,
                event_type='complete',
                note='Tamamlandi',
                idempotency_key=f'complete-{step.id}',
            )
            self.assertEqual(event.event_type, 'complete')

        line.refresh_from_db()
        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(line.completed_quantity, Decimal('2.00'))
        self.assertTrue(line.stock_in_done)
        self.assertEqual(order.status, 'completed')
        self.assertEqual(self.product.stock, Decimal('2.00'))
        self.assertEqual(StockMovement.objects.filter(source_type='production_work_order', source_id=str(order.id)).count(), 1)
        self.assertEqual(WarehouseStock.objects.get(product=self.product).quantity, Decimal('2.00'))

        final_step = line.steps.select_related('station').order_by('-order').first()
        repeated = record_station_event(
            organization=self.org,
            user=self.user,
            line_id=line.id,
            station_code=final_step.station.code,
            event_type='adjust',
            quantity_delta=Decimal('2'),
            idempotency_key='final-adjust',
        )
        self.assertEqual(repeated.event_type, 'adjust')
        self.assertEqual(StockMovement.objects.filter(source_type='production_work_order', source_id=str(order.id)).count(), 1)

    def test_pi_events_are_idempotent(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        device = ProductionDevice.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Raspberry Pi LZR',
            token='pi-token',
        )
        record_station_event(
            organization=self.org,
            user=self.user,
            source='ui',
            line_id=line.id,
            station_code=first_step.station.code,
            event_type='start',
            idempotency_key='operator-start-pi-event-1',
        )

        first = record_station_event(
            organization=self.org,
            user=None,
            device=device,
            source='pi',
            line_id=line.id,
            station_code=first_step.station.code,
            event_type='quantity',
            quantity_delta=Decimal('1'),
            idempotency_key='pi-event-1',
        )
        second = record_station_event(
            organization=self.org,
            user=None,
            device=device,
            source='pi',
            line_id=line.id,
            station_code=first_step.station.code,
            event_type='quantity',
            quantity_delta=Decimal('1'),
            idempotency_key='pi-event-1',
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(ProductionEvent.objects.filter(idempotency_key='pi-event-1').count(), 1)
        self.assertEqual(ProductionStepProgress.objects.get(pk=first_step.pk).completed_quantity, Decimal('1.00'))

    def test_pi_quantity_requires_operator_start(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        device = ProductionDevice.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Raspberry Pi guarded',
            token='pi-guard-token',
        )

        with self.assertRaisesMessage(ProductionError, 'operator istasyonu baslatmalidir'):
            record_station_event(
                organization=self.org,
                user=None,
                device=device,
                source='pi',
                line_id=line.id,
                station_code=first_step.station.code,
                event_type='quantity',
                quantity_delta=Decimal('1'),
                idempotency_key='pi-before-start',
            )

    def test_manager_can_clone_template_preset(self):
        manager = User.objects.create_user(username='manager', password='x', organization=self.org, role='Manager')
        client = APIClient()
        client.force_authenticate(manager)
        preset = ensure_default_template_presets()

        response = client.post(f'/api/production/template-presets/{preset.id}/clone/')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['routes'])

    def test_template_preset_clone_service_creates_normal_records(self):
        preset = ProductionTemplatePreset.objects.create(
            key='mini',
            name='Mini Fabrika',
            payload={
                'departments': [{'code': 'PRES', 'name': 'Pres', 'stations': [{'code': 'P1', 'name': 'Pres 1'}]}],
                'routes': [{'name': 'Mini Rota', 'product_group_key': 'mini'}],
            },
        )

        result = clone_template_preset(preset, self.org)

        self.assertEqual(result['stations'], 1)
        self.assertTrue(self.org.production_route_templates.filter(product_group_key='mini').exists())

    def test_view_only_user_can_read_settings_but_cannot_patch(self):
        perm, _ = Permission.objects.get_or_create(code='production.view', defaults={'description': 'İmalatı görüntüle'})
        RolePermission.objects.create(role='Viewer', permission=perm)
        viewer = User.objects.create_user(username='viewer', password='x', organization=self.org, role='Viewer')
        client = APIClient()
        client.force_authenticate(viewer)

        read_response = client.get('/api/production/settings/')
        write_response = client.patch('/api/production/settings/', {'auto_stock_in_enabled': False}, format='json')

        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(write_response.status_code, 403)

    def test_pi_event_maps_raw_payload_and_is_idempotent_without_key(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        device = ProductionDevice.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Raspberry Pi mapped',
            token='pi-map-token',
        )
        ProductionDevicePayloadMap.objects.create(
            organization=self.org,
            device=device,
            station=first_step.station,
            source_path='$.line',
            target_key='line_id',
            target_type='number',
            is_required=True,
        )
        ProductionDevicePayloadMap.objects.create(
            organization=self.org,
            device=device,
            station=first_step.station,
            source_path='$.counter.total',
            target_key='quantity_delta',
            target_type='number',
            is_required=True,
            order=1,
        )
        ProductionDevicePayloadMap.objects.create(
            organization=self.org,
            device=device,
            station=first_step.station,
            source_path='$.missing.required',
            target_key='missing_required',
            target_type='text',
            is_required=True,
            order=2,
        )
        client = APIClient()
        payload = {'token': 'pi-map-token', 'line': line.id, 'counter': {'total': 1}}
        record_station_event(
            organization=self.org,
            user=self.user,
            source='ui',
            line_id=line.id,
            station_code=first_step.station.code,
            event_type='start',
            idempotency_key='operator-start-pi-map',
        )

        first = client.post('/api/production/pi/events/', payload, format='json')
        second = client.post('/api/production/pi/events/', payload, format='json')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data['id'], second.data['id'])
        event = ProductionEvent.objects.get(pk=first.data['id'])
        self.assertEqual(event.raw_payload['line'], line.id)
        self.assertEqual(event.normalized_payload['line_id'], float(line.id))
        self.assertEqual(event.mapping_errors[0]['source_path'], '$.missing.required')
