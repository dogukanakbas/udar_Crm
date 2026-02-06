from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from core.events import push_event
from .models import Task, TaskComment
from .models_automation import AutomationRule


@shared_task
def run_due_soon_automations():
  now = timezone.now()
  soon = now + timedelta(hours=24)
  rules = AutomationRule.objects.filter(trigger='task_due_soon', is_active=True)
  for rule in rules:
    cond = rule.condition or {}
    hours = cond.get('hours', 24)
    window = now + timedelta(hours=hours)
    tasks = Task.objects.filter(
      organization=rule.organization,
      status__in=['todo', 'in-progress'],
      due__lte=window,
      due__gte=now,
    )
    for task in tasks:
      try:
        if rule.action == 'add_comment':
          text = rule.action_payload.get('comment') if isinstance(rule.action_payload, dict) else None
          TaskComment.objects.create(task=task, author=None, type='activity', text=text or 'Otomasyon: due yaklaşıyor')
        elif rule.action == 'notify':
          payload = rule.action_payload if isinstance(rule.action_payload, dict) else {}
          msg = payload.get('message') or f"Task {task.title}: vade yaklaşıyor"
          webhook = payload.get('webhook')
          email_to = payload.get('email') or (task.assignee.email if task.assignee else None)
          TaskComment.objects.create(task=task, author=None, type='activity', text='(Notify) Due yaklaşıyor')
          from .utils import send_slack_webhook, send_email
          send_slack_webhook(msg, webhook_url=webhook)
          if email_to:
            send_email(email_to, f"Görev bildirimi: {task.title}", msg)
          push_event(
            {
              "type": "notification.sla_due_soon",
              "task_id": task.id,
              "task_title": task.title,
              "due": task.due.isoformat() if task.due else None,
              "organization": task.organization_id,
              "rule_id": rule.id,
            }
          )
      except Exception as e:
        TaskComment.objects.create(task=task, author=None, type='activity', text=f"Otomasyon hata: {e}")

