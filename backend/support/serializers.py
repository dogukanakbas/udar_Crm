from rest_framework import serializers
from .models import Ticket, TicketMessage, Task, TaskAttachment, TaskComment, TaskChecklist, TaskTimeEntry
from .models_automation import AutomationRule


class TicketMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = ['id', 'author', 'message', 'internal', 'created_at']
        read_only_fields = ['author', 'created_at']


class TicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = ['id', 'subject', 'company_name', 'status', 'priority', 'assignee', 'sla', 'updated_at', 'created_at', 'messages']


class TaskAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskAttachment
        fields = ['id', 'task', 'file', 'uploaded_by', 'uploaded_at', 'description', 'original_name', 'content_type', 'size', 'version', 'parent', 'tags']
        read_only_fields = ['uploaded_by', 'uploaded_at', 'original_name', 'content_type', 'size', 'version', 'parent']

    def validate_file(self, value):
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('Dosya 10MB üstü olamaz')
        return value


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'text', 'type', 'created_at', 'author', 'author_name']
        read_only_fields = ['author', 'created_at', 'author_name']

    def get_author_name(self, obj):
        return obj.author.username if obj.author else None


class TaskSerializer(serializers.ModelSerializer):
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    checklist = serializers.SerializerMethodField()
    time_entries = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = '__all__'
        extra_kwargs = {
            'owner': {'required': False, 'allow_null': True},
            'assignee': {'required': False, 'allow_null': True},
            'organization': {'required': False},
            'team': {'required': False, 'allow_null': True},
            'planned_hours': {'required': False, 'allow_null': True},
            'planned_cost': {'required': False, 'allow_null': True},
        }

    def get_checklist(self, obj):
        items = obj.checklist.all().order_by('order', 'id')
        return TaskChecklistSerializer(items, many=True).data

    def get_time_entries(self, obj):
        entries = obj.time_entries.all().order_by('-created_at')[:20]
        return TaskTimeEntrySerializer(entries, many=True).data

    def validate(self, attrs):
        # Boş veya null gelen planlanan değerleri 0'a çevirerek 400 hatasını önler
        for field in ['planned_hours', 'planned_cost']:
            val = attrs.get(field)
            if val in (None, '', 'null'):
                attrs[field] = 0
        return super().validate(attrs)


class TaskChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskChecklist
        fields = ['id', 'task', 'title', 'done', 'order', 'created_at']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        # organization paramı Model'de olmadığı için sessizce kaldır
        validated_data.pop('organization', None)
        return super().create(validated_data)


class TaskTimeEntrySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskTimeEntry
        fields = ['id', 'task', 'user', 'user_name', 'started_at', 'ended_at', 'note', 'created_at']
        read_only_fields = ['user_name', 'created_at']

    def get_user_name(self, obj):
        return obj.user.username if obj.user else None


class AutomationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRule
        fields = '__all__'
        read_only_fields = ['organization', 'created_at']

