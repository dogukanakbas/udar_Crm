from rest_framework import serializers
from .models import AuditLog, AccessLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'entity', 'entity_id', 'action', 'field', 'old_value', 'new_value', 'user', 'created_at']


class AccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessLog
        fields = ['id', 'path', 'method', 'ip', 'meta', 'user', 'created_at']

