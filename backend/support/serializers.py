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
        fields = ['id', 'task', 'file', 'file_name', 'uploaded_by', 'uploaded_at', 'description', 'original_name', 'content_type', 'size', 'version', 'parent', 'tags']
        read_only_fields = ['uploaded_by', 'uploaded_at', 'original_name', 'content_type', 'size', 'version', 'parent']

    file_name = serializers.SerializerMethodField()

    def get_file_name(self, obj):
        return obj.original_name or (obj.file.name.split('/')[-1] if obj.file else '')

    def validate_file(self, value):
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('Dosya 10MB üstü olamaz')
        allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
        if value.content_type not in allowed:
            raise serializers.ValidationError('Yalnızca PNG/JPG/WEBP/PDF kabul edilir')
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
        # Tarih aralığı doğrulaması
        start = attrs.get('start')
        end = attrs.get('end')
        due = attrs.get('due')
        if start and end and end < start:
            raise serializers.ValidationError({'end': 'Bitiş tarihi başlangıçtan önce olamaz'})
        if start and due and due < start:
            raise serializers.ValidationError({'due': 'Vade tarihi başlangıçtan önce olamaz'})
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

    def validate(self, attrs):
        action = attrs.get('action')
        payload = attrs.get('action_payload') or {}
        if action == 'notify':
            if not (payload.get('message') or payload.get('email') or payload.get('webhook')):
                raise serializers.ValidationError("Notify aksiyonu için en az mesaj veya email/webhook gerekli")
        if action == 'multi_notify':
            emails = payload.get('emails') or []
            hooks = payload.get('webhooks') or []
            message = payload.get('message')
            if not message or (not emails and not hooks):
                raise serializers.ValidationError("multi_notify için message ve en az bir email/webhook gerekli")
        if action == 'set_field':
            field = payload.get('field')
            if field not in ['priority', 'status']:
                raise serializers.ValidationError("set_field yalnızca priority/status için kullanılabilir")
        if action == 'add_tag':
            if not payload.get('tag'):
                raise serializers.ValidationError("add_tag için tag zorunlu")
        if action == 'set_assignee':
            if not payload.get('assignee'):
                raise serializers.ValidationError("set_assignee için assignee zorunlu")
        return super().validate(attrs)

