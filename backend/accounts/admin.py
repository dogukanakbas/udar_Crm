from django.contrib import admin
from .models import User, Team, OrganizationSettings


@admin.register(OrganizationSettings)
class OrganizationSettingsAdmin(admin.ModelAdmin):
    list_display = ('organization', 'working_hours_start', 'working_hours_end', 'working_days')


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'organization')
    list_filter = ('role', 'organization')


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization')
    list_filter = ('organization',)
