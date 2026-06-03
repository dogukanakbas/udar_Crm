from django.db import transaction


def schedule_contract_production_if_approved(quote, *, countdown=60):
    if not quote or getattr(quote, 'document_type', None) != 'Contract' or getattr(quote, 'status', None) != 'Approved':
        return False

    def _enqueue():
        from .tasks import enqueue_contract_for_production

        enqueue_contract_for_production.apply_async(args=[quote.id], countdown=countdown)

    transaction.on_commit(_enqueue)
    return True
