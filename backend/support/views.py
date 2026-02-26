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
from accounts.models import User, Team
from .models_automation import AutomationRule
from .utils import send_slack_webhook, send_email, generate_presigned_post, scan_file_with_clamav
from rest_framework import status
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
from django.utils import timezone


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


FACTORY_CHECKLIST = [
    "Depo - MDF İnişi",
    "MDF Dilimleme",
    "Yarı Otomatik Hat #1",
    "Yarı Otomatik Hat #2",
    "Tam Otomatik Hat",
    "PWC Sarma",
    "Vakum Odası",
    "Birleştirme",
    "Pres",
    "Ebatlama",
    "Kalite Kontrol / Çıkış",
]

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
        user = self.request.user
        if role == 'Worker':
            user_teams = user.teams.all()
            qs = qs.filter(
                Q(team__in=user_teams) | 
                Q(current_team__in=user_teams) |
                Q(assignee=user) |
                Q(owner=user)
            ).distinct()
        elif role not in ['Admin', 'Manager']:
            qs = qs.filter(Q(owner=user) | Q(assignee=user) | Q(team__members=user)).distinct()
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(organization=self.request.user.organization, owner=self.request.user)
        # Sabit görevler için fabrika checklist ekle
        if getattr(instance, 'mode', 'manual') == 'fixed':
            TaskChecklist.objects.bulk_create(
                [
                    TaskChecklist(task=instance, title=title, order=idx)
                    for idx, title in enumerate(FACTORY_CHECKLIST)
                ]
            )
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

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        task = self.get_object()
        if task.organization_id != request.user.organization_id:
            raise PermissionDenied("Farklı organizasyon")
        user_team = request.user.teams.first()
        task.assignee = request.user
        task.current_team = user_team or task.current_team or task.team
        task.save(update_fields=['assignee', 'current_team', 'updated_at'])
        TaskComment.objects.create(
            task=task,
            author=request.user,
            type='activity',
            text=f"{request.user.username} görevi üstlendi",
        )
        push_event(
            {
                "type": "task.claimed",
                "task_id": task.id,
                "organization": task.organization_id,
                "by": getattr(request.user, "email", None),
            }
        )
        return Response(TaskSerializer(task, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def handover(self, request, pk=None):
        task = self.get_object()
        if task.organization_id != request.user.organization_id:
            raise PermissionDenied("Farklı organizasyon")
        target_team_id = request.data.get('team')
        target_user_id = request.data.get('assignee')
        note = request.data.get('note', '')
        handover_type = request.data.get('type', 'manual')
        target_team = None
        if target_team_id:
            target_team = Team.objects.filter(id=target_team_id, organization=request.user.organization).first()
        target_user = None
        if target_user_id:
            target_user = User.objects.filter(id=target_user_id, organization=request.user.organization).first()
        
        from_team = task.current_team or task.team
        history = task.handover_history or []
        history.append(
            {
                "from_team": getattr(from_team, 'id', None),
                "from_team_name": getattr(from_team, 'name', None),
                "to_team": getattr(target_team, 'id', None),
                "to_team_name": getattr(target_team, 'name', None),
                "by": request.user.username,
                "note": note,
                "type": handover_type,
                "at": timezone.now().isoformat(),
            }
        )
        task.current_team = target_team or task.current_team or task.team
        if target_user:
            task.assignee = target_user
        task.handover_reason = note
        task.handover_at = timezone.now()
        task.handover_history = history
        task.save(update_fields=['current_team', 'assignee', 'handover_reason', 'handover_at', 'handover_history', 'updated_at'])
        TaskComment.objects.create(
            task=task,
            author=request.user,
            type='activity',
            text=f"Devir: {getattr(from_team, 'name', '—')} → {getattr(target_team, 'name', '—')} (not: {note})",
        )
        push_event(
            {
                "type": "task.handover",
                "task_id": task.id,
                "organization": task.organization_id,
                "to_team": getattr(target_team, 'id', None),
                "by": getattr(request.user, "email", None),
            }
        )
        return Response(TaskSerializer(task, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def self_handover(self, request, pk=None):
        """Worker kendi görevini başka ekibe devredebilir (bölüm değişimi için)"""
        task = self.get_object()
        if task.organization_id != request.user.organization_id:
            raise PermissionDenied("Farklı organizasyon")
        if task.assignee_id != request.user.id:
            raise PermissionDenied("Sadece size atanan görevi devredebilirsiniz")
        
        target_team_id = request.data.get('team')
        reason = request.data.get('reason', 'Bölüm değişimi - başka alanda çalışıyorum')
        
        if not target_team_id:
            raise PermissionDenied("Hedef ekip belirtilmeli")
        
        target_team = Team.objects.filter(id=target_team_id, organization=request.user.organization).first()
        if not target_team:
            raise PermissionDenied("Hedef ekip bulunamadı")
        
        from_team = task.current_team or task.team
        history = task.handover_history or []
        history.append(
            {
                "from_team": getattr(from_team, 'id', None),
                "from_team_name": getattr(from_team, 'name', None),
                "to_team": target_team.id,
                "to_team_name": target_team.name,
                "by": request.user.username,
                "note": reason,
                "type": "self-initiated",
                "at": timezone.now().isoformat(),
            }
        )
        
        task.current_team = target_team
        task.assignee = None
        task.handover_reason = reason
        task.handover_at = timezone.now()
        task.handover_history = history
        task.save(update_fields=['current_team', 'assignee', 'handover_reason', 'handover_at', 'handover_history', 'updated_at'])
        
        TaskComment.objects.create(
            task=task,
            author=request.user,
            type='activity',
            text=f"🔄 {request.user.username} görevi {target_team.name} ekibine devretti (Sebep: {reason})",
        )
        
        push_event(
            {
                "type": "task.self_handover",
                "task_id": task.id,
                "organization": task.organization_id,
                "from_team": getattr(from_team, 'id', None),
                "to_team": target_team.id,
                "by": getattr(request.user, "email", None),
                "reason": reason,
            }
        )
        
        return Response(TaskSerializer(task, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='worker-tracking')
    def worker_tracking(self, request):
        """
        Admin/Manager için worker tracking endpoint'i.
        Her worker'ın hangi departmanda çalıştığını gösterir.
        """
        # Sadece Admin ve Manager erişebilir
        if request.user.role not in ['Admin', 'Manager']:
            raise PermissionDenied("Bu endpoint'e sadece Admin ve Manager erişebilir")
        
        org = request.user.organization
        
        # Tüm worker'ları al
        workers = User.objects.filter(organization=org, role='Worker')
        
        tracking_data = []
        for worker in workers:
            # Worker'ın aktif görevlerini al
            active_tasks = Task.objects.filter(
                organization=org,
                assignee=worker,
                status__in=['todo', 'in-progress']
            ).select_related('team', 'current_team').order_by('-updated_at')
            
            # Worker'ın son self-handover'ını bul
            last_handover = None
            for task in active_tasks:
                if task.handover_history:
                    for h in reversed(task.handover_history):
                        if h.get('type') == 'self-initiated' and h.get('by') == worker.username:
                            last_handover = h
                            break
                    if last_handover:
                        break
            
            # Worker'ın ana ekibi
            primary_teams = list(worker.teams.values_list('name', flat=True))
            
            # Worker'ın şu an çalıştığı departman
            current_department = None
            if active_tasks.exists():
                task = active_tasks.first()
                current_department = task.current_team.name if task.current_team else (task.team.name if task.team else None)
            
            tracking_data.append({
                'worker_id': worker.id,
                'worker_name': worker.username,
                'worker_email': worker.email,
                'primary_teams': primary_teams,
                'current_department': current_department,
                'active_tasks_count': active_tasks.count(),
                'last_handover': last_handover,
                'last_activity': active_tasks.first().updated_at if active_tasks.exists() else None,
            })
        
        return Response({
            'workers': tracking_data,
            'total_workers': len(tracking_data),
            'timestamp': timezone.now().isoformat(),
        })

    def perform_destroy(self, instance):
        log_entity_action(instance, 'deleted', user=self.request.user)
        instance.delete()

    def run_automations(self, task, trigger, extra=None):
        if getattr(task, '_automation_in_progress', False):
            return
        task._automation_in_progress = True
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
                continue
            try:
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
                elif rule.action == 'multi_notify':
                    payload = rule.action_payload if isinstance(rule.action_payload, dict) else {}
                    msg = payload.get('message') or f"Task {task.title}: durum {extra.get('from')} -> {extra.get('to')}"
                    emails = payload.get('emails') or []
                    hooks = payload.get('webhooks') or []
                    TaskComment.objects.create(task=task, author=None, type='activity', text='(Multi notify) Otomasyon tetiklendi')
                    for h in hooks:
                        send_slack_webhook(msg, webhook_url=h)
                    for em in emails:
                        send_email(em, f"Görev bildirimi: {task.title}", msg)
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
            except Exception as e:
                TaskComment.objects.create(task=task, author=None, type='activity', text=f"Otomasyon hata: {e}")
        task._automation_in_progress = False


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
        file_name = request.data.get('file_name') or request.data.get('filename') or 'upload.bin'
        content_type = request.data.get('content_type', 'application/octet-stream')
        size = int(request.data.get('size') or 0)
        strategy = request.data.get('strategy', 'direct')

        allowed = {'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'}
        max_size_mb = int(os.getenv('PRESIGN_MAX_SIZE_MB', 50 if strategy == 'chunk' else 10))

        if content_type not in allowed:
            return Response({"detail": "Yalnızca PNG/JPG/WEBP/PDF kabul edilir"}, status=status.HTTP_400_BAD_REQUEST)
        if size and size > max_size_mb * 1024 * 1024:
            return Response({"detail": f"Dosya {max_size_mb}MB üstü olamaz"}, status=status.HTTP_400_BAD_REQUEST)

        provider = os.getenv('PRESIGN_PROVIDER', 'direct').lower()
        bucket = os.getenv('PRESIGN_BUCKET') or os.getenv('AWS_STORAGE_BUCKET_NAME')
        endpoint = os.getenv('PRESIGN_ENDPOINT') or os.getenv('MINIO_ENDPOINT')
        access_key = os.getenv('PRESIGN_ACCESS_KEY') or os.getenv('MINIO_ACCESS_KEY') or os.getenv('AWS_ACCESS_KEY_ID')
        secret_key = os.getenv('PRESIGN_SECRET_KEY') or os.getenv('MINIO_SECRET_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
        region = os.getenv('PRESIGN_REGION') or os.getenv('AWS_REGION') or 'us-east-1'
        prefix = os.getenv('PRESIGN_PREFIX', 'uploads').strip('/')

        if provider in ['s3', 'minio'] and bucket and access_key and secret_key and endpoint:
            key = f"{prefix}/tasks/{uuid.uuid4().hex}/{file_name}" if prefix else f"tasks/{uuid.uuid4().hex}/{file_name}"
            try:
                presigned = generate_presigned_post(
                    endpoint=endpoint.replace('https://', '').replace('http://', ''),
                    bucket=bucket,
                    key=key,
                    access_key=access_key,
                    secret_key=secret_key,
                    secure=endpoint.startswith('https://'),
                    region=region,
                    content_type=content_type,
                    max_size=max_size_mb * 1024 * 1024,
                )
                resp = {
                    "upload_url": presigned['url'],
                    "fields": presigned['fields'],
                    "max_size_mb": max_size_mb,
                    "content_type": content_type,
                    "filename": file_name,
                    "strategy": provider,
                    "part_size": max_size_mb * 1024 * 1024,
                    "key": key,
                }
                return Response(resp)
            except Exception as e:
                return Response({"detail": f"Presign başarısız: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Fallback: backend'e direkt yükleme (isteğe bağlı ClamAV taraması için flag)
        resp = {
            'upload_url': request.build_absolute_uri('/api/task-attachments/'),
            'fields': {},
            'max_size_mb': max_size_mb,
            'content_type': content_type,
            'filename': file_name,
            'strategy': 'direct',
            'part_size': 5 * 1024 * 1024,  # 5MB öneri
            'clamav': os.getenv('CLAMAV_ENABLED', 'false').lower() == 'true',
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

