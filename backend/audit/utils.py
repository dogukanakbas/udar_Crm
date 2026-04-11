import json
from datetime import date, datetime
from decimal import Decimal

from audit.models import AuditLog


def serialize_audit_value(value):
    if value in [None, '']:
        return ''
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): serialize_audit_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize_audit_value(item) for item in value]
    return value


def log_change(organization, entity, entity_id, action, user=None, field='', old_value='', new_value=''):
    serialized_old_value = serialize_audit_value(old_value)
    serialized_new_value = serialize_audit_value(new_value)
    AuditLog.objects.create(
        organization=organization,
        entity=entity,
        entity_id=str(entity_id),
        action=action,
        field=field,
        old_value='' if serialized_old_value == '' else json.dumps(serialized_old_value, ensure_ascii=False),
        new_value='' if serialized_new_value == '' else json.dumps(serialized_new_value, ensure_ascii=False),
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

