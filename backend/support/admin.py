from django.contrib import admin
from .models import Task, TaskAttachment, TaskChecklist, TaskComment, TaskTimeEntry, Ticket, TicketMessage


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title',
        'status',
        'priority',
        'team',
        'current_team',
        'assignee',
        'owner',
        'handover_at',
        'due',
        'created_at',
    )
    list_filter = ('status', 'priority', 'team', 'current_team')
    search_fields = ('title', 'assignee__username', 'owner__username', 'team__name')
    readonly_fields = ('handover_history', 'created_at', 'updated_at')
    fieldsets = (
        (None, {'fields': ('organization', 'title', 'notes', 'status', 'priority')}),
        ('Atama', {'fields': ('owner', 'assignee', 'team', 'current_team')}),
        ('Süre ve plan', {'fields': ('start', 'end', 'due', 'planned_hours', 'planned_cost', 'quantity', 'total_planned_minutes')}),
        ('Model', {'fields': ('mode', 'model_code', 'variant', 'model_duration_minutes', 'model_blade_depth', 'model_sizes')}),
        ('Handover', {'fields': ('handover_reason', 'handover_at', 'handover_history')}),
        ('Diğer', {'fields': ('tags', 'created_at', 'updated_at')}),
    )


@admin.register(TaskTimeEntry)
class TaskTimeEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'user', 'team', 'section', 'started_at', 'ended_at')
    list_filter = ('team', 'section')
    search_fields = ('task__title', 'user__username', 'section')


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'original_name', 'uploaded_by', 'uploaded_at', 'version', 'size')
    search_fields = ('original_name', 'task__title', 'uploaded_by__username')


@admin.register(TaskChecklist)
class TaskChecklistAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'title', 'done', 'order')
    list_filter = ('done',)
    search_fields = ('task__title', 'title')


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'author', 'type', 'created_at')
    list_filter = ('type',)
    search_fields = ('task__title', 'author__username', 'text')


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'status', 'priority', 'assignee', 'updated_at')
    list_filter = ('status', 'priority')
    search_fields = ('subject', 'company_name', 'assignee__username')


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket', 'author', 'internal', 'created_at')
    list_filter = ('internal',)
    search_fields = ('ticket__subject', 'author__username', 'message')

