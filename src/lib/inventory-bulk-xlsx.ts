import * as XLSX from 'xlsx'

import type { Category, Product, CategoryTemplateField } from '@/types'

const PRODUCT_SHEET = 'Ürünler'
const CATEGORY_SHEET = 'Kategoriler'
const GUIDE_SHEET = 'Açıklama'

const PRODUCT_HEADERS = [
  'SKU',
  'Ürün Adı',
  'Kategori',
  'Fiyat',
  'Stok',
  'Rezerve',
  'Emniyet Stoğu',
  'Belge Grubu',
  'Varsayılan Birim',
  'Varsayılan KDV',
  'Varsayılan İskonto',
  'Varsayılan İskonto 2',
  'Şablon Ailesi',
  'Teknik Alan Değerleri JSON',
  'Alan Şeması Override JSON',
] as const

const CATEGORY_HEADERS = [
  'Kategori',
  'Belge Grubu',
  'Varsayılan Birim',
  'Varsayılan KDV',
  'Varsayılan İskonto',
  'Varsayılan İskonto 2',
  'Şablon Ailesi',
  'Alan Şeması JSON',
] as const

type InventoryCategoryPayload = {
  name: string
  template_defaults: Record<string, any>
  attribute_schema: CategoryTemplateField[]
}

type InventoryProductPayload = {
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

export type InventoryWorkbookPayload = {
  categories: InventoryCategoryPayload[]
  products: InventoryProductPayload[]
}

function safeJson(value: unknown, fallback: string) {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2)
  } catch {
    return fallback
  }
}

function parseJsonObject(value: unknown) {
  if (!value || typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function parseJsonArray(value: unknown) {
  if (!value || typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : []
  } catch {
    return []
  }
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildGuideSheet() {
  const rows = [
    ['Toplu ürün şablonu'],
    [],
    ['1. Ürünler sayfasında her satır bir ürün kartıdır.'],
    ['2. Kategoriler sayfası opsiyoneldir ama önerilir; kategori varsayımlarını burada tutabilirsiniz.'],
    ['3. SKU doluysa aynı SKU güncellenir, yoksa yeni ürün oluşur.'],
    ['4. Teknik alanlar JSON kolonlarına geçerli JSON yazabilirsiniz. Örn: {"renk":"Beyaz"}'],
    ['5. Şablonu indirip düzenledikten sonra aynı ekrandan tekrar içe aktarabilirsiniz.'],
    [],
    ['Örnek teknik alan JSON', '{"renk":"Beyaz","ölçü":"90x210"}'],
    ['Örnek alan şeması JSON', '[{"field_key":"renk","label":"Renk","type":"text"}]'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 32 }, { wch: 64 }]
  return sheet
}

function buildTemplateCategoryRows() {
  return [
    {
      Kategori: 'Örnek Kapı Grubu',
      'Belge Grubu': 'KAPI',
      'Varsayılan Birim': 'Adet',
      'Varsayılan KDV': 20,
      'Varsayılan İskonto': 0,
      'Varsayılan İskonto 2': 0,
      'Şablon Ailesi': 'ornek_kapi',
      'Alan Şeması JSON': safeJson(
        [{ field_key: 'renk', label: 'Renk', type: 'text', required: false, order: 1, applies_to_documents: 'both' }],
        '[]'
      ),
    },
  ]
}

function buildTemplateProductRows() {
  return [
    {
      SKU: 'ORNEK-001',
      'Ürün Adı': 'Örnek Kapı',
      Kategori: 'Örnek Kapı Grubu',
      Fiyat: 12500,
      Stok: 5,
      Rezerve: 1,
      'Emniyet Stoğu': 2,
      'Belge Grubu': 'KAPI',
      'Varsayılan Birim': 'Adet',
      'Varsayılan KDV': 20,
      'Varsayılan İskonto': 0,
      'Varsayılan İskonto 2': 0,
      'Şablon Ailesi': 'ornek_kapi',
      'Teknik Alan Değerleri JSON': safeJson({ renk: 'Beyaz', ölçü: '90x210' }, '{}'),
      'Alan Şeması Override JSON': safeJson([], '[]'),
    },
  ]
}

function categoryRowsFromState(categories: Category[]) {
  return categories.map((category) => ({
    Kategori: category.name || '',
    'Belge Grubu': category.templateDefaults?.section_key || '',
    'Varsayılan Birim': category.templateDefaults?.unit || '',
    'Varsayılan KDV': numberValue(category.templateDefaults?.tax),
    'Varsayılan İskonto': numberValue(category.templateDefaults?.discount),
    'Varsayılan İskonto 2': numberValue(category.templateDefaults?.discount_secondary),
    'Şablon Ailesi': category.templateDefaults?.template_family || '',
    'Alan Şeması JSON': safeJson(category.attributeSchema || [], '[]'),
  }))
}

function productRowsFromState(products: Product[]) {
  return products.map((product) => ({
    SKU: product.sku || '',
    'Ürün Adı': product.name || '',
    Kategori: product.categoryName || product.category || '',
    Fiyat: numberValue(product.price),
    Stok: numberValue(product.stock),
    Rezerve: numberValue(product.reserved),
    'Emniyet Stoğu': numberValue(product.reorderPoint),
    'Belge Grubu': product.templateDefaults?.section_key || '',
    'Varsayılan Birim': product.templateDefaults?.unit || '',
    'Varsayılan KDV': numberValue(product.templateDefaults?.tax),
    'Varsayılan İskonto': numberValue(product.templateDefaults?.discount),
    'Varsayılan İskonto 2': numberValue(product.templateDefaults?.discount_secondary),
    'Şablon Ailesi': product.templateDefaults?.template_family || '',
    'Teknik Alan Değerleri JSON': safeJson(product.attributeValues || {}, '{}'),
    'Alan Şeması Override JSON': safeJson(product.attributeSchemaOverride || [], '[]'),
  }))
}

function appendSizedSheet(
  workbook: XLSX.WorkBook,
  rows: Record<string, any>[],
  sheetName: string,
  headers: readonly string[],
  widths: number[]
) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...headers] })
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
}

export function downloadInventoryTemplateWorkbook() {
  const workbook = XLSX.utils.book_new()
  appendSizedSheet(workbook, buildTemplateProductRows(), PRODUCT_SHEET, PRODUCT_HEADERS, [18, 28, 22, 12, 10, 10, 14, 16, 16, 14, 16, 18, 18, 40, 40])
  appendSizedSheet(workbook, buildTemplateCategoryRows(), CATEGORY_SHEET, CATEGORY_HEADERS, [24, 18, 16, 14, 16, 18, 18, 40])
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(), GUIDE_SHEET)
  XLSX.writeFile(workbook, 'stok_toplu_urun_sablonu.xlsx')
}

export function downloadInventoryStateWorkbook(products: Product[], categories: Category[]) {
  const workbook = XLSX.utils.book_new()
  const productRows = productRowsFromState(products)
  const categoryRows = categoryRowsFromState(categories)
  appendSizedSheet(
    workbook,
    productRows.length ? productRows : buildTemplateProductRows(),
    PRODUCT_SHEET,
    PRODUCT_HEADERS,
    [18, 28, 22, 12, 10, 10, 14, 16, 16, 14, 16, 18, 18, 40, 40]
  )
  appendSizedSheet(
    workbook,
    categoryRows.length ? categoryRows : buildTemplateCategoryRows(),
    CATEGORY_SHEET,
    CATEGORY_HEADERS,
    [24, 18, 16, 14, 16, 18, 18, 40]
  )
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(), GUIDE_SHEET)
  const fileDate = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `stok_urunleri_${fileDate}.xlsx`)
}

function categoryPayloadFromRow(row: Record<string, any>): InventoryCategoryPayload | null {
  const name = String(row['Kategori'] || '').trim()
  if (!name) return null
  return {
    name,
    template_defaults: {
      section_key: String(row['Belge Grubu'] || '').trim(),
      unit: String(row['Varsayılan Birim'] || '').trim(),
      tax: numberValue(row['Varsayılan KDV']),
      discount: numberValue(row['Varsayılan İskonto']),
      discount_secondary: numberValue(row['Varsayılan İskonto 2']),
      template_family: String(row['Şablon Ailesi'] || '').trim(),
    },
    attribute_schema: parseJsonArray(row['Alan Şeması JSON']),
  }
}

function productPayloadFromRow(row: Record<string, any>): InventoryProductPayload | null {
  const sku = String(row['SKU'] || '').trim()
  const name = String(row['Ürün Adı'] || '').trim()
  const categoryName = String(row['Kategori'] || '').trim()
  if (!sku && !name) return null
  return {
    sku,
    name: name || sku,
    category_name: categoryName,
    price: numberValue(row['Fiyat']),
    stock: numberValue(row['Stok']),
    reserved: numberValue(row['Rezerve']),
    reorder_point: numberValue(row['Emniyet Stoğu']),
    template_defaults: {
      section_key: String(row['Belge Grubu'] || '').trim(),
      unit: String(row['Varsayılan Birim'] || '').trim(),
      tax: numberValue(row['Varsayılan KDV']),
      discount: numberValue(row['Varsayılan İskonto']),
      discount_secondary: numberValue(row['Varsayılan İskonto 2']),
      template_family: String(row['Şablon Ailesi'] || '').trim(),
    },
    attribute_values: parseJsonObject(row['Teknik Alan Değerleri JSON']),
    attribute_schema_override: parseJsonArray(row['Alan Şeması Override JSON']),
  }
}

export async function parseInventoryWorkbook(file: File): Promise<InventoryWorkbookPayload> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const productSheet = workbook.Sheets[PRODUCT_SHEET]
  if (!productSheet) {
    throw new Error(`"${PRODUCT_SHEET}" sayfası bulunamadı`)
  }

  const categorySheet = workbook.Sheets[CATEGORY_SHEET]
  const categoryRows = categorySheet ? XLSX.utils.sheet_to_json<Record<string, any>>(categorySheet, { defval: '' }) : []
  const productRows = XLSX.utils.sheet_to_json<Record<string, any>>(productSheet, { defval: '' })

  const categoryMap = new Map<string, InventoryCategoryPayload>()
  for (const row of categoryRows) {
    const payload = categoryPayloadFromRow(row)
    if (payload) categoryMap.set(payload.name, payload)
  }

  const products: InventoryProductPayload[] = []
  for (const row of productRows) {
    const payload = productPayloadFromRow(row)
    if (!payload) continue
    products.push(payload)
    if (payload.category_name && !categoryMap.has(payload.category_name)) {
      categoryMap.set(payload.category_name, {
        name: payload.category_name,
        template_defaults: payload.template_defaults,
        attribute_schema: [],
      })
    }
  }

  if (products.length === 0) {
    throw new Error('İçe aktarılacak ürün satırı bulunamadı')
  }

  return {
    categories: Array.from(categoryMap.values()),
    products,
  }
}
