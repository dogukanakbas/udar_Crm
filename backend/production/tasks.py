from celery import shared_task


@shared_task
def enqueue_contract_for_production(quote_id: int):
    from crm.models import Quote
    from .services import create_work_order_from_contract

    quote = (
        Quote.objects.filter(pk=quote_id)
        .select_related('organization', 'customer', 'prepared_by', 'owner')
        .prefetch_related('lines__product__category')
        .first()
    )
    if not quote:
        return {'created': False, 'reason': 'quote_not_found'}
    if quote.document_type != 'Contract' or quote.status != 'Approved':
        return {'created': False, 'reason': 'contract_not_approved'}
    order = create_work_order_from_contract(quote)
    if not order:
        return {'created': False, 'reason': 'no_matching_production_route'}
    return {'created': True, 'work_order_id': order.id, 'work_order_number': order.number}
