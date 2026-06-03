from decimal import Decimal
from unittest.mock import patch

from django.db.models import Max
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Permission, RolePermission, User
from crm.models import BusinessPartner, Quote, QuoteLine
from erp.models import Category, InventoryLocation, Product, StockMovement, WarehouseStock
from organizations.models import Organization, Warehouse

from .automation import schedule_contract_production_if_approved
from .models import (
    ProductionDevice,
    ProductionDevicePayloadMap,
    ProductionEvent,
    ProductionCountingParticipant,
    ProductionCountingWindow,
    ProductionOperatorProfile,
    ProductionSessionBreak,
    ProductionSettings,
    ProductionStationTarget,
    ProductionStationTablet,
    ProductionStationUser,
    ProductionStepProgress,
    ProductionStepTabletAssignment,
    ProductionTemplatePreset,
    ProductionWorkOrder,
    ProductionWorkSession,
)
from .services import (
    ProductionError,
    clone_template_preset,
    close_work_session,
    create_work_order_from_contract,
    ensure_default_template_presets,
    handover_work_session,
    record_machine_session_event,
    record_station_event,
    start_work_session,
    tablet_login_slot,
    tablet_logout_slot,
    tablet_pause_session,
    tablet_resume_session,
    tablet_checkpoint,
    tablet_complete_work_item,
    tablet_context,
)


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

    def test_unassigned_worker_cannot_start_station_session(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        worker = User.objects.create_user(username='worker-no-station', password='x', organization=self.org, role='Worker')
        client = APIClient()
        client.force_authenticate(worker)

        response = client.post(
            '/api/production/station-sessions/start/',
            {'line_id': line.id, 'station_code': first_step.station.code},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('atanmış kullanıcı', response.data['detail'])

    def test_machine_data_attaches_to_open_session_without_official_completion(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=self.user)
        session = start_work_session(
            organization=self.org,
            user=self.user,
            line_id=line.id,
            station_code=first_step.station.code,
        )

        event = record_machine_session_event(
            organization=self.org,
            line_id=line.id,
            station_code=first_step.station.code,
            quantity_delta=Decimal('3'),
            idempotency_key='machine-open-session',
        )

        session.refresh_from_db()
        first_step.refresh_from_db()
        self.assertEqual(event.session_id, session.id)
        self.assertEqual(session.machine_quantity, Decimal('3.00'))
        self.assertEqual(first_step.machine_quantity, Decimal('3.00'))
        self.assertEqual(first_step.completed_quantity, Decimal('0.00'))

    def test_session_close_declares_official_quantity_and_flags_discrepancy(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=self.user)
        session = start_work_session(
            organization=self.org,
            user=self.user,
            line_id=line.id,
            station_code=first_step.station.code,
        )
        record_machine_session_event(
            organization=self.org,
            line_id=line.id,
            station_code=first_step.station.code,
            quantity_delta=Decimal('2'),
            idempotency_key='machine-two',
        )

        close_work_session(
            organization=self.org,
            user=self.user,
            session_id=session.id,
            declared_good_quantity=Decimal('1'),
            note='Vardiya kapandı',
        )

        session.refresh_from_db()
        first_step.refresh_from_db()
        self.assertEqual(session.declared_good_quantity, Decimal('1.00'))
        self.assertEqual(session.discrepancy_quantity, Decimal('1.00'))
        self.assertEqual(session.discrepancy_status, 'needs_review')
        self.assertEqual(first_step.completed_quantity, Decimal('1.00'))
        self.assertEqual(first_step.status, 'waiting_handover')

    def test_shift_handover_allows_next_user_to_continue_same_step(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        next_worker = User.objects.create_user(username='next-worker', password='x', organization=self.org, role='Worker')
        ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=self.user)
        ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=next_worker)
        first_session = start_work_session(
            organization=self.org,
            user=self.user,
            line_id=line.id,
            station_code=first_step.station.code,
        )

        handover_work_session(organization=self.org, user=self.user, session_id=first_session.id, note='Vardiya değişimi')
        second_session = start_work_session(
            organization=self.org,
            user=next_worker,
            line_id=line.id,
            station_code=first_step.station.code,
        )

        first_session.refresh_from_db()
        self.assertEqual(first_session.status, 'handover')
        self.assertEqual(second_session.previous_session_id, first_session.id)
        self.assertEqual(ProductionWorkSession.objects.filter(step=first_step, status__in=['started', 'paused']).count(), 1)

    def test_tablet_slots_allow_multiple_assigned_workers_with_pin(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        first_step.station.max_workers = 2
        first_step.station.save(update_fields=['max_workers'])
        worker_one = User.objects.create_user(username='tablet-one', password='x', organization=self.org, role='Worker')
        worker_two = User.objects.create_user(username='tablet-two', password='x', organization=self.org, role='Worker')
        worker_three = User.objects.create_user(username='tablet-three', password='x', organization=self.org, role='Worker')
        for worker, pin in [(worker_one, '1111'), (worker_two, '2222'), (worker_three, '3333')]:
            ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=worker)
            profile = ProductionOperatorProfile.objects.create(organization=self.org, user=worker)
            profile.set_pin(pin)
            profile.save()
        tablet = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Tablet 1',
            token='tablet-token-1',
        )

        first_session = tablet_login_slot(token=tablet.token, user_id=worker_one.id, pin='1111', line_id=line.id, slot_index=0)
        with self.assertRaisesMessage(ProductionError, 'ortak uretim toplamı'):
            tablet_login_slot(token=tablet.token, user_id=worker_two.id, pin='2222', line_id=line.id, slot_index=1)
        second_session = tablet_login_slot(
            token=tablet.token,
            user_id=worker_two.id,
            pin='2222',
            line_id=line.id,
            slot_index=1,
            checkpoint_total=Decimal('0'),
        )

        self.assertEqual(first_session.slot_index, 0)
        self.assertEqual(second_session.slot_index, 1)
        self.assertEqual(ProductionWorkSession.objects.filter(step=first_step, status__in=['started', 'paused']).count(), 2)
        with self.assertRaises(ProductionError):
            tablet_login_slot(token=tablet.token, user_id=worker_three.id, pin='3333', line_id=line.id, slot_index=0)

    def test_tablet_break_resume_and_logout_declare_official_quantity(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        worker = User.objects.create_user(username='tablet-break', password='x', organization=self.org, role='Worker')
        ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=worker)
        profile = ProductionOperatorProfile.objects.create(organization=self.org, user=worker)
        profile.set_pin('1234')
        profile.save()
        tablet = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Tablet 1',
            token='tablet-token-2',
        )
        session = tablet_login_slot(token=tablet.token, user_id=worker.id, pin='1234', line_id=line.id, slot_index=0)

        tablet_pause_session(token=tablet.token, session_id=session.id, note='Çay molası', checkpoint_total=Decimal('0'))
        self.assertEqual(ProductionSessionBreak.objects.filter(session=session, ended_at__isnull=True).count(), 1)
        tablet_resume_session(token=tablet.token, session_id=session.id)
        self.assertEqual(ProductionSessionBreak.objects.filter(session=session, ended_at__isnull=True).count(), 0)
        tablet_logout_slot(
            token=tablet.token,
            user_id=worker.id,
            pin='1234',
            session_id=session.id,
            declared_good_quantity=Decimal('1'),
        )

        session.refresh_from_db()
        first_step.refresh_from_db()
        self.assertEqual(session.status, 'closed')
        self.assertEqual(session.declared_good_quantity, Decimal('1.00'))
        self.assertEqual(first_step.completed_quantity, Decimal('1.00'))

    def test_shared_tablet_checkpoint_credits_people_without_double_counting_station_output(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        first_step.target_quantity = Decimal('100')
        first_step.save(update_fields=['target_quantity'])
        first_step.station.max_workers = 2
        first_step.station.save(update_fields=['max_workers'])
        ali = User.objects.create_user(username='ali-operator', password='x', organization=self.org, role='Worker')
        veli = User.objects.create_user(username='veli-operator', password='x', organization=self.org, role='Worker')
        for worker, pin in [(ali, '1111'), (veli, '2222')]:
            ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=worker)
            profile = ProductionOperatorProfile.objects.create(organization=self.org, user=worker)
            profile.set_pin(pin)
            profile.save()
        tablet = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Ortak Tablet',
            token='shared-window-tablet',
        )

        ali_session = tablet_login_slot(token=tablet.token, user_id=ali.id, pin='1111', line_id=line.id, slot_index=0)
        veli_session = tablet_login_slot(
            token=tablet.token,
            user_id=veli.id,
            pin='2222',
            line_id=line.id,
            slot_index=1,
            checkpoint_total=Decimal('0'),
        )
        tablet_pause_session(
            token=tablet.token,
            session_id=ali_session.id,
            checkpoint_total=Decimal('60'),
            note='Ali molaya çıktı',
        )
        first_step.refresh_from_db()
        ali_session.refresh_from_db()
        veli_session.refresh_from_db()
        self.assertEqual(first_step.completed_quantity, Decimal('60.00'))
        self.assertEqual(ali_session.declared_good_quantity, Decimal('60.00'))
        self.assertEqual(veli_session.declared_good_quantity, Decimal('60.00'))

        tablet_checkpoint(token=tablet.token, line_id=line.id, checkpoint_total=Decimal('70'), reason='manual')

        first_step.refresh_from_db()
        ali_session.refresh_from_db()
        veli_session.refresh_from_db()
        self.assertEqual(first_step.completed_quantity, Decimal('70.00'))
        self.assertEqual(ali_session.declared_good_quantity, Decimal('60.00'))
        self.assertEqual(veli_session.declared_good_quantity, Decimal('70.00'))
        self.assertEqual(ProductionCountingWindow.objects.filter(step=first_step, status='closed').count(), 3)
        self.assertEqual(
            ProductionCountingParticipant.objects.filter(session=veli_session).aggregate(total=Max('credited_quantity'))['total'],
            Decimal('70.00'),
        )

    def test_station_daily_target_is_independent_from_work_order_quantity(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        first_step.target_quantity = Decimal('100')
        first_step.save(update_fields=['target_quantity'])
        worker = User.objects.create_user(username='target-worker', password='x', organization=self.org, role='Worker')
        ProductionStationUser.objects.create(organization=self.org, station=first_step.station, user=worker)
        profile = ProductionOperatorProfile.objects.create(organization=self.org, user=worker)
        profile.set_pin('4444')
        profile.save()
        ProductionStationTarget.objects.create(
            organization=self.org,
            station=first_step.station,
            target_date=timezone.localdate(),
            target_quantity=Decimal('250'),
        )
        tablet = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Hedef Tablet',
            token='daily-target-tablet',
        )
        session = tablet_login_slot(token=tablet.token, user_id=worker.id, pin='4444', line_id=line.id, slot_index=0)
        tablet_logout_slot(
            token=tablet.token,
            user_id=worker.id,
            pin='4444',
            session_id=session.id,
            declared_good_quantity=Decimal('25'),
        )

        context = tablet_context(tablet.token)

        self.assertEqual(context['daily_target']['target_quantity'], Decimal('250.00'))
        self.assertEqual(context['daily_target']['actual_quantity'], Decimal('25.00'))
        self.assertEqual(context['daily_target']['remaining_quantity'], Decimal('225.00'))

    def test_station_work_queue_is_broadcast_to_all_station_tablets_by_default(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        tablet_one = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Pres Tablet 1',
            token='broadcast-tablet-1',
        )
        tablet_two = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Pres Tablet 2',
            token='broadcast-tablet-2',
        )

        first_context = tablet_context(tablet_one.token)
        second_context = tablet_context(tablet_two.token)

        self.assertEqual(first_context['work_items'][0]['line_id'], line.id)
        self.assertEqual(second_context['work_items'][0]['line_id'], line.id)
        self.assertEqual(first_context['work_items'][0]['visibility'], 'all_tablets')
        self.assertFalse(first_context['work_items'][0]['is_pinned'])

    def test_station_work_queue_can_be_targeted_to_a_specific_tablet(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step = line.steps.select_related('station').order_by('order').first()
        tablet_one = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Hedef Tablet',
            token='target-tablet-1',
        )
        tablet_two = ProductionStationTablet.objects.create(
            organization=self.org,
            station=first_step.station,
            name='Normal Tablet',
            token='target-tablet-2',
        )
        ProductionStepTabletAssignment.objects.create(
            organization=self.org,
            step=first_step,
            tablet=tablet_one,
            priority=0,
            is_pinned=True,
            note='Acil iş',
        )

        targeted_context = tablet_context(tablet_one.token)
        other_context = tablet_context(tablet_two.token)

        self.assertEqual(targeted_context['work_items'][0]['line_id'], line.id)
        self.assertEqual(targeted_context['work_items'][0]['visibility'], 'selected_tablets')
        self.assertTrue(targeted_context['work_items'][0]['is_pinned'])
        self.assertEqual(targeted_context['work_items'][0]['assigned_tablet_ids'], [tablet_one.id])
        self.assertEqual(other_context['work_items'], [])

    def test_parallel_route_step_is_visible_before_previous_step_completes(self):
        route = self.org.production_route_templates.first()
        second_route_step = route.steps.order_by('order', 'id')[1]
        second_route_step.start_policy = 'parallel'
        second_route_step.save(update_fields=['start_policy'])
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        first_step, second_step = list(line.steps.select_related('station', 'route_step').order_by('order')[:2])
        tablet = ProductionStationTablet.objects.create(
            organization=self.org,
            station=second_step.station,
            name='Paralel Tablet',
            token='parallel-tablet-1',
        )

        context = tablet_context(tablet.token)

        self.assertEqual(first_step.status, 'ready')
        self.assertEqual(second_step.status, 'ready')
        self.assertEqual(context['work_items'][0]['line_id'], line.id)
        self.assertEqual(context['work_items'][0]['start_policy'], 'parallel')

    def test_after_previous_route_step_stays_hidden_until_previous_completion(self):
        quote = self.make_contract()
        order = create_work_order_from_contract(quote, user=self.user)
        line = order.lines.get()
        second_step = line.steps.select_related('station').order_by('order')[1]
        tablet = ProductionStationTablet.objects.create(
            organization=self.org,
            station=second_step.station,
            name='Sıralı Tablet',
            token='after-previous-tablet-1',
        )

        context = tablet_context(tablet.token)

        self.assertEqual(second_step.status, 'locked')
        self.assertEqual(context['work_items'], [])
