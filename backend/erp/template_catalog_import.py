from decimal import Decimal

from audit.utils import log_change

from .models import Category, Product


def _normalize_schema(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _normalize_object(value):
    return value if isinstance(value, dict) else {}


def upsert_product_catalog(
    organization,
    categories_data,
    products_data,
    user=None,
    *,
    audit_entity='ProductCatalog',
    audit_entity_id='product-catalog',
    audit_action='bulk_upserted',
    audit_field='product_catalog',
    delete_import_origin=None,
):
    created_categories = 0
    updated_categories = 0
    created_products = 0
    updated_products = 0
    deleted_products = 0
    deleted_categories = 0
    category_cache = {}
    incoming_skus = set()
    imported_category_names = set()

    for raw_category in categories_data:
        if not isinstance(raw_category, dict):
            continue
        name = str(raw_category.get('name') or '').strip()
        if not name:
            continue

        template_defaults = _normalize_object(raw_category.get('template_defaults') or raw_category.get('templateDefaults'))
        attribute_schema = _normalize_schema(raw_category.get('attribute_schema') or raw_category.get('attributeSchema'))
        imported_category_names.add(name)

        category = Category.objects.filter(organization=organization, name=name).first()
        if category:
            changed = False
            if category.template_defaults != template_defaults:
                category.template_defaults = template_defaults
                changed = True
            if category.attribute_schema != attribute_schema:
                category.attribute_schema = attribute_schema
                changed = True
            if changed:
                category.save(update_fields=['template_defaults', 'attribute_schema'])
                updated_categories += 1
        else:
            category = Category.objects.create(
                organization=organization,
                name=name,
                template_defaults=template_defaults,
                attribute_schema=attribute_schema,
            )
            created_categories += 1
        category_cache[name] = category

    for raw_product in products_data:
        if not isinstance(raw_product, dict):
            continue
        sku = str(raw_product.get('sku') or '').strip()
        if not sku:
            continue
        incoming_skus.add(sku)

        name = str(raw_product.get('name') or sku).strip() or sku
        category_name = str(raw_product.get('category_name') or raw_product.get('categoryName') or '').strip()
        category = category_cache.get(category_name)
        if not category and category_name:
            category = Category.objects.filter(organization=organization, name=category_name).first()
            if category:
                category_cache[category_name] = category

        template_defaults = _normalize_object(raw_product.get('template_defaults') or raw_product.get('templateDefaults'))
        attribute_values = _normalize_object(raw_product.get('attribute_values') or raw_product.get('attributeValues'))
        attribute_schema_override = _normalize_schema(
            raw_product.get('attribute_schema_override') or raw_product.get('attributeSchemaOverride')
        )
        price = Decimal(str(raw_product.get('price') or 0))
        stock = Decimal(str(raw_product.get('stock') or 0))
        reserved = Decimal(str(raw_product.get('reserved') or 0))
        reorder_point = Decimal(str(raw_product.get('reorder_point') or raw_product.get('reorderPoint') or 0))

        product = Product.objects.filter(organization=organization, sku=sku).first()
        if product:
            changed = False
            if product.name != name:
                product.name = name
                changed = True
            if product.category_id != getattr(category, 'id', None):
                product.category = category
                changed = True
            if product.price != price:
                product.price = price
                changed = True
            if product.template_defaults != template_defaults:
                product.template_defaults = template_defaults
                changed = True
            if product.attribute_values != attribute_values:
                product.attribute_values = attribute_values
                changed = True
            if product.attribute_schema_override != attribute_schema_override:
                product.attribute_schema_override = attribute_schema_override
                changed = True
            if changed:
                product.save(
                    update_fields=[
                        'name',
                        'category',
                        'price',
                        'template_defaults',
                        'attribute_values',
                        'attribute_schema_override',
                    ]
                )
                updated_products += 1
        else:
            Product.objects.create(
                organization=organization,
                sku=sku,
                name=name,
                category=category,
                price=price,
                stock=stock,
                reserved=reserved,
                reorder_point=reorder_point,
                template_defaults=template_defaults,
                attribute_values=attribute_values,
                attribute_schema_override=attribute_schema_override,
            )
            created_products += 1

    if delete_import_origin:
        stale_products = Product.objects.filter(
            organization=organization,
            attribute_values__import_origin=delete_import_origin,
        ).exclude(sku__in=incoming_skus)
        deleted_products = stale_products.count()
        if deleted_products:
            stale_products.delete()

        stale_categories = Category.objects.filter(
            organization=organization,
            template_defaults__import_origin=delete_import_origin,
        ).exclude(name__in=imported_category_names)
        deleted_categories = stale_categories.count()
        if deleted_categories:
            stale_categories.delete()

    log_change(
        organization,
        audit_entity,
        audit_entity_id,
        audit_action,
        user=user,
        field=audit_field,
        new_value={
            'created_categories': created_categories,
            'updated_categories': updated_categories,
            'deleted_categories': deleted_categories,
            'created_products': created_products,
            'updated_products': updated_products,
            'deleted_products': deleted_products,
        },
    )
    return {
        'created_categories': created_categories,
        'updated_categories': updated_categories,
        'deleted_categories': deleted_categories,
        'created_products': created_products,
        'updated_products': updated_products,
        'deleted_products': deleted_products,
        'total_categories': len(imported_category_names),
        'total_products': len(incoming_skus),
    }


def upsert_template_catalog(organization, categories_data, products_data, user=None):
    return upsert_product_catalog(
        organization,
        categories_data,
        products_data,
        user=user,
        audit_entity='TemplateCatalog',
        audit_entity_id='template-catalog',
        audit_action='imported',
        audit_field='template_catalog',
        delete_import_origin='excel_templates',
    )
