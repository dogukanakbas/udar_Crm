from copy import deepcopy
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from xml.etree import ElementTree

from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
import mimetypes

from django.conf import settings
from django.utils import timezone
from django.http import FileResponse
from PIL import Image, UnidentifiedImageError

from .models import Quote, QuoteLine, PricingRule, BusinessPartner, Lead, Opportunity, Contact
from .contracts import (
    build_document_export,
    build_document_pdf_export,
    get_default_seller_profiles,
    get_seller_profiles,
    get_template_download,
    list_document_exports,
    list_template_library,
    list_template_placeholders,
    normalize_seller_company_key,
    save_seller_profiles,
    save_template_override,
    _normalize_seller_profile,
)
from workflow.models import ApprovalInstance, ApprovalStep
from erp.models import Product
from .serializers import QuoteListSerializer, QuoteSerializer, PricingRuleSerializer, BusinessPartnerSerializer, ProductSerializer, LeadSerializer, OpportunitySerializer, ContactSerializer
from permissions import IsOrgMember, IsOwnerOrManager, HasAPIPermission
from audit.utils import log_entity_action

EXCEL_TEMPLATE_CONTENT_TYPES = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
}

ALLOWED_LOGO_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.svg'}
MAX_LOGO_FILE_SIZE = 3 * 1024 * 1024
DISALLOWED_SVG_TAGS = {'script', 'foreignobject', 'iframe', 'object', 'embed'}


def _relative_media_path_for_url(url):
    value = str(url or '').strip()
    if not value:
        return ''
    media_prefix = settings.MEDIA_URL.rstrip('/') + '/'
    if value.startswith(media_prefix):
        return value[len(media_prefix):]
    return value.lstrip('/')


def _delete_logo_file(relative_path):
    path_value = _relative_media_path_for_url(relative_path)
    if not path_value:
        return
    target = Path(settings.MEDIA_ROOT) / path_value
    try:
        target.resolve().relative_to(Path(settings.MEDIA_ROOT).resolve())
    except Exception:
        return
    if target.exists() and target.is_file():
        target.unlink()


def _validate_raster_logo(content, extension):
    try:
        image = Image.open(BytesIO(content))
        image.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError('Logo dosyasi gecersiz veya bozuk.') from exc
    image = Image.open(BytesIO(content))
    if image.format not in {'PNG', 'JPEG'}:
        raise ValueError('Yalnizca PNG veya JPEG logo dosyalari kabul edilir.')
    if extension == '.png' and image.format != 'PNG':
        raise ValueError('PNG uzantili dosya gercek bir PNG olmali.')
    if extension in {'.jpg', '.jpeg'} and image.format != 'JPEG':
        raise ValueError('JPG/JPEG uzantili dosya gercek bir JPEG olmali.')


def _validate_svg_logo(content):
    try:
        decoded = content.decode('utf-8')
    except UnicodeDecodeError as exc:
        raise ValueError('SVG dosyasi UTF-8 olarak kaydedilmelidir.') from exc

    try:
        root = ElementTree.fromstring(decoded)
    except ElementTree.ParseError as exc:
        raise ValueError('SVG dosyasi gecersiz veya bozuk.') from exc

    if root.tag.split('}')[-1].lower() != 'svg':
        raise ValueError('Yuklenen SVG dosyasinin kok etiketi svg olmali.')

    for element in root.iter():
        tag_name = element.tag.split('}')[-1].lower()
        if tag_name in DISALLOWED_SVG_TAGS:
            raise ValueError('SVG icinde guvensiz etiketler kullanilamaz.')
        for attr_name, attr_value in element.attrib.items():
            name = attr_name.split('}')[-1].lower()
            value = str(attr_value or '').strip().lower()
            if name.startswith('on'):
                raise ValueError('SVG event handler attribute kullanamaz.')
            if name in {'href', 'xlink:href'} and value and not value.startswith('#'):
                raise ValueError('SVG dis kaynak referansi kullanamaz.')
            if 'javascript:' in value:
                raise ValueError('SVG javascript iceremez.')


def _save_seller_logo_file(org, key, uploaded_file):
    extension = Path(str(getattr(uploaded_file, 'name', '') or '')).suffix.lower()
    if extension not in ALLOWED_LOGO_EXTENSIONS:
        raise ValueError('Yalnizca PNG, JPG, JPEG veya SVG logo yukleyebilirsiniz.')
    if uploaded_file.size > MAX_LOGO_FILE_SIZE:
        raise ValueError('Logo dosyasi 3 MB boyutunu asamaz.')

    content = uploaded_file.read()
    if not content:
        raise ValueError('Bos dosya yuklenemez.')

    if extension == '.svg':
        _validate_svg_logo(content)
    else:
        _validate_raster_logo(content, extension)

    directory = Path(settings.MEDIA_ROOT) / 'seller-logos' / f'org_{org.id}'
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{normalize_seller_company_key(key)}-{uuid4().hex[:8]}{extension}"
    target = directory / filename
    with open(target, 'wb') as handle:
        handle.write(content)
    return f"{settings.MEDIA_URL.rstrip('/')}/seller-logos/org_{org.id}/{filename}"


def _seller_number_prefix(organization, seller_company_key):
    selected_key = normalize_seller_company_key(seller_company_key or '')
    profiles = [profile for profile in get_seller_profiles(organization) if profile.get('is_active', True)] or get_default_seller_profiles()
    selected_profile = None
    for profile in profiles:
        if normalize_seller_company_key(profile.get('key')) == selected_key:
            selected_profile = profile
            break
    selected_profile = selected_profile or profiles[0]
    source = (
        selected_profile.get('short_name')
        or selected_profile.get('key')
        or selected_profile.get('display_name')
        or organization.code
        or organization.name
        or 'UD'
    )
    normalized = normalize_seller_company_key(source)
    return (normalized[:2] or 'UD').upper()


def _generate_sales_document_number(organization, document_type, seller_company_key):
    document_letter = 'S' if document_type == 'Contract' else 'T'
    timestamp = timezone.localtime(timezone.now()).strftime('%y%m%d%H%M')
    base = f'{_seller_number_prefix(organization, seller_company_key)}-{document_letter}-{timestamp}'
    candidate = base
    suffix = 2
    while Quote.objects.filter(organization=organization, number=candidate).exists():
        candidate = f'{base}-{suffix}'
        suffix += 1
    return candidate


class OrgScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        return qs

    def perform_create(self, serializer):
        org = getattr(self.request.user, 'organization', None)
        serializer.save(organization=org)


class QuoteViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = QuoteSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, IsOwnerOrManager, HasAPIPermission]
    required_perm = 'quotes.view'
    permission_map = {
        'create': 'quotes.edit',
        'update': 'quotes.edit',
        'partial_update': 'quotes.edit',
        'destroy': 'quotes.edit',
        'send': 'quotes.edit',
        'convert': 'quotes.edit',
        'request_approval': 'quotes.edit',
        'resubmit': 'quotes.edit',
        'approve': 'quotes.approve',
        'reject': 'quotes.approve',
        'apply_preview': 'quotes.edit',
        'template_library_upload': 'pricing.manage',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['number', 'customer__name', 'status', 'document_type']
    ordering_fields = ['created_at', 'total']
    queryset = Quote.objects.all()

    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('summary') == '1':
            return QuoteListSerializer
        return QuoteSerializer

    def _attach_audit_user(self, quote):
        quote._audit_user = self.request.user
        return quote

    def get_queryset(self):
        qs = super().get_queryset().select_related('customer', 'owner', 'prepared_by')
        if not (self.action == 'list' and self.request.query_params.get('summary') == '1'):
            qs = qs.prefetch_related('lines__product__category')
        user = self.request.user
        document_type = self.request.query_params.get('document_type')
        if document_type:
            qs = qs.filter(document_type=document_type)
        prepared_by = self.request.query_params.get('prepared_by')
        if prepared_by and getattr(user, 'role', '') in ['Admin', 'Manager']:
            if prepared_by == '__empty__':
                qs = qs.filter(prepared_by__isnull=True)
            else:
                qs = qs.filter(prepared_by_id=prepared_by)
        if getattr(user, 'role', '') not in ['Admin', 'Manager']:
            qs = qs.filter(owner=user)
        return qs.order_by('-created_at', '-id')

    def perform_create(self, serializer):
        org = self.request.user.organization
        document_type = serializer.validated_data.get('document_type', 'Quote')
        seller_company_key = serializer.validated_data.get('seller_company_key', '')
        number = _generate_sales_document_number(org, document_type, seller_company_key)
        serializer.save(organization=org, number=number, owner=self.request.user, prepared_by=self.request.user)

    def perform_update(self, serializer):
        serializer.instance._audit_user = self.request.user
        serializer.save()

    def perform_destroy(self, instance):
        self._attach_audit_user(instance)
        instance.delete()

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        quote.status = 'Sent'
        quote.save(update_fields=['status'])
        log_entity_action(quote, 'sent', user=request.user)
        return Response({'status': 'sent', 'quote': QuoteSerializer(quote, context={'request': request}).data})

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        if quote.document_type != 'Quote':
            return Response({'detail': 'Yalnizca teklifler sozlesmeye donusturulebilir.'}, status=status.HTTP_400_BAD_REQUEST)

        source_config = deepcopy(quote.contract_config or {})
        existing_contract_id = source_config.get('converted_contract_id')
        if existing_contract_id:
            existing_contract = (
                Quote.objects.filter(organization=quote.organization, pk=existing_contract_id, document_type='Contract')
                .select_related('customer', 'owner', 'prepared_by')
                .prefetch_related('lines__product__category')
                .first()
            )
            if existing_contract:
                return Response(
                    {
                        'status': 'converted',
                        'contract': QuoteSerializer(existing_contract, context={'request': request}).data,
                        'source': QuoteSerializer(quote, context={'request': request}).data,
                    }
                )

        contract_number = _generate_sales_document_number(
            quote.organization,
            'Contract',
            quote.seller_company_key,
        )
        contract_config = deepcopy(quote.contract_config or {})
        contract_config['source_quote_id'] = quote.id
        contract_config['source_quote_number'] = quote.number

        contract = Quote.objects.create(
            organization=quote.organization,
            document_type='Contract',
            number=contract_number,
            customer=quote.customer,
            opportunity=quote.opportunity,
            owner=quote.owner or request.user,
            prepared_by=quote.prepared_by or request.user,
            seller_company_key=quote.seller_company_key,
            status='Draft',
            valid_until=quote.valid_until,
            currency=quote.currency,
            payment_terms=quote.payment_terms,
            delivery_terms=quote.delivery_terms,
            notes=quote.notes,
            vat_rate=quote.vat_rate,
            contract_config=contract_config,
        )
        contract._audit_user = request.user

        for line in quote.lines.all().order_by('sort_order', 'id'):
            QuoteLine.objects.create(
                quote=contract,
                product=line.product,
                section_key=line.section_key,
                name=line.name,
                unit=line.unit,
                qty=line.qty,
                unit_price=line.unit_price,
                discount=line.discount,
                discount_secondary=line.discount_secondary,
                tax=line.tax,
                sort_order=line.sort_order,
                details=deepcopy(line.details or {}),
            )

        QuoteSerializer(context={'request': request})._recalc(contract)

        source_config['converted_contract_id'] = contract.id
        source_config['converted_contract_number'] = contract.number
        quote.contract_config = source_config
        quote.status = 'Converted'
        quote.save(update_fields=['status', 'contract_config'])

        log_entity_action(quote, 'converted', user=request.user, field='converted_contract_id', new_value=str(contract.id))
        log_entity_action(contract, 'created_from_quote', user=request.user, field='source_quote_id', new_value=str(quote.id))
        return Response(
            {
                'status': 'converted',
                'contract': QuoteSerializer(contract, context={'request': request}).data,
                'source': QuoteSerializer(quote, context={'request': request}).data,
            }
        )

    @action(detail=True, methods=['post'])
    def request_approval(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        approval, _ = ApprovalInstance.objects.get_or_create(organization=quote.organization, quote=quote)
        # reset steps
        approval.steps.all().delete()
        for role in ['Sales', 'Manager', 'Finance']:
            ApprovalStep.objects.create(instance=approval, role=role, status='Waiting')
        approval.status = 'Waiting'
        approval.save(update_fields=['status'])
        quote.status = 'Under Review'
        quote.save(update_fields=['status'])
        log_entity_action(quote, 'request_approval', user=request.user)
        return Response({'status': 'under_review'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        role = request.data.get('role', getattr(request.user, 'role', 'Manager'))
        if getattr(request.user, 'role', None) not in ['Admin', role]:
            return Response({'error': 'Role mismatch'}, status=403)
        ordered_roles = ['Sales', 'Manager', 'Finance']
        approval = ApprovalInstance.objects.filter(quote=quote).first()
        if not approval:
            return Response({'error': 'Approval not started'}, status=400)
        # ensure step exists
        try:
            step = approval.steps.get(role=role)
        except ApprovalStep.DoesNotExist:
            return Response({'error': 'Role not in approval chain'}, status=400)
        # ensure previous steps are approved
        current_idx = ordered_roles.index(role)
        previous_roles = ordered_roles[:current_idx]
        if approval.steps.filter(role__in=previous_roles, status__in=['Waiting', 'Rejected']).exists():
            return Response({'error': 'Previous step not approved'}, status=400)
        # approve this step
        step.status = 'Approved'
        step.acted_by = request.user
        step.save(update_fields=['status', 'acted_by'])
        # update instance and quote status
        if role == 'Finance':
            quote.status = 'Approved'
            approval.status = 'Approved'
        else:
            quote.status = 'Under Review'
            approval.status = 'Waiting'
        quote.save(update_fields=['status'])
        approval.save(update_fields=['status'])
        log_entity_action(quote, f'approved_{role}', user=request.user)
        return Response({'status': 'approved', 'role': role})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        role = request.data.get('role', getattr(request.user, 'role', 'Manager'))
        if getattr(request.user, 'role', None) not in ['Admin', role]:
            return Response({'error': 'Role mismatch'}, status=403)
        reason = request.data.get('reason', '')
        approval = ApprovalInstance.objects.filter(quote=quote).first()
        if not approval:
            return Response({'error': 'Approval not started'}, status=400)
        try:
            step = approval.steps.get(role=role)
        except ApprovalStep.DoesNotExist:
            return Response({'error': 'Role not in approval chain'}, status=400)
        step.status = 'Rejected'
        step.comment = reason
        step.acted_by = request.user
        step.save(update_fields=['status', 'comment', 'acted_by'])
        approval.status = 'Rejected'
        approval.save(update_fields=['status'])
        quote.status = 'Rejected'
        quote.save(update_fields=['status'])
        log_entity_action(quote, f'rejected_{role}', user=request.user, field='reason', new_value=reason)
        return Response({'status': 'rejected', 'role': role, 'reason': reason})

    @action(detail=True, methods=['post'])
    def resubmit(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        approval = ApprovalInstance.objects.filter(quote=quote).first()
        if not approval:
            return Response({'error': 'Approval not started'}, status=400)
        # reset all steps to Waiting
        approval.steps.all().update(status='Waiting', comment='', acted_by=None)
        approval.status = 'Waiting'
        approval.save(update_fields=['status'])
        quote.status = 'Under Review'
        quote.save(update_fields=['status'])
        log_entity_action(quote, 'resubmitted', user=request.user)
        return Response({'status': 'under_review'})

    @action(detail=False, methods=['post'])
    def apply_preview(self, request):
        """
        Apply pricing rules server-side and return recalculated totals for preview.
        """
        data = request.data
        org = request.user.organization
        rules = PricingRule.objects.filter(organization=org)
        lines = data.get('lines', [])
        subtotal = sum([float(l.get('qty', 0)) * float(l.get('unitPrice', 0)) for l in lines])
        discount_total = 0
        for l in lines:
            base = float(l.get('qty', 0)) * float(l.get('unitPrice', 0))
            cat = l.get('category')
            first_discount_rate = min(max(float(l.get('discount', 0) or 0), 0), 50) / 100
            second_discount_rate = min(max(float(l.get('discountSecondary', l.get('discount_secondary', 0)) or 0), 0), 12) / 100
            discounted_base = base * (1 - first_discount_rate)
            discounted_base *= 1 - second_discount_rate
            discount_total += base - discounted_base
            # category rule
            for r in rules.filter(type='category', target=cat):
                discount_total += base * float(r.value) / 100
        # customer rule
        partner_group = data.get('customerGroup')
        for r in rules.filter(type='customer', target=partner_group):
            discount_total += subtotal * float(r.value) / 100
        # volume rule
        for r in rules.filter(type='volume'):
            try:
                threshold = float(r.target)
            except Exception:
                threshold = 0
            if subtotal >= threshold:
                discount_total += subtotal * float(r.value) / 100
        tax_total = (subtotal - discount_total) * 0.18
        total = subtotal - discount_total + tax_total
        return Response({'subtotal': subtotal, 'discount_total': discount_total, 'tax_total': tax_total, 'total': total})

    @action(detail=True, methods=['get'], url_path='export-xlsx')
    def export_xlsx(self, request, pk=None):
        return self.export_pdf(request, pk=pk)

    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request, pk=None):
        quote = self.get_object()
        try:
            export = build_document_pdf_export(quote)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = FileResponse(
            export['content'],
            as_attachment=True,
            filename=export['filename'],
            content_type=export['content_type'],
        )
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response

    @action(detail=True, methods=['get'], url_path='export-excel')
    def export_excel(self, request, pk=None):
        quote = self.get_object()
        try:
            export = build_document_export(quote, template_key=request.query_params.get('template_key'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = FileResponse(
            export['content'],
            as_attachment=True,
            filename=export['filename'],
            content_type=export['content_type'],
        )
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response

    @action(detail=True, methods=['get'], url_path='export-files')
    def export_files(self, request, pk=None):
        quote = self.get_object()
        return Response({'files': [{'filename': f'{quote.number}.pdf', 'template_key': ''}]})

    @action(detail=False, methods=['get'], url_path='template-library')
    def template_library(self, request):
        return Response(list_template_library(request.user.organization))

    @action(detail=False, methods=['get'], url_path='template-placeholders')
    def template_placeholders(self, request):
        return Response({'groups': list_template_placeholders()})

    @action(detail=False, methods=['get'], url_path='template-library-download')
    def template_library_download(self, request):
        template_key = str(request.query_params.get('template_key') or 'seller_master').strip()
        variant = str(request.query_params.get('variant') or 'current').strip().lower()
        seller_company_key = str(request.query_params.get('seller_company_key') or '').strip()
        try:
            template = get_template_download(
                request.user.organization,
                template_key,
                variant=variant,
                seller_company_key=seller_company_key,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        extension = template['path'].suffix.lower()
        content_type = EXCEL_TEMPLATE_CONTENT_TYPES.get(extension) or mimetypes.guess_type(template['filename'])[0] or 'application/octet-stream'
        response = FileResponse(
            open(template['path'], 'rb'),
            as_attachment=True,
            filename=template['filename'],
            content_type=content_type,
        )
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response

    @action(detail=False, methods=['post'], url_path='template-library-upload')
    def template_library_upload(self, request):
        template_key = str(request.data.get('template_key') or 'seller_master').strip()
        seller_company_key = str(request.data.get('seller_company_key') or '').strip()
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'file zorunludur'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            entry = save_template_override(
                request.user.organization,
                template_key,
                uploaded_file,
                user=request.user,
                seller_company_key=seller_company_key,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'template': entry})


class PricingRuleViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = PricingRuleSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'pricing.manage'
    queryset = PricingRule.objects.all()


class SellerCompanyViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'quotes.view'
    permission_map = {
        'create': 'pricing.manage',
        'partial_update': 'pricing.manage',
        'destroy': 'pricing.manage',
        'upload_logo': 'pricing.manage',
    }

    def _organization(self, request):
        return getattr(request.user, 'organization', None)

    def list(self, request):
        org = self._organization(request)
        if not org:
            return Response(get_default_seller_profiles())
        return Response(get_seller_profiles(org))

    def _find_profile(self, org, key):
        normalized_key = normalize_seller_company_key(key)
        profiles = get_seller_profiles(org)
        for index, profile in enumerate(profiles):
            if profile['key'] == normalized_key:
                return profiles, index, profile
        return profiles, None, None

    def create(self, request):
        org = self._organization(request)
        if not org:
            return Response({'detail': 'Organizasyon bulunamadı'}, status=status.HTTP_400_BAD_REQUEST)

        profiles = get_seller_profiles(org)
        payload = dict(request.data or {})
        key = normalize_seller_company_key(payload.get('key') or payload.get('short_name') or payload.get('display_name'))
        if not key:
            return Response({'detail': 'Firma kodu veya kısa adı zorunludur'}, status=status.HTTP_400_BAD_REQUEST)
        if any(profile['key'] == key for profile in profiles):
            return Response({'detail': 'Bu satıcı firma kodu zaten kullanılıyor'}, status=status.HTTP_400_BAD_REQUEST)

        normalized = _normalize_seller_profile(payload, sort_order=len(profiles))
        profiles.append(normalized)
        save_seller_profiles(org, profiles)
        return Response(normalized, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        org = self._organization(request)
        if not org:
            return Response({'detail': 'Organizasyon bulunamadı'}, status=status.HTTP_400_BAD_REQUEST)

        key = normalize_seller_company_key(pk)
        profiles = get_seller_profiles(org)
        for index, profile in enumerate(profiles):
            if profile['key'] != key:
                continue
            payload = dict(request.data or {})
            payload['key'] = key
            normalized = _normalize_seller_profile(payload, fallback=profile, sort_order=index)
            profiles[index] = normalized
            save_seller_profiles(org, profiles)
            return Response(normalized)

        return Response({'detail': 'Satıcı firma bulunamadı'}, status=status.HTTP_404_NOT_FOUND)

    def destroy(self, request, pk=None):
        org = self._organization(request)
        if not org:
            return Response({'detail': 'Organizasyon bulunamadı'}, status=status.HTTP_400_BAD_REQUEST)

        key = normalize_seller_company_key(pk)
        if Quote.objects.filter(organization=org, seller_company_key__iexact=key).exists():
            return Response({'detail': 'Bu firma mevcut belgelerde kullanıldığı için silinemez'}, status=status.HTTP_400_BAD_REQUEST)

        profiles = get_seller_profiles(org)
        remaining = [profile for profile in profiles if profile['key'] != key]
        if len(remaining) == len(profiles):
            return Response({'detail': 'Satıcı firma bulunamadı'}, status=status.HTTP_404_NOT_FOUND)
        save_seller_profiles(org, remaining)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def partial_update(self, request, pk=None):
        org = self._organization(request)
        if not org:
            return Response({'detail': 'Organizasyon bulunamadÄ±'}, status=status.HTTP_400_BAD_REQUEST)

        key = normalize_seller_company_key(pk)
        profiles, index, profile = self._find_profile(org, key)
        if profile is None or index is None:
            return Response({'detail': 'SatÄ±cÄ± firma bulunamadÄ±'}, status=status.HTTP_404_NOT_FOUND)

        payload = dict(request.data or {})
        payload['key'] = key
        normalized = _normalize_seller_profile(payload, fallback=profile, sort_order=index)
        profiles[index] = normalized
        save_seller_profiles(org, profiles)
        return Response(normalized)

    def destroy(self, request, pk=None):
        org = self._organization(request)
        if not org:
            return Response({'detail': 'Organizasyon bulunamadÄ±'}, status=status.HTTP_400_BAD_REQUEST)

        key = normalize_seller_company_key(pk)
        if Quote.objects.filter(organization=org, seller_company_key__iexact=key).exists():
            return Response({'detail': 'Bu firma mevcut belgelerde kullanÄ±ldÄ±ÄŸÄ± iÃ§in silinemez'}, status=status.HTTP_400_BAD_REQUEST)

        profiles = get_seller_profiles(org)
        remaining = [profile for profile in profiles if profile['key'] != key]
        if len(remaining) == len(profiles):
            return Response({'detail': 'SatÄ±cÄ± firma bulunamadÄ±'}, status=status.HTTP_404_NOT_FOUND)

        deleted = next((profile for profile in profiles if profile['key'] == key), None)
        if deleted and deleted.get('logo_url'):
            _delete_logo_file(deleted.get('logo_url'))
        save_seller_profiles(org, remaining)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='upload-logo', parser_classes=[MultiPartParser, FormParser])
    def upload_logo(self, request, pk=None):
        org = self._organization(request)
        if not org:
            return Response({'detail': 'Organizasyon bulunamadÄ±'}, status=status.HTTP_400_BAD_REQUEST)

        key = normalize_seller_company_key(pk)
        profiles, index, profile = self._find_profile(org, key)
        if profile is None or index is None:
            return Response({'detail': 'SatÄ±cÄ± firma bulunamadÄ±'}, status=status.HTTP_404_NOT_FOUND)

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'Logo dosyasi zorunludur.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            logo_url = _save_seller_logo_file(org, key, uploaded_file)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if profile.get('logo_url'):
            _delete_logo_file(profile.get('logo_url'))

        payload = dict(profile)
        payload['logo_url'] = logo_url
        normalized = _normalize_seller_profile(payload, fallback=profile, sort_order=index)
        profiles[index] = normalized
        save_seller_profiles(org, profiles)
        return Response(normalized)


class BusinessPartnerViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = BusinessPartnerSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'partners.view'
    permission_map = {
        'create': 'partners.edit',
        'update': 'partners.edit',
        'partial_update': 'partners.edit',
        'destroy': 'partners.edit',
    }
    queryset = BusinessPartner.objects.all()


class LeadViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'leads.disabled'
    permission_map = {
        'create': 'leads.disabled',
        'update': 'leads.disabled',
        'partial_update': 'leads.disabled',
        'destroy': 'leads.disabled',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'status', 'source']
    ordering_fields = ['created_at', 'score']
    queryset = Lead.objects.all().select_related('company')

    def initial(self, request, *args, **kwargs):
        raise PermissionDenied("Lead modülü devre dışı bırakıldı.")


class OpportunityViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = OpportunitySerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'opportunities.admin'
    permission_map = {
        'create': 'opportunities.admin',
        'update': 'opportunities.admin',
        'partial_update': 'opportunities.admin',
        'destroy': 'opportunities.admin',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'stage']
    ordering_fields = ['close_date', 'value']
    queryset = Opportunity.objects.all().select_related('lead', 'company')


class ContactViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'contacts.view'
    permission_map = {
        'create': 'contacts.edit',
        'update': 'contacts.edit',
        'partial_update': 'contacts.edit',
        'destroy': 'contacts.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone']
    ordering_fields = ['name']
    queryset = Contact.objects.all().select_related('company')
