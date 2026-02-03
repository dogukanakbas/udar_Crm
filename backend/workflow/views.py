from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from permissions import HasAPIPermission
from rest_framework import viewsets, permissions, filters

from .models import ApprovalStep
from .models import ApprovalInstance
from .serializers import ApprovalInstanceSerializer


class PendingApprovalsView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermission]
    required_perm = 'approvals.view'

    def get(self, request):
        role = getattr(request.user, 'role', None)
        org = request.user.organization
        steps = ApprovalStep.objects.filter(instance__organization=org, role=role, status='Waiting').select_related('instance', 'instance__quote')
        data = [
            {
                "id": step.id,
                "quote_id": step.instance.quote.id,
                "quote_number": step.instance.quote.number,
                "quote_status": step.instance.quote.status,
                "role": step.role,
                "status": step.status,
                "comment": step.comment,
            }
            for step in steps
        ]
        return Response(data)


class ApprovalActionView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermission]
    required_perm = 'approvals.view'

    def post(self, request, pk):
        action = request.data.get('action')
        comment = request.data.get('comment', '')
        try:
            step = ApprovalStep.objects.select_related('instance', 'instance__quote').get(pk=pk, instance__organization=request.user.organization)
        except ApprovalStep.DoesNotExist:
            return Response({'error': 'Step not found'}, status=404)
        quote = step.instance.quote
        if action == 'approve':
            step.status = 'Approved'
            step.acted_by = request.user
            step.save(update_fields=['status', 'acted_by', 'updated_at'])
            # advance if Finance
            if step.role == 'Finance':
                quote.status = 'Approved'
            else:
                quote.status = 'Under Review'
            quote.save(update_fields=['status'])
        elif action == 'reject':
            step.status = 'Rejected'
            step.comment = comment
            step.acted_by = request.user
            step.save(update_fields=['status', 'comment', 'acted_by', 'updated_at'])
            quote.status = 'Rejected'
            quote.save(update_fields=['status'])
        elif action == 'resubmit':
            for s in step.instance.steps.all():
                s.status = 'Waiting'
                s.comment = ''
                s.acted_by = None
                s.save(update_fields=['status', 'comment', 'acted_by', 'updated_at'])
            step.instance.status = 'Waiting'
            step.instance.save(update_fields=['status'])
            quote.status = 'Under Review'
            quote.save(update_fields=['status'])
        else:
            return Response({'error': 'Invalid action'}, status=400)
        return Response({'status': step.status})


class ApprovalInstanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ApprovalInstanceSerializer
    permission_classes = [permissions.IsAuthenticated, HasAPIPermission]
    required_perm = 'approvals.view'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['quote__number', 'status']
    ordering_fields = ['created_at']
    queryset = ApprovalInstance.objects.select_related('quote').prefetch_related('steps')

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        quote_id = self.request.query_params.get('quote_id')
        if quote_id:
            qs = qs.filter(quote_id=quote_id)
        return qs.order_by('-created_at')
from django.shortcuts import render

# Create your views here.
