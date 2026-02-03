from audit.models import AuditLog


def log_change(organization, entity, entity_id, action, user=None, field='', old_value='', new_value=''):
    AuditLog.objects.create(
        organization=organization,
        entity=entity,
        entity_id=str(entity_id),
        action=action,
        field=field,
        old_value=old_value,
        new_value=new_value,
        user=user,
    )


def log_entity_action(obj, action: str, user=None, field: str = '', old_value: str = '', new_value: str = ''):
    """
    Convenience wrapper; expects obj to have organization and id.
    """
    org = getattr(obj, 'organization', None)
    entity = obj.__class__.__name__
    entity_id = getattr(obj, 'id', None)
    log_change(org, entity, entity_id, action, user=user, field=field, old_value=old_value, new_value=new_value)

