from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum

from .models import InventoryLocation, Product, StockMovement, WarehouseStock


class InventoryError(ValueError):
    pass


def as_decimal(value, label='Miktar'):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise InventoryError(f'{label} sayısal olmalıdır.')
    if result < 0:
        raise InventoryError(f'{label} negatif olamaz.')
    return result


def resolve_product_details(product):
    values = product.attribute_values or {}
    meaningful = [str(value) for value in values.values() if value not in [None, '']]
    defaults = product.template_defaults or {}
    return (
        str(defaults.get('primary') or (meaningful[0] if meaningful else '')),
        str(defaults.get('secondary') or (meaningful[1] if len(meaningful) > 1 else '')),
    )


def sync_product_total(product):
    total = product.warehouse_stocks.aggregate(total=Sum('quantity'))['total'] or Decimal('0')
    Product.objects.filter(pk=product.pk).update(stock=total)
    product.stock = total
    return total


def _validate_location(organization, location):
    if location.organization_id != organization.id or location.warehouse.organization_id != organization.id:
        raise InventoryError('Raf bu organizasyona ait değil.')
    if not location.is_active or not location.warehouse.is_active:
        raise InventoryError('Pasif depo veya rafta stok işlemi yapılamaz.')


def _normalize_detail(value):
    return str(value or '').strip()


def _get_locked_stock(organization, product, location, *, allow_legacy=False, detail_1_override='', detail_2_override=''):
    _validate_location(organization, location)
    if not allow_legacy and product.inventory_mode != 'warehouse':
        if product.stock:
            raise InventoryError('Mevcut bakiyesi bulunan ürün önce açılış stok devriyle depo sistemine alınmalıdır.')
        Product.objects.filter(pk=product.pk).update(inventory_mode='warehouse')
        product.inventory_mode = 'warehouse'
    stock, _ = WarehouseStock.objects.select_for_update().get_or_create(
        organization=organization,
        warehouse=location.warehouse,
        location=location,
        product=product,
        detail_1_override=_normalize_detail(detail_1_override),
        detail_2_override=_normalize_detail(detail_2_override),
    )
    return stock


def _record(*, organization, product, movement_type, quantity, user=None, reference='', note='', source_type='manual',
            source_id='', from_stock=None, to_stock=None, previous_quantity=None, resulting_quantity=None):
    return StockMovement.objects.create(
        organization=organization,
        product=product,
        movement_type=movement_type,
        quantity=quantity,
        reference=reference,
        note=note,
        source_type=source_type,
        source_id=source_id,
        detail_1=(to_stock or from_stock).detail_1_override if (to_stock or from_stock) else '',
        detail_2=(to_stock or from_stock).detail_2_override if (to_stock or from_stock) else '',
        acted_by=user,
        warehouse_from=from_stock.warehouse if from_stock else None,
        warehouse_to=to_stock.warehouse if to_stock else None,
        location_from_ref=from_stock.location if from_stock else None,
        location_to_ref=to_stock.location if to_stock else None,
        location_from=from_stock.location.code if from_stock else '',
        location_to=to_stock.location.code if to_stock else '',
        previous_quantity=previous_quantity,
        resulting_quantity=resulting_quantity,
    )


@transaction.atomic
def stock_in(*, organization, product, location, quantity, user=None, reference='', note='', source_type='manual', source_id='',
             detail_1_override='', detail_2_override=''):
    quantity = as_decimal(quantity)
    if quantity <= 0:
        raise InventoryError('Miktar sıfırdan büyük olmalıdır.')
    stock = _get_locked_stock(organization, product, location, detail_1_override=detail_1_override, detail_2_override=detail_2_override)
    previous = stock.quantity
    stock.quantity += quantity
    stock.save(update_fields=['quantity', 'updated_at'])
    sync_product_total(product)
    return _record(organization=organization, product=product, movement_type='IN', quantity=quantity, user=user,
                   reference=reference, note=note, source_type=source_type, source_id=source_id,
                   to_stock=stock, previous_quantity=previous, resulting_quantity=stock.quantity)


@transaction.atomic
def stock_out(*, organization, product, location, quantity, user=None, reference='', note='', source_type='manual', source_id='',
              detail_1_override='', detail_2_override=''):
    quantity = as_decimal(quantity)
    if quantity <= 0:
        raise InventoryError('Miktar sıfırdan büyük olmalıdır.')
    if not str(note or reference).strip():
        raise InventoryError('Stok çıkışında açıklama veya referans zorunludur.')
    stock = _get_locked_stock(organization, product, location, detail_1_override=detail_1_override, detail_2_override=detail_2_override)
    previous = stock.quantity
    if previous < quantity:
        raise InventoryError(f'Yetersiz stok. Kullanılabilir miktar: {previous}')
    stock.quantity -= quantity
    stock.save(update_fields=['quantity', 'updated_at'])
    sync_product_total(product)
    return _record(organization=organization, product=product, movement_type='OUT', quantity=quantity, user=user,
                   reference=reference, note=note, source_type=source_type, source_id=source_id,
                   from_stock=stock, previous_quantity=previous, resulting_quantity=stock.quantity)


@transaction.atomic
def adjust(*, organization, product, location, target_quantity, user=None, reference='', note='', source_type='manual', source_id='',
           detail_1_override=None, detail_2_override=None):
    target_quantity = as_decimal(target_quantity, 'Hedef miktar')
    if not str(note or reference).strip():
        raise InventoryError('Sayım düzeltmesinde açıklama veya referans zorunludur.')
    stock = _get_locked_stock(organization, product, location, detail_1_override=detail_1_override, detail_2_override=detail_2_override)
    previous = stock.quantity
    stock.quantity = target_quantity
    stock.save(update_fields=['quantity', 'updated_at'])
    sync_product_total(product)
    return _record(organization=organization, product=product, movement_type='ADJUST', quantity=abs(target_quantity - previous),
                   user=user, reference=reference, note=note, source_type=source_type, source_id=source_id,
                   to_stock=stock, previous_quantity=previous, resulting_quantity=stock.quantity)


@transaction.atomic
def transfer(*, organization, product, location_from, location_to, quantity, user=None, reference='', note='',
             detail_1_override='', detail_2_override=''):
    quantity = as_decimal(quantity)
    if quantity <= 0:
        raise InventoryError('Miktar sıfırdan büyük olmalıdır.')
    if location_from.pk == location_to.pk:
        raise InventoryError('Kaynak ve hedef raf aynı olamaz.')
    if not str(note or reference).strip():
        raise InventoryError('Transferde açıklama veya referans zorunludur.')
    # Stable lock order prevents deadlocks on concurrent transfers.
    first, second = sorted([location_from, location_to], key=lambda item: item.pk)
    first_stock = _get_locked_stock(organization, product, first, detail_1_override=detail_1_override, detail_2_override=detail_2_override)
    second_stock = _get_locked_stock(organization, product, second, detail_1_override=detail_1_override, detail_2_override=detail_2_override)
    source = first_stock if first.pk == location_from.pk else second_stock
    target = second_stock if second.pk == location_to.pk else first_stock
    previous = source.quantity
    if previous < quantity:
        raise InventoryError(f'Yetersiz stok. Kullanılabilir miktar: {previous}')
    source.quantity -= quantity
    target.quantity += quantity
    source.save(update_fields=['quantity', 'updated_at'])
    target.save(update_fields=['quantity', 'updated_at'])
    sync_product_total(product)
    return _record(organization=organization, product=product, movement_type='TRANSFER', quantity=quantity, user=user,
                   reference=reference, note=note, from_stock=source, to_stock=target,
                   previous_quantity=previous, resulting_quantity=source.quantity)


@transaction.atomic
def allocate_opening_balance(*, organization, product, allocations, user=None):
    product = Product.objects.select_for_update().get(pk=product.pk, organization=organization)
    if product.inventory_mode == 'warehouse':
        raise InventoryError('Bu ürün daha önce depo sistemine devralınmış.')
    normalized = []
    total = Decimal('0')
    for item in allocations:
        location = InventoryLocation.objects.select_related('warehouse').get(pk=item.get('location_id'), organization=organization)
        quantity = as_decimal(item.get('quantity', 0))
        _validate_location(organization, location)
        normalized.append((location, quantity, item))
        total += quantity
    if total != product.stock:
        raise InventoryError(f'Dağıtım toplamı mevcut stokla eşleşmelidir. Mevcut stok: {product.stock}')
    for location, quantity, item in normalized:
        stock = _get_locked_stock(
            organization,
            product,
            location,
            allow_legacy=True,
            detail_1_override=item.get('detail_1_override'),
            detail_2_override=item.get('detail_2_override'),
        )
        if stock.quantity:
            raise InventoryError('Açılış aktarımı yapılacak rafta bu ürün için mevcut bakiye var.')
        stock.quantity = quantity
        stock.save()
        _record(organization=organization, product=product, movement_type='OPENING', quantity=quantity, user=user,
                reference='AÇILIŞ AKTARIMI', note='Eski toplam stok depo rafına devralındı.', source_type='opening',
                to_stock=stock, previous_quantity=Decimal('0'), resulting_quantity=quantity)
    product.inventory_mode = 'warehouse'
    product.save(update_fields=['inventory_mode'])
    sync_product_total(product)
    return product
