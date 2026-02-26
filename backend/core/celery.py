import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("core")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Celery Beat Schedule - SLA ve otomasyon için periyodik görevler
app.conf.beat_schedule = {
    'run-due-soon-automations': {
        'task': 'support.tasks.run_due_soon_automations',
        'schedule': 1800.0,  # Her 30 dakikada (saniye cinsinden)
    },
}
