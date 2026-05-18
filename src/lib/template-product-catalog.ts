import { MOBILYA_SUB_LIST_META, QUOTE_EXCEL_TEMPLATES } from '@/lib/quote-excel-template'
import type { CategoryTemplateField } from '@/types'

type ImportCategoryPayload = {
  name: string
  template_defaults: Record<string, any>
  attribute_schema: CategoryTemplateField[]
}

type ImportProductPayload = {
  sku: string
  name: string
  category_name: string
  price: number
  stock: number
  reserved: number
  reorder_point: number
  template_defaults: Record<string, any>
  attribute_values: Record<string, any>
  attribute_schema_override: CategoryTemplateField[]
}

export type TemplateCatalogImportPayload = {
  categories: ImportCategoryPayload[]
  products: ImportProductPayload[]
}

function categoryDefaults(sectionKey: string, unit: string, tax: number, family: string) {
  return {
    section_key: sectionKey,
    unit,
    tax,
    discount: 0,
    discount_secondary: 0,
    template_family: family,
    import_origin: 'excel_templates',
  }
}

function pushCategory(
  categories: Map<string, ImportCategoryPayload>,
  name: string,
  sectionKey: string,
  unit: string,
  tax: number,
  family: string
) {
  if (categories.has(name)) return
  categories.set(name, {
    name,
    template_defaults: categoryDefaults(sectionKey, unit, tax, family),
    attribute_schema: [],
  })
}

function pushProduct(
  products: Map<string, ImportProductPayload>,
  row: { code: string; name: string; listPrice: number },
  categoryName: string,
  sectionKey: string,
  unit: string,
  tax: number,
  family: string
) {
  const sku = String(row.code || '').trim()
  if (!sku || products.has(sku)) return
  products.set(sku, {
    sku,
    name: String(row.name || '').trim() || sku,
    category_name: categoryName,
    price: Number(row.listPrice || 0),
    stock: 0,
    reserved: 0,
    reorder_point: 0,
    template_defaults: categoryDefaults(sectionKey, unit, tax, family),
    attribute_values: { import_origin: 'excel_templates' },
    attribute_schema_override: [],
  })
}

export function buildTemplateCatalogImportPayload(): TemplateCatalogImportPayload {
  const categories = new Map<string, ImportCategoryPayload>()
  const products = new Map<string, ImportProductPayload>()

  for (const template of QUOTE_EXCEL_TEMPLATES) {
    if (template.id === 'mobilya' && template.mobilyaSublists) {
      for (const subMeta of MOBILYA_SUB_LIST_META) {
        const categoryName =
          subMeta.id === 'mutfak'
            ? 'Mobilya / Mutfak'
            : subMeta.id === 'portmanto'
              ? 'Mobilya / Portmanto'
              : 'Mobilya / Banyo'
        const family = `mobilya_${subMeta.id}`
        const sectionKey = subMeta.id.toUpperCase()
        pushCategory(categories, categoryName, sectionKey, subMeta.defaultUnit, template.vatPercent, family)
        const rows = template.mobilyaSublists[subMeta.id] || []
        for (const row of rows) {
          pushProduct(products, row, categoryName, sectionKey, subMeta.defaultUnit, template.vatPercent, family)
        }
      }
      continue
    }

    const categoryName =
      template.id === 'celik_kapi'
        ? 'Çelik Kapı'
        : template.id === 'ic_oda'
          ? 'İç Oda Kapısı'
          : template.id === 'montaj'
            ? 'Montaj'
            : template.label
    const sectionKey =
      template.id === 'celik_kapi'
        ? 'ÇELİK KAPI'
        : template.id === 'ic_oda'
          ? 'İÇ ODA KAPISI'
          : template.id === 'montaj'
            ? 'MONTAJ'
            : template.productGroupTitle
    const family = template.id
    pushCategory(categories, categoryName, sectionKey, 'Adet', template.vatPercent, family)
    for (const row of template.rows) {
      pushProduct(products, row, categoryName, sectionKey, 'Adet', template.vatPercent, family)
    }
  }

  return {
    categories: Array.from(categories.values()),
    products: Array.from(products.values()),
  }
}
