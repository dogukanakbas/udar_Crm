from rest_framework import serializers
from .models import AuditLog, AccessLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ['id', 'entity', 'entity_id', 'action', 'field', 'old_value', 'new_value', 'user', 'user_name', 'created_at']

    def get_user_name(self, obj):
        if not obj.user:
            return ''
        full_name = f"{(obj.user.first_name or '').strip()} {(obj.user.last_name or '').strip()}".strip()
        return full_name or obj.user.username


class AccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessLog
        fields = ['id', 'path', 'method', 'ip', 'meta', 'user', 'created_at']

