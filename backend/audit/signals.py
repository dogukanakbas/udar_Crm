from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver

from audit.utils import log_entity_action


TRACKED_LABELS = {
    'crm.Quote',
    'erp.Invoice',
    'erp.SalesOrder',
    'erp.PurchaseOrder',
    'erp.StockMovement',
    'support.Ticket',
}


def _is_tracked(sender):
    return f"{sender._meta.app_label}.{sender.__name__}" in TRACKED_LABELS


@receiver(pre_save)
def audit_pre_save(sender, instance, **kwargs):
    if not _is_tracked(sender):
        return
    if not instance.pk:
        return
    try:
        previous = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    snapshot = {}
    for field in sender._meta.concrete_fields:
        name = field.name
        snapshot[name] = getattr(previous, name)
    instance._audit_snapshot = snapshot


@receiver(post_save)
def audit_post_save(sender, instance, created, **kwargs):
    if not _is_tracked(sender):
        return
    user = getattr(instance, '_audit_user', None) or getattr(instance, 'acted_by', None) or getattr(instance, 'owner', None)
    if created:
        log_entity_action(instance, 'created', user=user)
        return
    snapshot = getattr(instance, '_audit_snapshot', None)
    if not snapshot:
        log_entity_action(instance, 'updated', user=user)
        return
    for field in sender._meta.concrete_fields:
        name = field.name
        old = snapshot.get(name)
        new = getattr(instance, name)
        if old != new:
            log_entity_action(instance, 'updated', user=user, field=name, old_value=old, new_value=new)


@receiver(post_delete)
def audit_post_delete(sender, instance, **kwargs):
    if not _is_tracked(sender):
        return
    user = getattr(instance, '_audit_user', None) or getattr(instance, 'acted_by', None) or getattr(instance, 'owner', None)
    log_entity_action(instance, 'deleted', user=user)

