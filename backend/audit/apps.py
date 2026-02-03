from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'audit'

    def ready(self):
        # Import signals
        from . import signals  # noqa: F401
from django.apps import AppConfig


class AuditConfig(AppConfig):
    name = 'audit'
