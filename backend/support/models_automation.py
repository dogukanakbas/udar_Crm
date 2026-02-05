from django.db import models
from organizations.models import Organization


class AutomationRule(models.Model):
    TRIGGERS = [
        ('task_status_changed', 'Task status changed'),
        ('task_due_soon', 'Task due soon'),
        ('task_created', 'Task created'),
    ]
    ACTIONS = [
        ('add_comment', 'Add comment'),
        ('set_assignee', 'Set assignee'),
        ('notify', 'Notify'),
        ('multi_notify', 'Notify multiple'),
        ('add_tag', 'Add tag'),
        ('set_field', 'Set field'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='automation_rules')
    name = models.CharField(max_length=255)
    trigger = models.CharField(max_length=50, choices=TRIGGERS)
    condition = models.JSONField(default=dict, blank=True)  # e.g., {"from": "todo", "to": "done"} or {"hours": 24}
    action = models.CharField(max_length=50, choices=ACTIONS)
    action_payload = models.JSONField(default=dict, blank=True)  # e.g., {"comment": "Tamamlandı"} or {"assignee": user_id}
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


