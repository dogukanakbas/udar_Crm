from io import BytesIO

from django.db import transaction
from django.db.models import Sum
from django.http import FileResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from erp.views import OrgScopedMixin, _ensure_org
from permissions import HasAPIPermission, IsOrgMember

from .models import MdfMovement, MdfSku
from .pdf_export import build_mdf_exits_pdf, build_mdf_stock_pdf
from .serializers import MdfMovementSerializer, MdfSkuSerializer, MdfSkuThresholdSerializer, MdfStockInSerializer, MdfStockOutSerializer


def _status_label(qty: int, threshold: int) -> str:
    if qty <= 0:
        return 'Tukendi'
    if qty < threshold:
        return 'Az kaldi'
    return 'Mevcut'


class MdfSkuViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = MdfSkuSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'inventory.view'
    permission_map = {
        'create': 'inventory.edit',
        'update': 'inventory.edit',
        'partial_update': 'inventory.edit',
        'destroy': 'inventory.edit',
        'stock_in': 'inventory.edit',
        'stock_out': 'inventory.edit',
        'history': 'inventory.view',
        'consumption': 'inventory.view',
        'export_stock_pdf': 'inventory.view',
        'export_exits_pdf': 'inventory.view',
    }
    http_method_names = ['get', 'head', 'options', 'patch', 'post']

    # Aksi halde `mdf-skus/stock-in/` gibi yollar <pk> ile eşleşir ve POST 405 döner.
    lookup_value_regex = r'[0-9]+'

    queryset = MdfSku.objects.all()

    def get_serializer_class(self):
        if self.action == 'partial_update':
            return MdfSkuThresholdSerializer
        return MdfSkuSerializer

    def create(self, request, *args, **kwargs):
        return Response({'detail': 'Doğrudan oluşturma desteklenmiyor; stock-in kullanın.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Silme kapalı.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=['post'], url_path='stock-in')
    def stock_in(self, request):
        ser = MdfStockInSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = _ensure_org(request)
        d = ser.validated_data
        mdate = d.get('movement_date') or timezone.localdate()
        note = (d.get('note') or '').strip()

        with transaction.atomic():
            sku, _created = MdfSku.objects.select_for_update().get_or_create(
                organization=org,
                thickness_mm=d['thickness_mm'],
                width_cm=d['width_cm'],
                height_cm=d['height_cm'],
                defaults={'min_threshold': 10, 'quantity': 0},
            )
            sku.quantity = (sku.quantity or 0) + d['quantity']
            sku.save(update_fields=['quantity', 'updated_at'])
            MdfMovement.objects.create(
                organization=org,
                sku=sku,
                kind=MdfMovement.KIND_IN,
                quantity=d['quantity'],
                movement_date=mdate,
                note=note,
                created_by=request.user if request.user.is_authenticated else None,
            )
        return Response(MdfSkuSerializer(sku).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='stock-out')
    def stock_out(self, request):
        org = _ensure_org(request)
        ser = MdfStockOutSerializer(data=request.data)
        ser.fields['sku'].queryset = MdfSku.objects.filter(organization=org)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        sku = d['sku']
        if sku.organization_id != org.id:
            raise ValidationError({'sku': 'Bu levha sizin organizasyonunuza ait değil.'})
        qty = d['quantity']
        mdate = d['movement_date']
        note = (d.get('usage') or '').strip()

        with transaction.atomic():
            locked = MdfSku.objects.select_for_update().get(pk=sku.pk)
            if locked.quantity < qty:
                raise ValidationError({'quantity': f'Yetersiz stok (mevcut: {locked.quantity}).'})
            locked.quantity -= qty
            locked.save(update_fields=['quantity', 'updated_at'])
            MdfMovement.objects.create(
                organization=org,
                sku=locked,
                kind=MdfMovement.KIND_OUT,
                quantity=qty,
                movement_date=mdate,
                note=note,
                created_by=request.user if request.user.is_authenticated else None,
            )
        return Response(MdfSkuSerializer(locked).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        org = _ensure_org(request)
        qs = MdfMovement.objects.filter(organization=org).select_related('sku')
        df = request.query_params.get('date_from')
        dt = request.query_params.get('date_to')
        if df:
            qs = qs.filter(movement_date__gte=df)
        if dt:
            qs = qs.filter(movement_date__lte=dt)

        entries = qs.filter(kind=MdfMovement.KIND_IN)
        exits = qs.filter(kind=MdfMovement.KIND_OUT)
        return Response(
            {
                'entries': MdfMovementSerializer(entries, many=True).data,
                'exits': MdfMovementSerializer(exits, many=True).data,
            }
        )

    @action(detail=False, methods=['get'], url_path='consumption')
    def consumption(self, request):
        org = _ensure_org(request)
        today = timezone.localdate()
        try:
            year = int(request.query_params.get('year') or today.year)
            month = int(request.query_params.get('month') or today.month)
        except (TypeError, ValueError):
            year, month = today.year, today.month
        month = max(1, min(12, month))

        rows = (
            MdfMovement.objects.filter(
                organization=org,
                kind=MdfMovement.KIND_OUT,
                movement_date__year=year,
                movement_date__month=month,
            )
            .values('sku__thickness_mm')
            .annotate(total=Sum('quantity'))
            .order_by('sku__thickness_mm')
        )
        total = sum(int(r['total'] or 0) for r in rows)
        series = []
        for r in rows:
            t = int(r['sku__thickness_mm'])
            val = int(r['total'] or 0)
            pct = round((100.0 * val / total), 1) if total else 0.0
            series.append({'thickness_mm': t, 'value': val, 'pct': pct, 'label': f'{t}mm'})
        months_tr = (
            '',
            'Ocak',
            'Şubat',
            'Mart',
            'Nisan',
            'Mayıs',
            'Haziran',
            'Temmuz',
            'Ağustos',
            'Eylül',
            'Ekim',
            'Kasım',
            'Aralık',
        )
        month_label = f'{months_tr[month]} {year}'
        return Response({'year': year, 'month': month, 'month_label': month_label, 'total': total, 'series': series})

    @action(detail=False, methods=['get'], url_path='export-stock-pdf')
    def export_stock_pdf(self, request):
        org = _ensure_org(request)
        skus = list(MdfSku.objects.filter(organization=org).order_by('thickness_mm', 'width_cm', 'height_cm'))
        pdf_rows = []
        for s in skus:
            pdf_rows.append(
                (
                    f'{s.thickness_mm} mm',
                    f'{s.width_cm} × {s.height_cm}',
                    str(s.quantity),
                    str(s.min_threshold),
                    _status_label(s.quantity, s.min_threshold),
                )
            )
        title = f'MDF stok raporu - {org.name}'
        data = build_mdf_stock_pdf(title, pdf_rows)
        return FileResponse(BytesIO(data), as_attachment=True, filename='mdf-stok.pdf', content_type='application/pdf')

    @action(detail=False, methods=['get'], url_path='export-exits-pdf')
    def export_exits_pdf(self, request):
        org = _ensure_org(request)
        qs = MdfMovement.objects.filter(organization=org, kind=MdfMovement.KIND_OUT).select_related('sku').order_by('-movement_date', '-id')
        df = request.query_params.get('date_from')
        dt = request.query_params.get('date_to')
        if df:
            qs = qs.filter(movement_date__gte=df)
        if dt:
            qs = qs.filter(movement_date__lte=dt)
        pdf_rows = []
        for m in qs[:500]:
            sku = m.sku
            pdf_rows.append(
                (
                    m.movement_date.isoformat(),
                    f'{sku.thickness_mm} mm',
                    f'{sku.width_cm} × {sku.height_cm}',
                    str(m.quantity),
                    (m.note or '')[:200],
                )
            )
        title = f'MDF cikis raporu - {org.name}'
        data = build_mdf_exits_pdf(title, pdf_rows)
        return FileResponse(BytesIO(data), as_attachment=True, filename='mdf-cikis.pdf', content_type='application/pdf')
