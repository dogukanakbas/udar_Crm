from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
import mimetypes

from django.http import FileResponse

from .models import Quote, PricingRule, BusinessPartner, Lead, Opportunity, Contact
from .contracts import build_document_export, get_template_download, list_document_exports, list_template_library, save_template_override
from workflow.models import ApprovalInstance, ApprovalStep
from erp.models import Product
from .serializers import QuoteSerializer, PricingRuleSerializer, BusinessPartnerSerializer, ProductSerializer, LeadSerializer, OpportunitySerializer, ContactSerializer
from organizations.models import NumberRange
from permissions import IsOrgMember, IsOwnerOrManager, HasAPIPermission
from audit.utils import log_entity_action

EXCEL_TEMPLATE_CONTENT_TYPES = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
}


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
        'template_library_upload': 'quotes.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['number', 'customer__name', 'status', 'document_type']
    ordering_fields = ['created_at', 'total']
    queryset = Quote.objects.all().select_related('customer', 'owner', 'prepared_by').prefetch_related('lines__product__category')

    def _attach_audit_user(self, quote):
        quote._audit_user = self.request.user
        return quote

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        document_type = self.request.query_params.get('document_type')
        if document_type:
            qs = qs.filter(document_type=document_type)
        if getattr(user, 'role', '') not in ['Admin', 'Manager']:
            qs = qs.filter(owner=user)
        return qs.order_by('-created_at', '-id')

    def perform_create(self, serializer):
        org = self.request.user.organization
        document_type = serializer.validated_data.get('document_type', 'Quote')
        doc_type = 'CONTRACT' if document_type == 'Contract' else 'QUOTE'
        prefix = 'C-' if doc_type == 'CONTRACT' else 'Q-'
        number_range, _ = NumberRange.objects.get_or_create(organization=org, doc_type=doc_type, defaults={'prefix': prefix})
        number = number_range.next_number()
        serializer.save(organization=org, number=number, owner=self.request.user)

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
        return Response({'status': 'sent'})

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        quote = self._attach_audit_user(self.get_object())
        quote.status = 'Converted'
        quote.save(update_fields=['status'])
        log_entity_action(quote, 'converted', user=request.user)
        return Response({'status': 'converted'})

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
            first_discount_rate = float(l.get('discount', 0) or 0) / 100
            second_discount_rate = float(l.get('discountSecondary', l.get('discount_secondary', 0)) or 0) / 100
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
        return Response({'files': list_document_exports(quote)})

    @action(detail=False, methods=['get'], url_path='template-library')
    def template_library(self, request):
        return Response({'templates': list_template_library(request.user.organization)})

    @action(detail=False, methods=['get'], url_path='template-library-download')
    def template_library_download(self, request):
        template_key = str(request.query_params.get('template_key') or '').strip()
        variant = str(request.query_params.get('variant') or 'current').strip().lower()
        try:
            template = get_template_download(request.user.organization, template_key, variant=variant)
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
        template_key = str(request.data.get('template_key') or '').strip()
        uploaded_file = request.FILES.get('file')
        if not template_key or not uploaded_file:
            return Response({'detail': 'template_key ve file zorunludur'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            entry = save_template_override(request.user.organization, template_key, uploaded_file, user=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'template': entry})


class PricingRuleViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = PricingRuleSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'pricing.manage'
    queryset = PricingRule.objects.all()


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
    required_perm = 'leads.view'
    permission_map = {
        'create': 'leads.edit',
        'update': 'leads.edit',
        'partial_update': 'leads.edit',
        'destroy': 'leads.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'status', 'source']
    ordering_fields = ['created_at', 'score']
    queryset = Lead.objects.all().select_related('company')


class OpportunityViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = OpportunitySerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'opportunities.view'
    permission_map = {
        'create': 'opportunities.edit',
        'update': 'opportunities.edit',
        'partial_update': 'opportunities.edit',
        'destroy': 'opportunities.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'stage']
    ordering_fields = ['close_date', 'value']
    queryset = Opportunity.objects.all().select_related('lead', 'company')


class ContactViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'partners.view'
    permission_map = {
        'create': 'partners.edit',
        'update': 'partners.edit',
        'partial_update': 'partners.edit',
        'destroy': 'partners.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone']
    ordering_fields = ['name']
    queryset = Contact.objects.all().select_related('company')
