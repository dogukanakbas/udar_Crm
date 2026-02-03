from rest_framework import viewsets, permissions, filters
from core.events import push_event
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from permissions import IsOrgMember, HasAPIPermission
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
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
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
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
    required_perm = 'tickets.view'
    queryset = TicketMessage.objects.all()

    def perform_create(self, serializer):
        comment = serializer.save(author=self.request.user)
        # Mention notification: @username
        mentions = set()
        import re
        for m in re.findall(r'@([\w\.-]+)', comment.text or ''):
            mentions.add(m)
        if mentions:
            users = User.objects.filter(username__in=list(mentions))
            msg = f"Görev yorumu: {comment.text}"
            for u in users:
                # Slack/email; Slack webhook global; email user if exists
                if u.email:
                    send_email(u.email, f"Görev yorumu: {comment.task.title}", msg)
            TaskComment.objects.create(task=comment.task, author=None, type='activity', text=f"Mention gönderildi: {', '.join(mentions)}")


class TaskViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
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


class TaskAttachmentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
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
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
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
        serializer.save(author=self.request.user)
        push_event(
            {
                "type": "task.comment",
                "task_id": serializer.instance.task_id,
                "organization": serializer.instance.task.organization_id,
                "by": getattr(self.request.user, "email", None),
            }
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


class UploadPresignView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsOrgMember]

    def post(self, request, *args, **kwargs):
        filename = request.data.get('filename', 'upload.bin')
        content_type = request.data.get('content_type', 'application/octet-stream')
        size = int(request.data.get('size') or 0)
        strategy = request.data.get('strategy', 'direct')
        max_size_mb = 50 if strategy == 'chunk' else 10
        if size and size > max_size_mb * 1024 * 1024:
            return Response({"detail": f"Dosya {max_size_mb}MB üstü olamaz"}, status=400)
        # Basit stub: chunk stratejisinde de doğrudan API yükleme noktasını kullanıyoruz,
        # frontend part_size bilgisiyle bölüp sırayla POST edebilir.
        resp = {
            'upload_url': request.build_absolute_uri('/api/task-attachments/'),
            'fields': {},
            'max_size_mb': max_size_mb,
            'content_type': content_type,
            'filename': filename,
            'strategy': strategy,
            'part_size': 5 * 1024 * 1024,  # 5MB parça önerisi
        }
        return Response(resp)

class TaskChecklistViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    serializer_class = TaskChecklistSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
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

