from rest_framework import serializers
from .models import ContactSubmission


class ContactSubmissionSerializer(serializers.ModelSerializer):
    """Public serializer for contact form"""
    class Meta:
        model = ContactSubmission
        fields = ['name', 'email', 'company', 'phone', 'message']


class ContactSubmissionAdminSerializer(serializers.ModelSerializer):
    """Admin serializer with all fields"""
    class Meta:
        model = ContactSubmission
        fields = '__all__'
        read_only_fields = ['ip_address', 'user_agent', 'created_at', 'updated_at']
