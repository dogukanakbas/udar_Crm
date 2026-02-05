from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from core.events import push_event
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
import re
import os
import uuid
from permissions import IsOrgMember, HasAPIPermission, CommentOnlyRestriction, ViewOnlyRestriction
from audit.utils import log_entity_action
from .models import Ticket, TicketMessage, Task, TaskAttachment, TaskComment, TaskChecklist, TaskTimeEntry
from accounts.models import User
from .models_automation import AutomationRule
from .utils import send_slack_webhook, send_email
from .serializers import (
    TicketSerializer,
    TicketMessageSerializer,
    TaskSerializer,
    TaskAttachmentSerializer,
    TaskCommentSerializer,
    TaskChecklistSerializer,
    AutomationRuleSerializer,
    TaskTimeEntrySerializer,
)
from rest_framework.views import APIView
from rest_framework.response import Response


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


class TicketViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, ViewOnlyRestriction, CommentOnlyRestriction, HasAPIPermission]
    required_perm = 'tickets.view'
    permission_map = {
        'create': 'tickets.edit',
        'update': 'tickets.edit',
        'partial_update': 'tickets.edit',
        'destroy': 'tickets.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['subject', 'company_name', 'status']
    ordering_fields = ['updated_at', 'priority']
    queryset = Ticket.objects.all()

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, assignee=self.request.user)


class TicketMessageViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TicketMessageSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, ViewOnlyRestriction, CommentOnlyRestriction, HasAPIPermission]
    required_perm = 'tickets.view'
    queryset = TicketMessage.objects.all()

    def perform_create(self, serializer):
        message = serializer.save(author=self.request.user)
        # Mention notification: @username in ticket message
        mentions = set(re.findall(r'@([\w\.-]+)', message.message or ''))
        if mentions:
            users = User.objects.filter(username__in=list(mentions), organization=message.ticket.organization)
            if users:
                TaskComment.objects.create(
                    task=None,
                    author=None,
                    type='activity',
                    text=f"Mention (ticket): {', '.join([u.username for u in users])}",
                )
            for u in users:
                push_event(
                    {
                        "type": "notification.mention",
                        "ticket_id": message.ticket_id,
                        "ticket_subject": message.ticket.subject,
                        "message_id": message.id,
                        "mentioned": u.username,
                        "organization": message.ticket.organization_id,
                    }
                )
                if u.email:
                    send_email(
                        u.email,
                        f"Ticket mention: {message.ticket.subject}",
                        f"{self.request.user.username} sizi bir ticket mesajında bahsetti: {message.message}",
                    )


class TaskViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, ViewOnlyRestriction, CommentOnlyRestriction, HasAPIPermission]
    required_perm = 'tasks.view'
    permission_map = {
        'create': 'tasks.edit',
        'update': 'tasks.edit',
        'partial_update': 'tasks.edit',
        'destroy': 'tasks.edit',
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'status', 'priority']
    ordering_fields = ['due', 'priority', 'updated_at']
    def get_queryset(self):
        qs = Task.objects.all()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(organization=org)
        role = getattr(self.request.user, 'role', '')
        if role not in ['Admin', 'Manager']:
            user = self.request.user
            qs = qs.filter(Q(owner=user) | Q(assignee=user) | Q(team__members=user)).distinct()
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(organization=self.request.user.organization, owner=self.request.user)
        log_entity_action(instance, 'created', user=self.request.user)
        push_event(
            {
                "type": "task.created",
                "task_id": instance.id,
                "organization": instance.organization_id,
                "title": instance.title,
                "assignee": getattr(instance.assignee, "email", None),
            }
        )
        # Assignee bildirimi ve aktivite kaydı
        if instance.assignee:
            TaskComment.objects.create(
                task=instance,
                author=self.request.user,
                type='activity',
                text=f"Görev {instance.assignee.username} kullanıcısına atandı",
            )
            if instance.assignee.email:
                send_email(
                    instance.assignee.email,
                    f"Görev ataması: {instance.title}",
                    f"Size yeni bir görev atandı: {instance.title}",
                )
        # Automation: if due is soon (handled by scheduled tasks); status change not relevant on create

    def perform_update(self, serializer):
        original = Task.objects.get(pk=serializer.instance.pk)
        user_role = getattr(self.request.user, 'role', '')
        # Sadece sahip/atanan/ekip değişimini kısıtla; diğer alanlar (durum, öncelik, tarihler) Worker için serbest
        restricted_fields = ['owner', 'assignee', 'team']
        if user_role not in ['Admin', 'Manager']:
            # Kısıtlı alanları reddetmek yerine sessizce yok say
            for f in restricted_fields:
                serializer.validated_data.pop(f, None)
        instance = serializer.save()
        # Assignee değiştiyse bildirim ve aktivite
        if 'assignee' in serializer.validated_data and instance.assignee != original.assignee:
            if instance.assignee:
                TaskComment.objects.create(
                    task=instance,
                    author=self.request.user,
                    type='activity',
                    text=f"Görev {instance.assignee.username} kullanıcısına yeniden atandı",
                )
                if instance.assignee.email:
                    send_email(
                        instance.assignee.email,
                        f"Görev ataması: {instance.title}",
                        f"Görev size yeniden atandı: {instance.title}",
                    )
        # activity log on status change
        if 'status' in serializer.validated_data:
            TaskComment.objects.create(
                task=instance,
                author=self.request.user,
                type='activity',
                text=f"Durum: {original.status} -> {serializer.validated_data.get('status')}",
            )
            # Automation: task_status_changed
            self.run_automations(instance, 'task_status_changed', extra={'from': original.status, 'to': serializer.validated_data.get('status')})
            push_event(
                {
                    "type": "task.status",
                    "task_id": instance.id,
                    "organization": instance.organization_id,
                    "status": serializer.validated_data.get('status'),
                    "by": getattr(self.request.user, "email", None),
                }
            )

        # activity log on assignee / due / priority changes
        changes = []
        if 'assignee' in serializer.validated_data and instance.assignee_id != original.assignee_id:
            changes.append(f"Atanan: {getattr(original.assignee, 'email', '—')} -> {getattr(instance.assignee, 'email', '—')}")
        if 'due' in serializer.validated_data and instance.due != original.due:
            changes.append(f"Vade: {original.due} -> {instance.due}")
        if 'priority' in serializer.validated_data and instance.priority != original.priority:
            changes.append(f"Öncelik: {original.priority} -> {instance.priority}")
        if 'tags' in serializer.validated_data and instance.tags != original.tags:
            changes.append(f"Etiketler: {original.tags or []} -> {instance.tags or []}")
        if 'status' in serializer.validated_data and original.status != serializer.validated_data.get('status'):
            changes.append(f"Durum: {original.status} -> {serializer.validated_data.get('status')}")
        for change in changes:
            TaskComment.objects.create(task=instance, author=self.request.user, type='activity', text=change)
        log_entity_action(instance, 'updated', user=self.request.user)
        push_event(
            {
                "type": "task.updated",
                "task_id": instance.id,
                "organization": instance.organization_id,
                "by": getattr(self.request.user, "email", None),
                "changes": changes,
            }
        )

    def perform_destroy(self, instance):
        log_entity_action(instance, 'deleted', user=self.request.user)
        instance.delete()

    def run_automations(self, task, trigger, extra=None):
        org = getattr(self.request.user, 'organization', None)
        rules = AutomationRule.objects.filter(organization=org, is_active=True, trigger=trigger)
        for rule in rules:
            cond = rule.condition or {}
            if trigger == 'task_status_changed':
                if cond.get('from') and extra and extra.get('from') != cond.get('from'):
                    continue
                if cond.get('to') and extra and extra.get('to') != cond.get('to'):
                    continue
            if trigger == 'task_due_soon':
                # handled via scheduled view (not here)
                continue
            if rule.action == 'add_comment':
                text = rule.action_payload.get('comment') if isinstance(rule.action_payload, dict) else None
                TaskComment.objects.create(task=task, author=None, type='activity', text=text or 'Otomasyon')
            elif rule.action == 'set_assignee':
                assignee_id = rule.action_payload.get('assignee') if isinstance(rule.action_payload, dict) else None
                if assignee_id:
                    task.assignee_id = assignee_id
                    task.save(update_fields=['assignee'])
            elif rule.action == 'add_tag':
                payload = rule.action_payload if isinstance(rule.action_payload, dict) else {}
                tag = payload.get('tag')
                if tag:
                    current = task.tags or []
                    if tag not in current:
                        task.tags = current + [tag]
                        task.save(update_fields=['tags'])
                        TaskComment.objects.create(task=task, author=None, type='activity', text=f"Etiket eklendi: {tag}")
            elif rule.action == 'set_field':
                payload = rule.action_payload if isinstance(rule.action_payload, dict) else {}
                field = payload.get('field')
                value = payload.get('value')
                allowed = ['priority', 'status']
                if field in allowed and value:
                    setattr(task, field, value)
                    task.save(update_fields=[field])
                    TaskComment.objects.create(task=task, author=None, type='activity', text=f"{field} -> {value}")
            elif rule.action == 'notify':
                payload = rule.action_payload if isinstance(rule.action_payload, dict) else {}
                msg = payload.get('message') or f"Task {task.title}: durum {extra.get('from')} -> {extra.get('to')}"
                webhook = payload.get('webhook')
                email_to = payload.get('email') or (task.assignee.email if task.assignee else None)
                TaskComment.objects.create(task=task, author=None, type='activity', text='(Notify) Otomasyon tetiklendi')
                send_slack_webhook(msg, webhook_url=webhook)
                if email_to:
                    send_email(email_to, f"Görev bildirimi: {task.title}", msg)
                push_event(
                    {
                        "type": "notification.automation",
                        "task_id": task.id,
                        "task_title": task.title,
                        "message": msg,
                        "organization": task.organization_id,
                        "rule_id": rule.id,
                    }
                )
            elif rule.action == 'notify':
                payload = rule.action_payload if isinstance(rule.action_payload, dict) else {}
                msg = payload.get('message') or f"Task {task.title}: durum {extra.get('from')} -> {extra.get('to')}"
                webhook = payload.get('webhook')
                email_to = payload.get('email') or (task.assignee.email if task.assignee else None)
                TaskComment.objects.create(task=task, author=None, type='activity', text='(Notify) Otomasyon tetiklendi')
                send_slack_webhook(msg, webhook_url=webhook)
                if email_to:
                    send_email(email_to, f"Görev bildirimi: {task.title}", msg)
                push_event(
                    {
                        "type": "notification.automation",
                        "task_id": task.id,
                        "task_title": task.title,
                        "message": msg,
                        "organization": task.organization_id,
                        "rule_id": rule.id,
                    }
                )


class TaskAttachmentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, ViewOnlyRestriction, CommentOnlyRestriction, HasAPIPermission]
    required_perm = 'tasks.view'
    permission_map = {
        'create': 'tasks.edit',
        'destroy': 'tasks.edit',
        'update': 'tasks.edit',
        'partial_update': 'tasks.edit',
    }
    queryset = TaskAttachment.objects.select_related('task')

    def perform_update(self, serializer):
        # only description/metadata allowed
        serializer.save()

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(task__organization=org)
        return qs

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get('file')
        # versioning: if same original name exists for this task, increment
        latest = (
            TaskAttachment.objects.filter(task=serializer.validated_data['task'], original_name=getattr(file_obj, 'name', ''))
            .order_by('-version')
            .first()
        )
        next_version = (latest.version + 1) if latest else 1
        serializer.save(
            uploaded_by=self.request.user,
            original_name=getattr(file_obj, 'name', ''),
            content_type=getattr(file_obj, 'content_type', ''),
            size=getattr(file_obj, 'size', 0),
            version=next_version,
            parent=latest if latest else None,
        )
        push_event(
            {
                "type": "task.attachment",
                "task_id": serializer.validated_data['task'].id,
                "organization": serializer.validated_data['task'].organization_id,
                "by": getattr(self.request.user, "email", None),
                "name": getattr(file_obj, 'name', ''),
            }
        )

    def perform_destroy(self, instance):
        user = self.request.user
        # Fine RBAC: owner/assignee or admin/manager can delete
        if user.role not in ['Admin', 'Manager']:
            if not (instance.task.owner_id == user.id or instance.task.assignee_id == user.id):
                raise PermissionDenied("Bu eki silme yetkiniz yok")
        instance.delete()
        push_event(
            {
                "type": "task.attachment.deleted",
                "task_id": instance.task_id,
                "organization": instance.task.organization_id,
                "by": getattr(self.request.user, "email", None),
                "attachment_id": instance.id,
            }
        )


class TaskCommentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, ViewOnlyRestriction, CommentOnlyRestriction, HasAPIPermission]
    required_perm = 'tasks.view'
    permission_map = {
        'create': 'tasks.edit',
        'destroy': 'tasks.edit',
        'update': 'tasks.edit',
        'partial_update': 'tasks.edit',
    }
    queryset = TaskComment.objects.select_related('task', 'author')

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(task__organization=org)
        return qs

    def perform_create(self, serializer):
        comment = serializer.save(author=self.request.user)
        # SSE event for new comment
        push_event(
            {
                "type": "task.comment",
                "task_id": comment.task_id,
                "organization": comment.task.organization_id,
                "by": getattr(self.request.user, "email", None),
            }
        )
        # Mention tespiti (@username) + bildirim/eposta
        mentions = set(re.findall(r'@([\\w\\.-]+)', comment.text or ''))
        if mentions:
            users = User.objects.filter(username__in=list(mentions), organization=comment.task.organization)
            if users:
                TaskComment.objects.create(
                    task=comment.task,
                    author=None,
                    type='activity',
                    text=f"Mention: {', '.join([u.username for u in users])}",
                )
            for u in users:
                push_event(
                    {
                        "type": "notification.mention",
                        "task_id": comment.task_id,
                        "task_title": comment.task.title,
                        "comment_id": comment.id,
                        "mentioned": u.username,
                        "organization": comment.task.organization_id,
                    }
                )
                if u.email:
                    send_email(
                        u.email,
                        f"Mention: {comment.task.title}",
                        f"{self.request.user.username} sizi bir yorumda bahsetti: {comment.text}",
                    )

    def perform_destroy(self, instance):
        user = self.request.user
        # Only Admin/Manager or task owner/assignee can delete comments
        if user.role not in ['Admin', 'Manager']:
            if not (instance.task.owner_id == user.id or instance.task.assignee_id == user.id):
                raise permissions.PermissionDenied("Bu yorumu silme yetkiniz yok")
        instance.delete()


class TaskTimeEntryViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'tasks.view'
    permission_map = {
        'create': 'tasks.edit',
        'destroy': 'tasks.edit',
        'update': 'tasks.edit',
        'partial_update': 'tasks.edit',
    }
    queryset = TaskTimeEntry.objects.select_related('task', 'user')

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
            qs = qs.filter(task__organization=org)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AutomationRuleViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = AutomationRuleSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'tasks.edit'
    queryset = AutomationRule.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request.user, 'organization', None)
        if org:
          qs = qs.filter(organization=org)
        return qs

    def perform_create(self, serializer):
        org = getattr(self.request.user, 'organization', None)
        serializer.save(organization=org)

    @action(detail=False, methods=['get'])
    def help(self, request):
        data = {
            "triggers": [
                {"code": "task_status_changed", "payload": {"from": "todo", "to": "done"}},
                {"code": "task_due_soon", "payload": {"hours": 24}},
                {"code": "task_created", "payload": {}},
            ],
            "actions": [
                {"code": "add_comment", "payload": {"comment": "Metin"}},
                {"code": "set_assignee", "payload": {"assignee": 1}},
                {"code": "add_tag", "payload": {"tag": "SLA"}},
                {"code": "set_field", "payload": {"field": "priority", "value": "high"}},
                {"code": "notify", "payload": {"message": "metin", "email": "a@b.com", "webhook": "https://..."}},
                {"code": "multi_notify", "payload": {"message": "metin", "emails": ["a@b.com"], "webhooks": ["https://..."]}},
            ],
        }
        return Response(data)

    @action(detail=False, methods=['post'])
    def test(self, request):
        """
        Dry-run automation: evaluates condition and returns would-be actions without side effects.
        Body: {trigger, condition, action, action_payload, sample_task: {...}, extra: {...}}
        """
        trigger = request.data.get('trigger')
        condition = request.data.get('condition') or {}
        action = request.data.get('action')
        payload = request.data.get('action_payload') or {}
        task_data = request.data.get('sample_task') or {}
        extra = request.data.get('extra') or {}
        # simple condition check
        def cond_ok():
            if trigger == 'task_status_changed':
                if condition.get('from') and extra.get('from') != condition.get('from'):
                    return False
                if condition.get('to') and extra.get('to') != condition.get('to'):
                    return False
            if trigger == 'task_due_soon':
                hours = condition.get('hours', 24)
                due = task_data.get('due') or task_data.get('end')
                if not due:
                    return False
                diff = (timezone.datetime.fromisoformat(due).timestamp() - timezone.now().timestamp()) / 3600
                if diff > hours:
                    return False
            return True

        if not cond_ok():
            return Response({"would_run": False, "reason": "Condition mismatch"}, status=200)

        simulated = {}
        if action == 'add_comment':
            simulated['comment'] = payload.get('comment') or 'Otomasyon yorumu'
        if action == 'set_assignee':
            simulated['assignee'] = payload.get('assignee')
        if action == 'add_tag':
            simulated['tag'] = payload.get('tag')
        if action == 'set_field':
            simulated['field'] = payload.get('field')
            simulated['value'] = payload.get('value')
        if action == 'notify':
            simulated['message'] = payload.get('message')
            simulated['email'] = payload.get('email')
            simulated['webhook'] = payload.get('webhook')
        if action == 'multi_notify':
            simulated['message'] = payload.get('message')
            simulated['emails'] = payload.get('emails')
            simulated['webhooks'] = payload.get('webhooks')
        return Response({"would_run": True, "action": action, "simulated": simulated}, status=200)


class UploadPresignView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def post(self, request, *args, **kwargs):
        filename = request.data.get('filename', 'upload.bin')
        content_type = request.data.get('content_type', 'application/octet-stream')
        size = int(request.data.get('size') or 0)
        strategy = request.data.get('strategy', 'direct')
        allowed = {'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'}
        max_size_mb = 50 if strategy == 'chunk' else 10
        if content_type not in allowed:
            return Response({"detail": "Yalnızca PNG/JPG/WEBP/PDF kabul edilir"}, status=400)
        if size and size > max_size_mb * 1024 * 1024:
            return Response({"detail": f"Dosya {max_size_mb}MB üstü olamaz"}, status=400)
        provider = os.getenv('PRESIGN_PROVIDER', 'direct')
        bucket = os.getenv('PRESIGN_BUCKET') or os.getenv('AWS_STORAGE_BUCKET_NAME')
        endpoint = os.getenv('PRESIGN_ENDPOINT') or os.getenv('MINIO_ENDPOINT')
        access_key = os.getenv('PRESIGN_ACCESS_KEY') or os.getenv('MINIO_ACCESS_KEY') or os.getenv('AWS_ACCESS_KEY_ID')
        secret_key = os.getenv('PRESIGN_SECRET_KEY') or os.getenv('MINIO_SECRET_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
        region = os.getenv('PRESIGN_REGION') or os.getenv('AWS_REGION') or None
        prefix = os.getenv('PRESIGN_PREFIX', 'uploads')

        if provider in ['s3', 'minio'] and bucket and access_key and secret_key and endpoint:
            try:
                import boto3

                key = f"{prefix}/tasks/{uuid.uuid4().hex}/{filename}"
                client = boto3.client(
                    's3',
                    endpoint_url=endpoint,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region,
                )
                conditions = [["content-length-range", 0, max_size_mb * 1024 * 1024]]
                fields = {"Content-Type": content_type}
                presigned = client.generate_presigned_post(
                    Bucket=bucket, Key=key, Fields=fields, Conditions=conditions, ExpiresIn=3600
                )
                resp = {
                    "upload_url": presigned['url'],
                    "fields": presigned['fields'],
                    "max_size_mb": max_size_mb,
                    "content_type": content_type,
                    "filename": filename,
                    "strategy": "s3",
                    "part_size": max_size_mb * 1024 * 1024,
                    "key": key,
                }
                return Response(resp)
            except Exception:
                # fallback direct
                pass

        # Fallback: backend'e direkt yükleme
        resp = {
            'upload_url': request.build_absolute_uri('/api/task-attachments/'),
            'fields': {},
            'max_size_mb': max_size_mb,
            'content_type': content_type,
            'filename': filename,
            'strategy': 'direct',
            'part_size': 5 * 1024 * 1024,  # 5MB öneri
        }
        return Response(resp)

class TaskChecklistViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskChecklistSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, ViewOnlyRestriction, HasAPIPermission]
    required_perm = 'tasks.view'
    permission_map = {
        'create': 'tasks.edit',
        'destroy': 'tasks.edit',
        'update': 'tasks.edit',
        'partial_update': 'tasks.edit',
    }
    queryset = TaskChecklist.objects.select_related('task')

    def get_queryset(self):
        # OrgScopedMixin filter(organization=org) yapılamıyor; doğrudan task üzerinden filtrele
        org = getattr(self.request.user, 'organization', None)
        qs = TaskChecklist.objects.select_related('task')
        if org:
            qs = qs.filter(task__organization=org)
        return qs

