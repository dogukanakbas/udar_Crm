import {
  CELIK_KAPI_PRICE_ROWS,
  IC_ODA_PRICE_ROWS,
  MONTAJ_PRICE_ROWS,
  MOBILYA_MUTFAK_PRICE_ROWS,
  MOBILYA_PORTMANTO_PRICE_ROWS,
  MOBILYA_BANYO_PRICE_ROWS,
  type QuoteTemplatePriceRow,
} from '@/data/quote-template-lists.generated'

export type QuoteTemplateId = 'celik_kapi' | 'ic_oda' | 'montaj' | 'mobilya'

export type MobilyaSubListId = 'mutfak' | 'portmanto' | 'banyo'

export interface QuoteTemplateDefinition {
  id: QuoteTemplateId
  label: string
  productGroupTitle: string
  numberPrefix: string
  maxTableLines: number
  defaultDeliveryGroupLabel: string
  /** Ana VLOOKUP listesi (mobilya hariç) */
  rows: QuoteTemplatePriceRow[]
  /** KDV oranı: Excel çelik/iç oda/montaj tek tip %20; mobilya bölümlerde %10 */
  vatRate: number
  vatPercent: number
  mobilyaSublists?: Record<MobilyaSubListId, QuoteTemplatePriceRow[]>
}

const MOBILYA_SUBS: Record<MobilyaSubListId, QuoteTemplatePriceRow[]> = {
  mutfak: MOBILYA_MUTFAK_PRICE_ROWS,
  portmanto: MOBILYA_PORTMANTO_PRICE_ROWS,
  banyo: MOBILYA_BANYO_PRICE_ROWS,
}

export const QUOTE_EXCEL_TEMPLATES: QuoteTemplateDefinition[] = [
  {
    id: 'celik_kapi',
    label: 'Çelik kapı',
    productGroupTitle: 'ÇELİK KAPI',
    numberPrefix: 'CKTKLF-',
    maxTableLines: 5,
    defaultDeliveryGroupLabel: 'ÇELİK KAPI GRUBU',
    rows: CELIK_KAPI_PRICE_ROWS,
    vatRate: 0.2,
    vatPercent: 20,
  },
  {
    id: 'ic_oda',
    label: 'İç oda kapısı',
    productGroupTitle: 'İÇ ODA KAPISI',
    numberPrefix: 'IKTKLF-',
    maxTableLines: 7,
    defaultDeliveryGroupLabel: 'İÇ ODA KAPI GRUBU',
    rows: IC_ODA_PRICE_ROWS,
    vatRate: 0.2,
    vatPercent: 20,
  },
  {
    id: 'montaj',
    label: 'Montaj',
    productGroupTitle: 'MONTAJ',
    numberPrefix: 'MNTJTKLF-',
    maxTableLines: 9,
    defaultDeliveryGroupLabel: 'MONTAJ HİZMETİ',
    rows: MONTAJ_PRICE_ROWS,
    vatRate: 0.2,
    vatPercent: 20,
  },
  {
    id: 'mobilya',
    label: 'Mobilya (mutfak / portmanto / banyo)',
    productGroupTitle: 'MOBİLYA — Mutfak + Portmanto + Banyo',
    numberPrefix: 'MOBTKLF-',
    maxTableLines: 9,
    defaultDeliveryGroupLabel: 'MUTFAK / PORTMANTO / BANYO GRUPLARI',
    rows: [],
    vatRate: 0.1,
    vatPercent: 10,
    mobilyaSublists: MOBILYA_SUBS,
  },
]

export const MOBILYA_SUB_LIST_META: { id: MobilyaSubListId; label: string; defaultUnit: string }[] = [
  { id: 'mutfak', label: 'Mutfak dolabı (liste)', defaultUnit: 'Metre' },
  { id: 'portmanto', label: 'Portmanto & giyinme (liste)', defaultUnit: 'm²' },
  { id: 'banyo', label: 'Banyo (Excel listesi boş — manuel fiyat)', defaultUnit: 'Adet' },
]

export function quoteTemplateById(id: QuoteTemplateId): QuoteTemplateDefinition {
  const t = QUOTE_EXCEL_TEMPLATES.find((x) => x.id === id)
  if (!t) return QUOTE_EXCEL_TEMPLATES[0]
  return t
}

export function rowsForLine(template: QuoteTemplateDefinition, line: TemplateLineInput): QuoteTemplatePriceRow[] {
  if (template.id === 'mobilya' && template.mobilyaSublists) {
    const sub = line.mobilyaSubList || 'mutfak'
    return template.mobilyaSublists[sub] ?? []
  }
  return template.rows
}

export function lookupPriceRow(template: QuoteTemplateDefinition, line: TemplateLineInput, code: string): QuoteTemplatePriceRow | undefined {
  if (!code?.trim()) return undefined
  const rows = rowsForLine(template, line)
  return rows.find((r) => r.code === code)
}

/**
 * Liste satırında yalnızca `code`, `name`, `listPrice` var; ölçü ve kapak/yüzey yok.
 * `name` metninden yaygın Excel kalıplarıyla ipuçları çıkarılır (m², kasa ölçüsü, mm, seri/yüzey).
 */
export function hintsFromPriceRowName(name: string): { measure: string; color: string } {
  const n = name.trim()
  const measureParts: string[] = []
  let color = ''

  const m2Paren = n.match(/\(\s*([\d.,]+\s*(?:m\s*²|m2))\s*\)/i)
  if (m2Paren) {
    measureParts.push(
      m2Paren[1]
        .replace(/\s+/g, ' ')
        .replace(/m2/gi, 'm²')
        .trim()
    )
  }

  const kasa = n.match(/\((\d+)\s*\*\s*(\d+)\)/)
  if (kasa) measureParts.push(`${kasa[1]}×${kasa[2]}`)

  const tok = n.match(/\((\d+-\d+\*\d+\*\d+)\)/)
  if (tok) measureParts.push(tok[1])

  if (measureParts.length === 0) {
    const inlineM2 = n.match(/([\d.,]+\s*m\s*²)/i)
    if (inlineM2) measureParts.push(inlineM2[1].replace(/\s+/g, ' ').trim())
  }

  const mm = n.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i)
  if (mm) measureParts.push(`${mm[1].replace(',', '.')} mm`)

  const FINISHES = ['Membran', 'Lake', 'Newlıne', 'Newline', 'Fugalı', 'Baroniel', 'Krom'] as const
  for (const f of FINISHES) {
    if (n.includes(f)) {
      color = f === 'Newline' ? 'Newlıne' : f
      break
    }
  }

  return { measure: measureParts.join(' · '), color }
}

function defaultSalesUnitForLine(template: QuoteTemplateDefinition, line: TemplateLineInput): string {
  if (template.id === 'mobilya') {
    const sub = line.mobilyaSubList || 'mutfak'
    const meta = MOBILYA_SUB_LIST_META.find((m) => m.id === sub)
    return meta?.defaultUnit ?? 'Adet'
  }
  return 'Adet'
}

/** Kod seçilince: kod, birim, miktar (0 ise 1); name’den çıkan ölçü/kapak varsa güncellenir. İskonto listede yok, olduğu gibi kalır. */
export function patchLineFromPriceRow(
  template: QuoteTemplateDefinition,
  line: TemplateLineInput,
  row: QuoteTemplatePriceRow
): Partial<TemplateLineInput> {
  const { measure, color } = hintsFromPriceRowName(row.name)
  const qty = line.qty > 0 ? line.qty : 1
  return {
    code: row.code,
    unit: defaultSalesUnitForLine(template, line),
    qty,
    ...(measure ? { measure } : {}),
    ...(color ? { color } : {}),
  }
}

export function excelNetUnitPrice(listPrice: number, disc1Pct: number, disc2Pct: number): number {
  if (listPrice <= 0) return 0
  const v = listPrice * (1 - (Number(disc1Pct) || 0) / 100) * (1 - (Number(disc2Pct) || 0) / 100)
  return Math.round(v * 100) / 100
}

export interface TemplateLineInput {
  code: string
  /** Mobilya şablonunda gövde; diğerlerinde ölçü */
  measure: string
  color: string
  qty: number
  disc1: number
  disc2: number
  unit: string
  mobilyaSubList?: MobilyaSubListId
  /** Banyo veya listede olmayan satır için */
  manualListPrice: number
  manualLineName: string
}

export interface ComputedTemplateLine extends TemplateLineInput {
  salesUnitName: string
  listPrice: number
  netUnit: number
  lineTotalExVat: number
}

export function computeTemplateLines(template: QuoteTemplateDefinition, lines: TemplateLineInput[]): ComputedTemplateLine[] {
  return lines.map((ln) => {
    const row = ln.code ? lookupPriceRow(template, ln, ln.code) : undefined
    let listPrice = row?.listPrice ?? 0
    let salesUnitName = row?.name ?? ''
    if (template.id === 'mobilya' && ln.mobilyaSubList === 'banyo') {
      if (!row && (Number(ln.manualListPrice) > 0 || ln.manualLineName.trim())) {
        listPrice = Number(ln.manualListPrice) || 0
        salesUnitName = ln.manualLineName.trim() || salesUnitName
      }
    }
    const q = Number(ln.qty) || 0
    const netUnit = q > 0 ? excelNetUnitPrice(listPrice, ln.disc1, ln.disc2) : 0
    const lineTotalExVat = q > 0 ? Math.round(netUnit * q * 100) / 100 : 0
    return {
      ...ln,
      salesUnitName,
      listPrice,
      netUnit,
      lineTotalExVat,
    }
  })
}

export function sumLinesExVat(lines: ComputedTemplateLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.lineTotalExVat, 0) * 100) / 100
}

export function excelGrandTotals(subtotalExVat: number, vatRate = 0.2) {
  const sub = Math.round(subtotalExVat * 100) / 100
  const vat = Math.round(sub * vatRate * 100) / 100
  const grand = Math.round((sub + vat) * 100) / 100
  return { subtotalExVat: sub, vat, grand, vatRate }
}
