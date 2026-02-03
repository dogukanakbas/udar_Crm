from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_quote_email(quote_id: int):
    logger.info("Mock send quote email for quote %s", quote_id)
    return True


@shared_task
def approval_reminder():
    logger.info("Approval reminder job ran")
    return True


@shared_task
def recompute_kpis():
    logger.info("KPI recompute job ran")
    return True

