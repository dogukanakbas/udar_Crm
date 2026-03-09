from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from django_filters.rest_framework import DjangoFilterBackend

from .models import ContactSubmission
from .serializers import ContactSubmissionSerializer, ContactSubmissionAdminSerializer
from core.permissions import IsSuperAdmin


class ContactFormThrottle(AnonRateThrottle):
    """Rate limit: 5 submissions per 10 minutes"""
    rate = '5/10m'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([ContactFormThrottle])
def contact_form_submit(request):
    """
    Public contact form submission.
    Rate limited to prevent spam.
    """
    serializer = ContactSubmissionSerializer(data=request.data)
    if serializer.is_valid():
        # Save with IP and user agent
        submission = serializer.save(
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )
        return Response(
            {'message': 'Thank you! We will contact you soon.'},
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminContactViewSet(viewsets.ModelViewSet):
    """
    Admin contact submissions API - superadmin only.
    View and manage contact form submissions.
    """
    permission_classes = [IsSuperAdmin]
    queryset = ContactSubmission.objects.all()
    serializer_class = ContactSubmissionAdminSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    ordering = ['-created_at']
    
    # Only allow read and update (no delete)
    http_method_names = ['get', 'patch', 'head', 'options']
