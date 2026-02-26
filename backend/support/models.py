from django.db import models
from organizations.models import Organization
from accounts.models import User


class Ticket(models.Model):
    STATUSES = [('Open', 'Open'), ('In Progress', 'In Progress'), ('Waiting', 'Waiting'), ('Resolved', 'Resolved'), ('Closed', 'Closed')]
    PRIORITIES = [('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High'), ('Urgent', 'Urgent')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tickets')
    subject = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='Open')
    priority = models.CharField(max_length=20, choices=PRIORITIES, default='Medium')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    sla = models.CharField(max_length=20, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.subject


class TicketMessage(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField()
    internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class Task(models.Model):
    STATUSES = [('todo', 'todo'), ('in-progress', 'in-progress'), ('done', 'done')]
    PRIORITIES = [('low', 'low'), ('medium', 'medium'), ('high', 'high')]
    MODES = [('manual', 'manual'), ('fixed', 'fixed')]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks_owned')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks_assigned')
    team = models.ForeignKey('accounts.Team', on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    mode = models.CharField(max_length=20, choices=MODES, default='manual')
    model_code = models.CharField(max_length=50, blank=True, default='')
    variant = models.CharField(max_length=50, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    model_duration_minutes = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_planned_minutes = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    model_blade_depth = models.CharField(max_length=50, blank=True, default='')
    model_sizes = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='todo')
    priority = models.CharField(max_length=20, choices=PRIORITIES, default='medium')
    start = models.DateTimeField(null=True, blank=True)
    end = models.DateTimeField(null=True, blank=True)
    due = models.DateTimeField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    planned_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    planned_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_team = models.ForeignKey('accounts.Team', on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks_current')
    handover_reason = models.CharField(max_length=255, blank=True, default='')
    handover_at = models.DateTimeField(null=True, blank=True)
    handover_history = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


def task_attachment_path(instance, filename):
    return f"tasks/{instance.task.id}/{filename}"


class TaskAttachment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to=task_attachment_path)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255, blank=True, default='')
    original_name = models.CharField(max_length=255, blank=True, default='')
    content_type = models.CharField(max_length=100, blank=True, default='')
    size = models.BigIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    tags = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.task.title} - {self.file.name}"


class TaskChecklist(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='checklist')
    title = models.CharField(max_length=255)
    done = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.task.title} - {self.title}"


class TaskComment(models.Model):
    TYPES = [('comment', 'comment'), ('activity', 'activity')]
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    text = models.TextField(blank=True, default='')
    type = models.CharField(max_length=20, choices=TYPES, default='comment')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.task.title} - {self.type}"


class TaskTimeEntry(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='time_entries')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    team = models.ForeignKey('accounts.Team', on_delete=models.SET_NULL, null=True, blank=True)
    section = models.CharField(max_length=100, blank=True, default='')
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.task.title} - {self.user} ({self.started_at})"

