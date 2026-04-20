// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Check, Download, Pencil, Plus, Send, Shield, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { CompanyModal } from '@/components/company-modal'
import { DataTable } from '@/components/data-table'
import { RbacGuard } from '@/components/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'
import {
  DEFAULT_COMPANY_COUNTRY_LABEL,
  getAllowedCurrencyCodesForCountry,
  getCompanyCurrencyOptions,
  resolveCompanyCurrency,
} from '@/lib/location-data'
import { cn, formatCurrency, formatDate, formatDateTime, formatExchangeRate, getCurrencyLabel, getCurrencySymbol, normalizeCurrency } from '@/lib/utils'
import { useAppStore } from '@/state/use-app-store'
import type { Product, Quote, SalesDocumentType, SellerCompanyProfile } from '@/types'

const QUOTE_STATUS_TR = {
  Draft: 'Taslak',
  Sent: 'Gönderildi',
  'Under Review': 'İncelemede',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  Converted: 'Siparişe Dönüştü',
}

const DOCUMENT_TYPE_TR = {
  Quote: 'Teklif',
  Contract: 'Sözleşme',
}

const ADD_CUSTOMER_OPTION = '__add_company__'
const DOCUMENT_CURRENCY_OPTIONS = getCompanyCurrencyOptions(DEFAULT_COMPANY_COUNTRY_LABEL)
const DEFAULT_SELLER_COMPANIES: SellerCompanyProfile[] = [
  { key: 'ORTKA', shortName: 'ORTKA', displayName: 'ORTKA', bankAccounts: [], isActive: true, sortOrder: 0 },
  { key: 'AYKA', shortName: 'AYKA', displayName: 'AYKA', bankAccounts: [], isActive: true, sortOrder: 1 },
]

const SECTION_OPTIONS = [
  { value: 'steel_door', label: 'Çelik Kapı' },
  { value: 'interior_door', label: 'İç Oda Kapısı' },
  { value: 'kitchen', label: 'Mutfak' },
  { value: 'wardrobe', label: 'Portmanto / Dolap' },
  { value: 'bathroom', label: 'Banyo' },
  { value: 'accessory', label: 'Aksesuar' },
  { value: 'laminate', label: 'Laminant' },
  { value: 'service', label: 'Montaj / Hizmet' },
]

const TEMPLATE_OPTIONS = {
  Quote: [
    { value: '', label: 'Otomatik' },
    { value: 'quote_steel', label: 'Teklif / Çelik Grubu' },
    { value: 'quote_interior', label: 'Teklif / İç Oda Grubu' },
    { value: 'quote_furniture', label: 'Teklif / Mobilya Grubu' },
    { value: 'quote_service', label: 'Teklif / Montaj Grubu' },
  ],
  Contract: [
    { value: '', label: 'Otomatik' },
    { value: 'contract_steel', label: 'Sözleşme / Çelik Grubu' },
    { value: 'contract_interior', label: 'Sözleşme / İç Oda Grubu' },
    { value: 'contract_furniture', label: 'Sözleşme / Mobilya Grubu' },
    { value: 'contract_service', label: 'Sözleşme / Montaj Grubu' },
    { value: 'contract_ck_ik_mob_montajli', label: 'Sözleşme / CK + İK + MOB + Montaj' },
    { value: 'contract_ck_ik_montajli', label: 'Sözleşme / CK + İK + Montaj' },
    { value: 'contract_ck_ik_montajsiz', label: 'Sözleşme / CK + İK' },
  ],
}

const DEFAULT_TERMS_TEXT = [
  '1- Alıcı özellikleri belirtilen ürünlerin satın alma şartlarını kabul eder.',
  '2- Satıcı onaylanan kalemlerin üretimini ve sevkini kabul eder.',
  '3- Onay sonrası teknik ve finansal değişiklikler yeni mutabakat gerektirir.',
  '4- Ödemesi tamamlanmayan siparişler üretime alınmayabilir.',
  '5- Mücbir sebepler kaynaklı gecikmelerde satıcı sorumlu tutulamaz.',
  '6- Teslimden sonra yazılı bildirim gelmezse ürünler eksiksiz kabul edilir.',
  '7- Alıcı gerekli vergi ve yetki belgelerini eksiksiz sunar.',
  '8- İmalat hataları garanti koşulları ve teknik şartname kapsamındadır.',
  '9- İhtilaflarda Malatya Mahkemeleri ve İcra Daireleri yetkilidir.',
].join('\n')

const DEFAULT_CONTRACT_NOTES_TEXT = [
  'Ölçüler net ölçü üzerinden değerlendirilmiştir.',
  'Üretim öncesi teyit alınacaktır.',
].join('\n')

const lineSchema = z.object({
  mode: z.enum(['product', 'manual']).default('product'),
  productId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(1),
  sectionKey: z.string().min(1),
  unit: z.string().min(1),
  qty: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).max(50),
  discountSecondary: z.coerce.number().min(0).max(50).default(0),
  tax: z.coerce.number().min(0),
  details: z.object({
    code: z.string().optional(),
    primary: z.string().optional(),
    secondary: z.string().optional(),
    attributes: z.record(z.any()).optional().default({}),
  }),
}).superRefine((value, ctx) => {
  const effectiveDiscount = 100 - ((100 - Number(value.discount || 0)) * (100 - Number(value.discountSecondary || 0))) / 100
  if (effectiveDiscount > 50) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'İki iskonto birlikte en fazla %50 etkin iskonto oluşturabilir.', path: ['discountSecondary'] })
})

const documentSchema = z.object({
  customerId: z.string().min(1),
  preparedById: z.string().optional(),
  sellerCompanyKey: z.string().optional(),
  currency: z.enum(['TRY', 'USD', 'EUR']).default('TRY'),
  exchangeRate: z.coerce.number().positive().optional(),
  templateKey: z.string().optional(),
  contractDate: z.string().optional(),
  validUntil: z.string().min(1, 'Geçerlilik tarihi zorunludur.'),
  validityLabel: z.string().optional(),
  priceListLabel: z.string().optional(),
  payment: z.string().optional(),
  paymentOption: z.string().optional(),
  delivery: z.string().min(1, 'Teslim tarihi zorunludur.'),
  deliveryType: z.string().optional(),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  customerTaxOffice: z.string().optional(),
  customerTaxNumber: z.string().optional(),
  customerAddress: z.string().optional(),
  customerAuthorizedPerson: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  signatureCustomerLabel: z.string().optional(),
  termsText: z.string().optional(),
  contractNotesText: z.string().optional(),
  lines: z.array(lineSchema).min(1),
})

const quoteStatusTr = (status: string) => QUOTE_STATUS_TR[status] ?? status
const sectionLabel = (sectionKey?: string) => SECTION_OPTIONS.find((item) => item.value === sectionKey)?.label ?? sectionKey ?? 'Genel'
const templateLabel = (documentType: SalesDocumentType, templateKey?: string) => TEMPLATE_OPTIONS[documentType].find((item) => item.value === (templateKey || ''))?.label ?? 'Otomatik'
const getResolvedSchema = (product?: Product) => product?.resolvedAttributeSchema || product?.categoryAttributeSchema || []
const getTermsText = (config?: any) => config?.termsText || config?.terms_text || (config?.generalTerms || config?.general_terms || []).join('\n') || ''
const getContractNotesText = (config?: any) => config?.contractNotesText || config?.contract_notes_text || (config?.contractNotes || config?.contract_notes || []).join('\n') || ''
const getDocumentCurrency = (currency?: string) => normalizeCurrency(currency)
const getDocumentExchangeRate = (currency?: string, exchangeRate?: number | string | null) => {
  const normalizedCurrency = getDocumentCurrency(currency)
  const normalizedRate = Number(exchangeRate)
  if (normalizedCurrency === 'TRY') return 1
  return Number.isFinite(normalizedRate) && normalizedRate > 0 ? normalizedRate : 1
}
const formatDocumentAmount = (value: number, currency?: string) => formatCurrency(value, getDocumentCurrency(currency))
const getCurrentUserId = () => {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem('current-user-id') || ''
  } catch {
    return ''
  }
}
const getDefaultPreparerId = (preparers: any[], quote?: Quote) => {
  if (quote?.preparedById) return quote.preparedById
  const currentUserId = getCurrentUserId()
  if (currentUserId && preparers.some((user) => String(user.id) === String(currentUserId))) return currentUserId
  return preparers[0]?.id ?? ''
}

const getPreparerDisplayName = (preparers: any[], preparedById?: string, fallback?: string) => {
  const preparer = preparers.find((user) => String(user.id) === String(preparedById))
  if (preparer?.fullName) return preparer.fullName
  if (preparer?.firstName || preparer?.lastName) return [preparer?.firstName, preparer?.lastName].filter(Boolean).join(' ')
  if (preparer?.username) return preparer.username
  return fallback || ''
}

const getSellerCompanyOptions = (sellerCompanies: SellerCompanyProfile[]) => {
  const activeCompanies = sellerCompanies.filter((company) => company.isActive !== false)
  const source = activeCompanies.length ? activeCompanies : DEFAULT_SELLER_COMPANIES
  return source.map((company) => ({
    value: company.key,
    label: company.shortName || company.displayName || company.key,
    description: company.displayName || company.legalName || company.key,
  }))
}

const getDefaultSellerCompanyKey = (sellerCompanies: SellerCompanyProfile[], quote?: Quote) =>
  quote?.sellerCompanyKey || getSellerCompanyOptions(sellerCompanies)[0]?.value || 'AYKA'

const getSellerCompanyLabel = (sellerCompanies: SellerCompanyProfile[], key?: string) =>
  getSellerCompanyOptions(sellerCompanies).find((company) => company.value === key)?.label || key || '-'

const normalizeDateInputValue = (value?: string | null) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const isoPrefix = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix) return isoPrefix[1]

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const pad = (part: number) => String(part).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

const buildLineFromProduct = (product?: Product, previousLine?: any) => {
  const defaults = product?.templateDefaults || {}
  const categoryDefaults = product?.categoryTemplateDefaults || {}
  const sectionKey = defaults.section_key || categoryDefaults.section_key || previousLine?.sectionKey || 'steel_door'

  return {
    mode: product ? 'product' : 'manual',
    productId: product?.id,
    sku: product?.sku || previousLine?.sku || '',
    name: previousLine?.name || product?.name || 'Yeni kalem',
    sectionKey,
    unit: previousLine?.unit || defaults.unit || categoryDefaults.unit || 'Adet',
    qty: previousLine?.qty ?? 1,
    unitPrice: previousLine?.unitPrice ?? product?.price ?? 0,
    discount: previousLine?.discount ?? Number(defaults.discount ?? categoryDefaults.discount ?? 0),
    discountSecondary: previousLine?.discountSecondary ?? Number(defaults.discount_secondary ?? categoryDefaults.discount_secondary ?? 0),
    tax: previousLine?.tax ?? Number(defaults.tax ?? categoryDefaults.tax ?? 20),
    details: {
      code: previousLine?.details?.code || product?.sku || '',
      primary: previousLine?.details?.primary || defaults.primary || '',
      secondary: previousLine?.details?.secondary || defaults.secondary || '',
      attributes: previousLine?.details?.attributes || product?.attributeValues || {},
    },
  }
}

const createEmptyLine = () => buildLineFromProduct(undefined, { mode: 'manual', name: 'Yeni kalem', sectionKey: 'steel_door', unit: 'Adet', qty: 1, unitPrice: 0, discount: 0, discountSecondary: 0, tax: 20, details: { code: '', primary: '', secondary: '', attributes: {} } })

const buildLineForSelectedProduct = (product?: Product, previousLine?: any) =>
  buildLineFromProduct(product, {
    ...previousLine,
    mode: 'product',
    productId: undefined,
    sku: '',
    name: undefined,
    sectionKey: undefined,
    unit: undefined,
    unitPrice: undefined,
    discount: undefined,
    discountSecondary: undefined,
    tax: undefined,
    details: {
      code: undefined,
      primary: undefined,
      secondary: undefined,
      attributes: undefined,
    },
  })

const resolveErrorTab = (fieldPath?: string) => {
  if (!fieldPath) return 'document'
  if (fieldPath.startsWith('lines')) return 'lines'
  if (fieldPath.startsWith('customer') || fieldPath === 'customerId') return 'customer'
  return 'document'
}

const collectFirstError = (errors: any, parentPath = ''): { path: string; message: string } | null => {
  if (!errors || typeof errors !== 'object') return null

  for (const [key, value] of Object.entries(errors)) {
    const nextPath = parentPath ? `${parentPath}.${key}` : key
    if (!value) continue
    if (typeof value === 'object' && 'message' in value && typeof value.message === 'string' && value.message) {
      return { path: nextPath, message: value.message }
    }
    const nested = collectFirstError(value, nextPath)
    if (nested) return nested
  }

  return null
}

const getInitialValues = (mode: SalesDocumentType, companies: any[], preparers: any[], products: Product[], sellerCompanies: SellerCompanyProfile[], quote?: Quote) => {
  const customerSnapshot = quote?.contractConfig?.customerSnapshot || quote?.contractConfig?.customer_snapshot || {}
  const company = companies.find((item) => item.id === quote?.customerId) || companies[0]
  const preferredCurrency = resolveCompanyCurrency(company?.currency, company?.country)
  const initialCurrency = getDocumentCurrency(quote?.currency || preferredCurrency)

  return {
    customerId: quote?.customerId || company?.id || '',
    preparedById: getDefaultPreparerId(preparers, quote),
    sellerCompanyKey: getDefaultSellerCompanyKey(sellerCompanies, quote),
    currency: initialCurrency,
    exchangeRate: getDocumentExchangeRate(initialCurrency, quote?.contractConfig?.exchangeRate || quote?.contractConfig?.exchange_rate),
    templateKey: quote?.contractConfig?.templateKey || quote?.contractConfig?.template_key || '',
      contractDate:
        normalizeDateInputValue(quote?.contractConfig?.contractDate || quote?.contractConfig?.contract_date) ||
        normalizeDateInputValue(quote?.createdAt) ||
        new Date().toISOString().slice(0, 10),
      validUntil: normalizeDateInputValue(quote?.validUntil),
    validityLabel: '',
    priceListLabel: quote?.contractConfig?.priceListLabel || quote?.contractConfig?.price_list_label || '2026/1. LİSTE',
    payment: quote?.terms?.payment || '',
    paymentOption: quote?.contractConfig?.paymentOption || quote?.contractConfig?.payment_option || '',
      delivery: normalizeDateInputValue(quote?.terms?.delivery),
    deliveryType: quote?.contractConfig?.deliveryType || quote?.contractConfig?.delivery_type || '',
    notes: quote?.terms?.notes || '',
    customerName: customerSnapshot.name || company?.name || '',
    customerTaxOffice: customerSnapshot.tax_office || customerSnapshot.taxOffice || company?.taxOffice || '',
    customerTaxNumber: customerSnapshot.tax_number || customerSnapshot.taxNumber || company?.taxNumber || '',
    customerAddress: customerSnapshot.address || company?.address || '',
    customerAuthorizedPerson: customerSnapshot.authorized_person || customerSnapshot.authorizedPerson || company?.authorizedPerson || '',
    customerPhone: customerSnapshot.phone || company?.phone || '',
    customerEmail: customerSnapshot.email || company?.email || '',
    signatureCustomerLabel: quote?.contractConfig?.signatureCustomerLabel || quote?.contractConfig?.signature_customer_label || customerSnapshot.name || company?.name || '',
    termsText: getTermsText(quote?.contractConfig) || DEFAULT_TERMS_TEXT,
    contractNotesText: getContractNotesText(quote?.contractConfig) || DEFAULT_CONTRACT_NOTES_TEXT,
    lines:
      quote?.lines?.length
        ? quote.lines.map((line) => ({
            mode: line.productId ? 'product' : 'manual',
            productId: line.productId,
            sku: line.sku || line.details?.code || '',
            name: line.name || 'Yeni kalem',
            sectionKey: line.sectionKey || 'steel_door',
            unit: line.unit || 'Adet',
            qty: Number(line.qty ?? 0),
            unitPrice: Number(line.unitPrice ?? 0),
            discount: Number(line.discount ?? 0),
            discountSecondary: Number(line.discountSecondary ?? 0),
            tax: Number(line.tax ?? 0),
            details: {
              code: line.details?.code || line.sku || '',
              primary: line.details?.primary || '',
              secondary: line.details?.secondary || '',
              attributes: line.details?.attributes || {},
            },
          }))
        : [products[0] ? buildLineFromProduct(products[0]) : createEmptyLine()],
  }
}

const buildDocumentPayload = (values: any, mode: SalesDocumentType, status = 'Draft') => ({
  documentType: mode,
  customerId: values.customerId,
  preparedById: values.preparedById,
  sellerCompanyKey: values.sellerCompanyKey,
  currency: getDocumentCurrency(values.currency),
  status,
  validUntil: values.validUntil || '',
  payment: values.payment || '',
  delivery: values.delivery || '',
  notes: values.notes || '',
  contractConfig: {
    templateMode: values.templateKey ? 'manual' : 'auto',
    templateKey: values.templateKey || '',
    contractDate: values.contractDate,
    validityLabel: '',
    priceListLabel: values.priceListLabel,
    exchangeRate: getDocumentExchangeRate(values.currency, values.exchangeRate),
    deliveryType: values.deliveryType,
    paymentOption: values.paymentOption,
    signatureCustomerLabel: values.signatureCustomerLabel,
    customerSnapshot: {
      name: values.customerName || '',
      tax_office: values.customerTaxOffice || '',
      tax_number: values.customerTaxNumber || '',
      address: values.customerAddress || '',
      authorized_person: values.customerAuthorizedPerson || '',
      phone: values.customerPhone || '',
      email: values.customerEmail || '',
    },
    termsText: values.termsText || '',
    contractNotesText: values.contractNotesText || '',
  },
  lines: values.lines.map((line: any, index: number) => ({
    productId: line.mode === 'product' ? line.productId : undefined,
    sku: line.details?.code || line.sku,
    name: line.name,
    sectionKey: line.sectionKey,
    unit: line.unit,
    qty: Number(line.qty || 0),
    unitPrice: Number(line.unitPrice || 0),
    discount: Number(line.discount || 0),
    discountSecondary: Number(line.discountSecondary || 0),
    tax: Number(line.tax || 0),
    sortOrder: index,
    details: line.details,
  })),
})

type QuoteAuditLogItem = {
  id: string
  action: string
  field: string
  old_value: string
  new_value: string
  created_at: string
  user?: string | number
  user_name?: string
}

type AuditChangeDetail = {
  id: string
  label: string
  fieldKey: string
  oldValue: any
  newValue: any
  kind: 'scalar' | 'array' | 'object' | 'lines'
}

type AuditChangeGroup = {
  id: string
  action: string
  createdAt: string
  userLabel: string
  details: AuditChangeDetail[]
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  action: 'İşlem',
  address: 'Adres',
  authorized_person: 'Yetkili',
  code: 'Ürün kodu',
  contract_config: 'Belge ayarları',
  contract_date: 'Belge tarihi',
  contract_notes: 'Sözleşme notları',
  contract_notes_text: 'Sözleşme notları',
  country: 'Ülke',
  created_at: 'Oluşturulma',
  currency: 'Para birimi',
  customer: 'Müşteri',
  customer_snapshot: 'Müşteri bilgisi',
  delivery_terms: 'Teslim metni',
  delivery_type: 'Teslim tipi',
  details: 'Detaylar',
  discount: 'İskonto 1',
  discount_secondary: 'İskonto 2',
  document_type: 'Belge türü',
  email: 'E-posta',
  exchange_rate: 'Kur',
  general_terms: 'Maddeler',
  lines: 'Kalemler',
  name: 'Ad',
  notes: 'Notlar',
  payment_option: 'Ödeme tipi',
  payment_terms: 'Ödeme metni',
  phone: 'Telefon',
  prepared_by: 'Hazırlayan',
  prepared_by_snapshot: 'Hazırlayan bilgisi',
  price_list_label: 'Fiyat listesi etiketi',
  primary: 'Detay 1',
  qty: 'Miktar',
  section_key: 'Grup',
  seller_company_key: 'Satıcı firma',
  secondary: 'Detay 2',
  signature_customer_label: 'İmza etiketi',
  status: 'Durum',
  subtotal: 'Ara toplam',
  tax: 'KDV',
  tax_number: 'Vergi no',
  tax_office: 'Vergi dairesi',
  tax_total: 'Vergi toplamı',
  template_key: 'Şablon',
  template_mode: 'Şablon modu',
  terms_text: 'Maddeler',
  total: 'Genel toplam',
  unit: 'Birim',
  unit_price: 'Birim fiyat',
  valid_until: 'Geçerlilik tarihi',
  validity_label: 'Geçerlilik etiketi',
  vat_rate: 'KDV oranı',
}

const IGNORED_AUDIT_FIELDS = new Set(['updated_at', 'organization'])

const isPlainObject = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const tryParseAuditValue = (raw: unknown) => {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string') return raw

  const trimmed = raw.trim()
  if (!trimmed) return null

  const candidates = [trimmed]
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.includes("'")) {
    candidates.push(trimmed.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/'/g, '"'))
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // noop
    }
  }

  if (trimmed === 'None') return null
  if (trimmed === 'True') return true
  if (trimmed === 'False') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return raw
}

const areAuditValuesEqual = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

const getAuditFieldLabel = (key: string) => AUDIT_FIELD_LABELS[key] || key.replaceAll('_', ' ')

const resolveAuditUserLabel = (item: QuoteAuditLogItem, users: any[]) => {
  if (item.user_name) return item.user_name
  const matchedUser = users.find((user) => String(user.id) === String(item.user))
  return matchedUser?.fullName || matchedUser?.username || 'Sistem'
}

const flattenAuditObjectEntries = (rootField: string, oldValue: any, newValue: any, path: string[] = []): AuditChangeDetail[] => {
  const oldSource = isPlainObject(oldValue) ? oldValue : {}
  const newSource = isPlainObject(newValue) ? newValue : {}
  const keys = Array.from(new Set([...Object.keys(oldSource), ...Object.keys(newSource)]))
  const details: AuditChangeDetail[] = []

  keys.forEach((key) => {
    const previousValue = oldSource[key]
    const nextValue = newSource[key]
    if (areAuditValuesEqual(previousValue, nextValue)) return

    const nextPath = [...path, key]
    if (isPlainObject(previousValue) || isPlainObject(nextValue)) {
      const nestedEntries = flattenAuditObjectEntries(rootField, previousValue, nextValue, nextPath)
      if (nestedEntries.length) {
        details.push(...nestedEntries)
        return
      }
    }

    details.push({
      id: `${rootField}-${nextPath.join('.')}`,
      label: nextPath.map((segment) => getAuditFieldLabel(segment)).join(' / '),
      fieldKey: `${rootField}.${nextPath.join('.')}`,
      oldValue: previousValue,
      newValue: nextValue,
      kind: Array.isArray(previousValue) || Array.isArray(nextValue) ? 'array' : isPlainObject(previousValue) || isPlainObject(nextValue) ? 'object' : 'scalar',
    })
  })

  return details
}

const buildAuditChangeDetails = (items: QuoteAuditLogItem[]) =>
  items.flatMap((item) => {
    if (!item.field || IGNORED_AUDIT_FIELDS.has(item.field)) return []

    const oldValue = tryParseAuditValue(item.old_value)
    const newValue = tryParseAuditValue(item.new_value)

    if (item.field === 'lines') {
      return [
        {
          id: item.id,
          label: getAuditFieldLabel(item.field),
          fieldKey: item.field,
          oldValue,
          newValue,
          kind: 'lines' as const,
        },
      ]
    }

    if (isPlainObject(oldValue) || isPlainObject(newValue)) {
      const flattenedEntries = flattenAuditObjectEntries(item.field, oldValue, newValue)
      if (flattenedEntries.length) return flattenedEntries
    }

    return [
      {
        id: item.id,
        label: getAuditFieldLabel(item.field),
        fieldKey: item.field,
        oldValue,
        newValue,
        kind: Array.isArray(oldValue) || Array.isArray(newValue) ? 'array' : isPlainObject(oldValue) || isPlainObject(newValue) ? 'object' : 'scalar',
      },
    ]
  })

const isSameAuditEvent = (left: QuoteAuditLogItem, right: QuoteAuditLogItem, leftUserLabel: string, rightUserLabel: string) =>
  left.action === right.action &&
  leftUserLabel === rightUserLabel &&
  Math.abs(new Date(left.created_at).getTime() - new Date(right.created_at).getTime()) < 2000

const buildAuditChangeGroups = (logs: QuoteAuditLogItem[], users: any[]): AuditChangeGroup[] => {
  const sortedLogs = [...logs]
    .map((item) => ({ ...item, userLabel: resolveAuditUserLabel(item, users) }))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())

  const dedupedLogs = sortedLogs.filter((item, index, collection) =>
    collection.findIndex((candidate) =>
      candidate.action === item.action &&
      candidate.field === item.field &&
      candidate.old_value === item.old_value &&
      candidate.new_value === item.new_value &&
      candidate.userLabel === item.userLabel &&
      Math.abs(new Date(candidate.created_at).getTime() - new Date(item.created_at).getTime()) < 2000
    ) === index
  )

  const groups: { id: string; action: string; createdAt: string; userLabel: string; items: QuoteAuditLogItem[] }[] = []

  dedupedLogs.forEach((item) => {
    const previousGroup = groups.at(-1)
    if (previousGroup && isSameAuditEvent(previousGroup.items[0], item, previousGroup.userLabel, item.userLabel)) {
      previousGroup.items.push(item)
      return
    }

    groups.push({
      id: item.id,
      action: item.action,
      createdAt: item.created_at,
      userLabel: item.userLabel,
      items: [item],
    })
  })

  return groups.map((group) => ({
    id: group.id,
    action: group.action,
    createdAt: group.createdAt,
    userLabel: group.userLabel,
    details: buildAuditChangeDetails(group.items),
  }))
}

const getAuditActionMeta = (action: string) => {
  if (action === 'created') return { label: 'Belge oluşturuldu', variant: 'success', description: 'Belge ilk kez oluşturuldu.' }
  if (action === 'updated') return { label: 'Belge güncellendi', variant: 'outline', description: 'Belge üzerinde alan bazlı değişiklik yapıldı.' }
  if (action === 'deleted') return { label: 'Belge silindi', variant: 'destructive', description: 'Belge kalıcı olarak silindi.' }
  if (action === 'sent') return { label: 'Gönderildi', variant: 'secondary', description: 'Belge gönderildi olarak işaretlendi.' }
  if (action === 'converted') return { label: 'Satış siparişine dönüştürüldü', variant: 'warning', description: 'Belge satış siparişine çevrildi.' }
  if (action === 'request_approval') return { label: 'Onaya gönderildi', variant: 'warning', description: 'Belge onay sürecine alındı.' }
  if (action === 'resubmitted') return { label: 'Yeniden gönderildi', variant: 'warning', description: 'Belge onay sürecine yeniden gönderildi.' }
  if (action.startsWith('approved_')) return { label: `${action.replace('approved_', '')} onayı verildi`, variant: 'success', description: 'Belge için onay adımı tamamlandı.' }
  if (action.startsWith('rejected_')) return { label: `${action.replace('rejected_', '')} tarafından reddedildi`, variant: 'destructive', description: 'Belge onay sürecinde reddedildi.' }
  return { label: action.replaceAll('_', ' '), variant: 'muted', description: 'Bu kayıt için audit girdisi oluşturuldu.' }
}

const getAuditSummaryText = (details: AuditChangeDetail[], companies: any[], users: any[], currency = 'TRY') => {
  if (details.length === 0) return ''

  const summaryItems = details.slice(0, 3).map((detail) => {
    const previous = formatAuditValue(detail.fieldKey, detail.oldValue, companies, users, currency)
    const next = formatAuditValue(detail.fieldKey, detail.newValue, companies, users, currency)
    return `${detail.label}: ${previous} -> ${next}`
  })

  if (details.length > 3) summaryItems.push(`+${details.length - 3} değişiklik daha`)
  return summaryItems.join(' • ')
}

const getQuoteStatusBadgeVariant = (status: string) => {
  if (status === 'Approved' || status === 'Converted') return 'success'
  if (status === 'Rejected') return 'destructive'
  if (status === 'Under Review') return 'warning'
  return 'secondary'
}

const isEmptyAuditValue = (value: any) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0)

const formatAuditValue = (fieldKey: string, value: any, companies: any[], users: any[], currency = 'TRY') => {
  if (value === undefined || value === null || value === '') return 'Boş'

  const normalizedFieldKey = fieldKey.split('.').at(-1) || fieldKey

  if (normalizedFieldKey === 'status') return quoteStatusTr(String(value))
  if (normalizedFieldKey === 'document_type') return DOCUMENT_TYPE_TR[String(value) as SalesDocumentType] || String(value)
  if (normalizedFieldKey === 'currency') return `${getCurrencySymbol(String(value))} ${getCurrencyLabel(String(value))}`
  if (normalizedFieldKey === 'customer') return companies.find((company) => String(company.id) === String(value))?.name || String(value)
  if (normalizedFieldKey === 'prepared_by') return users.find((user) => String(user.id) === String(value))?.fullName || users.find((user) => String(user.id) === String(value))?.username || String(value)
  if (normalizedFieldKey === 'exchange_rate' && !Number.isNaN(Number(value))) return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value))
  if (['valid_until', 'contract_date', 'created_at'].includes(normalizedFieldKey) && typeof value === 'string') return normalizedFieldKey === 'created_at' ? formatDateTime(value) : formatDate(value)
  if (['subtotal', 'discount_total', 'tax_total', 'total', 'unit_price'].includes(normalizedFieldKey) && !Number.isNaN(Number(value))) return formatCurrency(Number(value), currency)
  if (['discount', 'discount_secondary', 'tax', 'vat_rate'].includes(normalizedFieldKey) && !Number.isNaN(Number(value))) return `%${Number(value)}`
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır'
  if (Array.isArray(value)) return `${value.length} kayıt`
  if (isPlainObject(value)) return 'Detaylı içerik'
  return String(value)
}

const getLineBase = (line: any) => Number(line.qty || 0) * Number(line.unitPrice || 0)
const getLineDiscountedBase = (line: any) => {
  const base = getLineBase(line)
  const afterFirstDiscount = base * (1 - Number(line.discount || 0) / 100)
  return afterFirstDiscount * (1 - Number(line.discountSecondary || 0) / 100)
}
const getLineDiscountTotal = (line: any) => getLineBase(line) - getLineDiscountedBase(line)
const getEffectiveDiscountRate = (line: any) => 100 - ((100 - Number(line.discount || 0)) * (100 - Number(line.discountSecondary || 0))) / 100

const buildCsv = (quotes: Quote[]) =>
  quotes
    .map((quote) =>
      [
        DOCUMENT_TYPE_TR[quote.documentType],
        quote.number,
        quote.customerName || quote.customerId,
        quote.preparedByName || quote.owner,
        formatDateTime(quote.createdAt),
        quoteStatusTr(quote.status),
        quote.validUntil,
        getCurrencySymbol(quote.currency),
        quote.contractConfig?.exchangeRate || quote.contractConfig?.exchange_rate || '',
        quote.total,
      ].join(',')
    )
    .join('\n')

async function downloadDocument(quoteId: string) {
  const manifestResponse = await api.get(`/quotes/${quoteId}/export-files/`)
  const files = manifestResponse.data?.files || []
  if (!files.length) throw new Error('Bu belge için uygun indirme şablonu bulunamadı')

  for (const file of files) {
    const response = await api.get(`/quotes/${quoteId}/export-xlsx/`, {
      params: {
        ...(file.template_key ? { template_key: file.template_key } : {}),
        _ts: Date.now(),
      },
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename || `document-${quoteId}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }
}

function NumericEditor({ value, onValueChange, min = 0, max }: { value?: number; onValueChange: (value: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState(value === undefined || value === null ? '' : String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(value === undefined || value === null ? '' : String(value))
  }, [value, focused])

  const clamp = (nextValue: number) => {
    let normalized = Number.isFinite(nextValue) ? nextValue : min
    if (normalized < min) normalized = min
    if (max !== undefined && normalized > max) normalized = max
    return normalized
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={(event) => {
        setFocused(true)
        requestAnimationFrame(() => event.target.select())
      }}
      onBlur={() => {
        setFocused(false)
        if (draft === '' || draft === '-' || draft === '.' || draft === '-.') {
          const fallback = clamp(0)
          onValueChange(fallback)
          setDraft(String(fallback))
          return
        }
        const normalized = clamp(Number(String(draft).replace(',', '.')))
        onValueChange(normalized)
        setDraft(String(normalized))
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(',', '.')
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
          setDraft(raw)
          if (raw === '') onValueChange(clamp(0))
          return
        }
        const nextValue = Number(raw)
        if (Number.isNaN(nextValue)) {
          setDraft(raw)
          return
        }
        const normalized = clamp(nextValue)
        setDraft(raw)
        onValueChange(normalized)
      }}
    />
  )
}

export function QuotesPage() {
  const { data, deleteQuotes, convertQuote } = useAppStore()
  const { toast } = useToast()
  const [status, setStatus] = useState('all')
  const [customer, setCustomer] = useState('all')
  const [documentType, setDocumentType] = useState<'all' | SalesDocumentType>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const quotes = data.quotes ?? []
  const companies = data.companies

  const filtered = useMemo(
    () =>
      quotes.filter((quote) => {
        const matchesStatus = status === 'all' || quote.status === status
        const matchesCustomer = customer === 'all' || quote.customerId === customer
        const matchesType = documentType === 'all' || quote.documentType === documentType
        const matchesMin = !minAmount || quote.total >= Number(minAmount)
        const matchesMax = !maxAmount || quote.total <= Number(maxAmount)
        return matchesStatus && matchesCustomer && matchesType && matchesMin && matchesMax
      }),
    [quotes, status, customer, documentType, minAmount, maxAmount]
  )

  const hasActiveFilters = documentType !== 'all' || status !== 'all' || customer !== 'all' || Boolean(minAmount) || Boolean(maxAmount)

  const handleDownload = async (quote: Quote) => {
    try {
      await downloadDocument(quote.id)
      toast({ title: `${DOCUMENT_TYPE_TR[quote.documentType]} dosyaları indirildi` })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || error?.message || 'Dosya oluşturulamadı', variant: 'destructive' })
    }
  }

  const handleDelete = async (quote: Quote) => {
    if (!confirm(`${DOCUMENT_TYPE_TR[quote.documentType]} ${quote.number} kaydı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return

    setDeletingId(quote.id)
    try {
      await deleteQuotes([quote.id])
      toast({ title: `${DOCUMENT_TYPE_TR[quote.documentType]} silindi` })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Silme sırasında hata oluştu', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleConvert = async (quote: Quote) => {
    try {
      await convertQuote(quote.id)
      toast({ title: 'Teklif sözleşmeye dönüştürüldü' })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Sözleşmeye dönüştürme sırasında hata oluştu', variant: 'destructive' })
    }
  }

  const columns: ColumnDef<Quote>[] = [
    { accessorKey: 'documentType', header: 'Tür', cell: ({ row }) => <Badge variant="outline">{DOCUMENT_TYPE_TR[row.original.documentType]}</Badge> },
    { accessorKey: 'number', header: 'No' },
    { accessorKey: 'createdAt', header: 'Oluşturulma', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { accessorKey: 'customerId', header: 'Müşteri', cell: ({ row }) => row.original.customerName || companies.find((company) => company.id === row.original.customerId)?.name || '' },
    { accessorKey: 'preparedByName', header: 'Hazırlayan', cell: ({ row }) => row.original.preparedByName || row.original.owner },
    { accessorKey: 'total', header: 'Tutar', cell: ({ row }) => formatCurrency(row.original.total, row.original.currency) },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{quoteStatusTr(row.original.status)}</Badge> },
    { accessorKey: 'validUntil', header: 'Geçerlilik', cell: ({ row }) => formatDate(row.original.validUntil) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Link to="/crm/quotes/$quoteId" params={{ quoteId: row.original.id }} className="text-xs text-primary underline">
            Görüntüle
          </Link>
          <RbacGuard perm="quotes.edit">
            <DocumentWizardTrigger
              quote={row.original}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Düzenle
                </Button>
              }
            />
          </RbacGuard>
          <Button variant="ghost" size="sm" onClick={() => handleDownload(row.original)}>
            <Download className="mr-2 h-4 w-4" />
            İndir
          </Button>
          {row.original.documentType === 'Quote' ? (
            <RbacGuard perm="quotes.edit">
              <Button variant="ghost" size="sm" onClick={() => handleConvert(row.original)}>
                <Check className="mr-2 h-4 w-4" />
                Sözleşmeye dönüştür
              </Button>
            </RbacGuard>
          ) : null}
          <RbacGuard perm="quotes.edit">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deletingId === row.original.id}
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </RbacGuard>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teklif ve Sözleşme Yönetimi"
        description="Teklif ve sözleşme oluşturma, durum takibi, detay görüntüleme ve belge indirme"
        actions={
          <div className="flex gap-2">
            <RbacGuard perm="quotes.edit">
              <DocumentWizardTrigger mode="Contract" />
            </RbacGuard>
            <RbacGuard perm="quotes.edit">
              <DocumentWizardTrigger mode="Quote" />
            </RbacGuard>
            <RbacGuard perm="quotes.view">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([buildCsv(filtered)], { type: 'text/csv;charset=utf-8;' })
                  const link = document.createElement('a')
                  link.href = URL.createObjectURL(blob)
                  link.download = 'documents.csv'
                  link.click()
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Dışa aktar (CSV)
              </Button>
            </RbacGuard>
          </div>
        }
      />


      <div className="grid gap-3 rounded-xl border border-border/70 bg-card/40 p-4 md:grid-cols-2 xl:grid-cols-[220px_220px_minmax(280px,1fr)_140px_140px_auto]">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Belge tipi</Label>
          <Select value={documentType} onValueChange={(value) => setDocumentType(value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Teklif / Sözleşme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Teklif / Sözleşme</SelectItem>
              <SelectItem value="Quote">Sadece teklifler</SelectItem>
              <SelectItem value="Contract">Sadece sözleşmeler</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Durum</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Tüm durumlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              {['Draft', 'Sent', 'Under Review', 'Approved', 'Rejected', 'Converted'].map((item) => <SelectItem key={item} value={item}>{quoteStatusTr(item)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cari</Label>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger>
              <SelectValue placeholder="Tüm cariler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm cariler</SelectItem>
              {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Min. tutar</Label>
          <Input placeholder="Alt limit" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} inputMode="numeric" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Maks. tutar</Label>
          <Input placeholder="Üst limit" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} inputMode="numeric" />
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full xl:w-auto"
            disabled={!hasActiveFilters}
            onClick={() => {
              setDocumentType('all')
              setStatus('all')
              setCustomer('all')
              setMinAmount('')
              setMaxAmount('')
            }}
          >
            Filtreleri temizle
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <DataTable
            columns={[{ id: 'select', header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))} />, cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(Boolean(value))} />, size: 32 }, ...columns]}
            data={filtered}
            onExport={(rows) => {
              const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' })
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = 'documents.csv'
              link.click()
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentWizardTrigger({ mode = 'Quote', quote, trigger }: { mode?: SalesDocumentType; quote?: Quote; trigger?: React.ReactNode }) {
  const { data, createCompany, createQuote, updateQuote } = useAppStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('customer')
  const companies = data.companies
  const sellerCompanies = data.sellerCompanies || []
  const products = data.products
  const preparers = useMemo(() => data.users.filter((user) => user.canPrepareQuotes || user.permissions?.includes('quotes.prepare')), [data.users])
  const sellerOptions = useMemo(() => getSellerCompanyOptions(sellerCompanies), [sellerCompanies])
  const documentMode = quote?.documentType ?? mode
  const isEditing = Boolean(quote)
  const getFormDefaults = () => getInitialValues(documentMode, companies, preparers, products, sellerCompanies, quote)
  const form = useForm({ resolver: zodResolver(documentSchema) as any, defaultValues: getFormDefaults() })
  const preparedById = form.watch('preparedById')
  const preparedByDisplayName = getPreparerDisplayName(preparers, preparedById, quote?.preparedByName || quote?.owner)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setActiveTab('customer')
      form.reset(getFormDefaults())
    }
  }

  const selectedCustomer = companies.find((company) => company.id === form.watch('customerId'))
  const selectedCustomerCurrencyOptions = useMemo(
    () => (selectedCustomer ? getCompanyCurrencyOptions(selectedCustomer.country) : DOCUMENT_CURRENCY_OPTIONS),
    [selectedCustomer?.country]
  )
  const selectedCustomerAllowedCurrencies = useMemo(
    () => (selectedCustomer ? getAllowedCurrencyCodesForCountry(selectedCustomer.country) : DOCUMENT_CURRENCY_OPTIONS.map((option) => option.value)),
    [selectedCustomer?.country]
  )
  const lines = form.watch('lines') || []

  const setDocumentCurrency = (nextCurrency: string, options?: { forceExchangeRate?: boolean }) => {
    const normalizedCurrency = normalizeCurrency(nextCurrency)
    const currentRate = Number(form.getValues('exchangeRate') ?? 1)
    form.setValue('currency', normalizedCurrency as any, { shouldDirty: true, shouldValidate: true })

    if (normalizedCurrency === 'TRY') {
      form.setValue('exchangeRate', 1, { shouldDirty: true, shouldValidate: true })
      return
    }

    if (options?.forceExchangeRate || !Number.isFinite(currentRate) || currentRate <= 0) {
      form.setValue('exchangeRate', 1, { shouldDirty: true, shouldValidate: true })
    }
  }

  const applyCustomerToForm = (
    company: any,
    options?: {
      includeCustomerId?: boolean
      forcePreferredCurrency?: boolean
    }
  ) => {
    if (!company) return
    if (options?.includeCustomerId) form.setValue('customerId', company.id, { shouldDirty: true, shouldValidate: true })
    form.setValue('customerName', company.name || '')
    form.setValue('customerTaxOffice', company.taxOffice || '')
    form.setValue('customerTaxNumber', company.taxNumber || '')
    form.setValue('customerAddress', company.address || '')
    form.setValue('customerAuthorizedPerson', company.authorizedPerson || '')
    form.setValue('customerPhone', company.phone || '')
    form.setValue('customerEmail', company.email || '')
    form.setValue('signatureCustomerLabel', company.name || '')

    const preferredCurrency = resolveCompanyCurrency(company.currency, company.country)
    const currentCurrency = getDocumentCurrency(form.getValues('currency'))
    const allowedCurrencies = getAllowedCurrencyCodesForCountry(company.country)
    const nextCurrency =
      options?.forcePreferredCurrency || !allowedCurrencies.includes(currentCurrency)
        ? preferredCurrency
        : currentCurrency

    setDocumentCurrency(nextCurrency, { forceExchangeRate: options?.forcePreferredCurrency })
  }

  useEffect(() => {
    if (!selectedCustomer) return
    const currentCurrency = getDocumentCurrency(form.getValues('currency'))
    const hasQuoteCustomerChanged = quote ? selectedCustomer.id !== quote.customerId : true
    const needsCurrencyCorrection = !selectedCustomerAllowedCurrencies.includes(currentCurrency)

    applyCustomerToForm(selectedCustomer, {
      forcePreferredCurrency: hasQuoteCustomerChanged || needsCurrencyCorrection,
    })
  }, [quote?.customerId, selectedCustomer?.country, selectedCustomer?.currency, selectedCustomer?.id, selectedCustomerAllowedCurrencies])

  const subtotal = lines.reduce((sum, line) => sum + getLineBase(line), 0)
  const discountTotal = lines.reduce((sum, line) => sum + getLineDiscountTotal(line), 0)
  const taxTotal = lines.reduce((sum, line) => sum + getLineDiscountedBase(line) * (Number(line.tax || 0) / 100), 0)
  const total = subtotal - discountTotal + taxTotal

  const addLine = () => form.setValue('lines', [...lines, createEmptyLine()], { shouldDirty: true })
  const removeLine = (index: number) => form.setValue('lines', lines.filter((_, currentIndex) => currentIndex !== index), { shouldDirty: true })
  const applyProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId)
    form.setValue(`lines.${index}`, buildLineForSelectedProduct(product, lines[index]), { shouldDirty: true, shouldValidate: true })
  }
  const setManualMode = (index: number) => form.setValue(`lines.${index}`, { ...lines[index], mode: 'manual', productId: undefined }, { shouldDirty: true })
  const getDiscountValidationMessage = (nextLines: any[]) => {
    const invalidLineIndex = nextLines.findIndex((line) => getEffectiveDiscountRate(line) > 50)
    return invalidLineIndex >= 0 ? `${invalidLineIndex + 1}. kalemde iki iskonto birlikte en fazla %50 etkin iskonto oluşturabilir.` : null
  }
  const handleCustomerCreate = async (values: any) => {
    const createdCompany = await createCompany(values as any)
    const nextCompany =
      createdCompany ??
      useAppStore
        .getState()
        .data.companies.find(
          (company) =>
            company.name === values.name &&
            (!values.email || company.email === values.email) &&
            (!values.phone || company.phone === values.phone)
        )

    if (nextCompany) applyCustomerToForm(nextCompany, { includeCustomerId: true, forcePreferredCurrency: true })
      toast({ title: 'Cari eklendi' })
  }

  const handleSave = form.handleSubmit(async (values) => {
    const discountValidationMessage = getDiscountValidationMessage(values.lines)
    if (discountValidationMessage) {
      setActiveTab('lines')
      toast({ title: discountValidationMessage, variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = buildDocumentPayload(values, documentMode, quote?.status || 'Draft')
      if (quote) {
        await updateQuote(quote.id, payload as any)
      } else {
        await createQuote(payload as any)
      }
      toast({ title: quote ? `${DOCUMENT_TYPE_TR[documentMode]} güncellendi` : `${DOCUMENT_TYPE_TR[documentMode]} kaydedildi` })
      setOpen(false)
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Kayıt sırasında hata oluştu', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  })

  const handleSaveClick = async () => {
    const isValid = await form.trigger()
    if (!isValid) {
      const firstError = collectFirstError(form.formState.errors)
      setActiveTab(resolveErrorTab(firstError?.path))
      toast({
        title: firstError?.message || 'Lütfen zorunlu alanları kontrol edin.',
        variant: 'destructive',
      })
      return
    }

    handleSave()
  }

  return (
    <>
      <CompanyModal open={customerModalOpen} onOpenChange={setCustomerModalOpen} onSubmit={handleCustomerCreate} />
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={documentMode === 'Contract' ? 'default' : 'outline'}>
            {isEditing ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {isEditing ? `${DOCUMENT_TYPE_TR[documentMode]} düzenle` : documentMode === 'Contract' ? 'Yeni sözleşme' : 'Yeni teklif'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={cn('max-h-[92vh] max-w-[82rem] overflow-y-auto', customerModalOpen && 'pointer-events-none opacity-0')}>
        <DialogHeader><DialogTitle>{isEditing ? `${DOCUMENT_TYPE_TR[documentMode]} düzenle` : documentMode === 'Contract' ? 'Sözleşme oluştur' : 'Teklif oluştur'}</DialogTitle></DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3 grid grid-cols-4">
            <TabsTrigger value="customer">Cariler</TabsTrigger>
            <TabsTrigger value="document">Belge</TabsTrigger>
            <TabsTrigger value="lines">Kalemler</TabsTrigger>
            <TabsTrigger value="review">Özet</TabsTrigger>
          </TabsList>
          <TabsContent value="customer" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Cari seçiniz</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCustomerModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cari ekle
                </Button>
              </div>
              <Select
                value={form.watch('customerId')}
                onValueChange={(value) => {
                  if (value === ADD_CUSTOMER_OPTION) {
                    setCustomerModalOpen(true)
                    return
                  }
                  form.setValue('customerId', value, { shouldDirty: true, shouldValidate: true })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Cari seçiniz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ADD_CUSTOMER_OPTION}>Yeni cari / firma ekle</SelectItem>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Listeden ayrılmadan yeni cari ekleyebilir ve eklediğiniz firmayı anında seçebilirsiniz.</p>
              {selectedCustomer ? (
                <p className="text-xs text-muted-foreground">
                  Varsayılan para birimi: {getCurrencySymbol(resolveCompanyCurrency(selectedCustomer.currency, selectedCustomer.country))}{' '}
                  {getCurrencyLabel(resolveCompanyCurrency(selectedCustomer.currency, selectedCustomer.country))}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Cari ünvanı</Label><Input value={form.watch('customerName') || ''} onChange={(event) => form.setValue('customerName', event.target.value)} /></div>
              <div><Label>Yetkili</Label><Input value={form.watch('customerAuthorizedPerson') || ''} onChange={(event) => form.setValue('customerAuthorizedPerson', event.target.value)} /></div>
              <div><Label>Vergi dairesi</Label><Input value={form.watch('customerTaxOffice') || ''} onChange={(event) => form.setValue('customerTaxOffice', event.target.value)} /></div>
              <div><Label>Vergi no</Label><Input value={form.watch('customerTaxNumber') || ''} onChange={(event) => form.setValue('customerTaxNumber', event.target.value)} /></div>
              <div><Label>Telefon</Label><Input value={form.watch('customerPhone') || ''} onChange={(event) => form.setValue('customerPhone', event.target.value)} /></div>
              <div><Label>E-posta</Label><Input value={form.watch('customerEmail') || ''} onChange={(event) => form.setValue('customerEmail', event.target.value)} /></div>
            </div>
            <div><Label>Adres</Label><Textarea value={form.watch('customerAddress') || ''} onChange={(event) => form.setValue('customerAddress', event.target.value)} /></div>
          </TabsContent>

          <TabsContent value="document" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Hazırlayan</Label><Input value={preparedByDisplayName || '-'} readOnly disabled /></div>
              <div><Label>Satıcı firma</Label><Select value={form.watch('sellerCompanyKey') || getDefaultSellerCompanyKey(sellerCompanies, quote)} onValueChange={(value) => form.setValue('sellerCompanyKey', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sellerOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Para birimi</Label><Select value={form.watch('currency') || 'TRY'} onValueChange={(value) => setDocumentCurrency(value, { forceExchangeRate: value !== form.getValues('currency') })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{selectedCustomerCurrencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">{selectedCustomer && !selectedCustomerAllowedCurrencies.includes('TRY') ? 'Yurt dışı müşterilerde yalnızca dolar veya euro kullanılır.' : 'Seçili müşterinin varsayılan para birimi otomatik doldurulur, isterseniz değiştirebilirsiniz.'}</p></div>
              <div><Label>{`Kur (${getCurrencySymbol(form.watch('currency'))} -> ₺)`}</Label><Input type="number" step="0.0001" min="1" disabled={(form.watch('currency') || 'TRY') === 'TRY'} value={form.watch('exchangeRate') ?? 1} onChange={(event) => form.setValue('exchangeRate', Number(event.target.value || 1), { shouldDirty: true })} /><p className="mt-1 text-xs text-muted-foreground">{(form.watch('currency') || 'TRY') === 'TRY' ? 'Türk Lirası seçildiğinde kur 1 kabul edilir.' : formatExchangeRate(form.watch('exchangeRate'), form.watch('currency'))}</p></div>
              <div><Label>Şablon</Label><Select value={form.watch('templateKey') || '__auto__'} onValueChange={(value) => form.setValue('templateKey', value === '__auto__' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_OPTIONS[documentMode].map((option) => <SelectItem key={option.value || '__auto__'} value={option.value || '__auto__'}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Oluşturulma tarihi</Label><Input type="date" value={form.watch('contractDate') || ''} readOnly disabled /></div>
              <div><Label>Geçerlilik tarihi</Label><Input type="date" value={form.watch('validUntil') || ''} onChange={(event) => form.setValue('validUntil', event.target.value, { shouldDirty: true, shouldValidate: true })} /></div>
              <div><Label>Fiyat listesi etiketi</Label><Input value={form.watch('priceListLabel') || ''} onChange={(event) => form.setValue('priceListLabel', event.target.value)} /></div>
              <div><Label>İmza etiketi</Label><Input value={form.watch('signatureCustomerLabel') || ''} onChange={(event) => form.setValue('signatureCustomerLabel', event.target.value)} /></div>
                <div><Label>Teslim tipi</Label><Input value={form.watch('deliveryType') || ''} onChange={(event) => form.setValue('deliveryType', event.target.value)} /></div>
                <div><Label>Ödeme tipi</Label><Input value={form.watch('paymentOption') || ''} onChange={(event) => form.setValue('paymentOption', event.target.value)} /></div>
                <div><Label>Ödeme metni</Label><Input value={form.watch('payment') || ''} onChange={(event) => form.setValue('payment', event.target.value)} /></div>
                <div><Label>Teslim tarihi</Label><Input type="date" value={form.watch('delivery') || ''} onChange={(event) => form.setValue('delivery', event.target.value, { shouldDirty: true, shouldValidate: true })} /></div>
            </div>
            <div><Label>Notlar</Label><Textarea value={form.watch('notes') || ''} onChange={(event) => form.setValue('notes', event.target.value)} /></div>
            <div><Label>Maddeler</Label><p className="text-xs text-muted-foreground">Her dolu satır bir madde olur. Boşsa Excel&apos;e hiçbir madde eklenmez.</p><Textarea rows={10} value={form.watch('termsText') || ''} onChange={(event) => form.setValue('termsText', event.target.value)} /></div>
            <div><Label>Sözleşme notları</Label><p className="text-xs text-muted-foreground">Her dolu satır sağ blokta sırayla gösterilir. Varsayılan iki not dolu gelir, kalan satırlar boş bırakılır.</p><Textarea rows={6} value={form.watch('contractNotesText') || ''} onChange={(event) => form.setValue('contractNotesText', event.target.value)} /></div>
          </TabsContent>

          <TabsContent value="lines" className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Kalemler</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Kalem ekle</Button>
            </div>
            <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-2">
              {lines.map((line, index) => {
                const selectedProduct = products.find((item) => item.id === line.productId)
                const dynamicSchema = line.mode === 'product' ? getResolvedSchema(selectedProduct) : []
                return (
                  <Card key={`line-${index}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{line.name || `Kalem ${index + 1}`}</CardTitle>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                      <div><Label>Ürün modu</Label><Select value={line.mode || 'manual'} onValueChange={(value) => value === 'manual' ? setManualMode(index) : undefined}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manuel giriş</SelectItem><SelectItem value="product">Listeden seç</SelectItem></SelectContent></Select></div>
                      <div className="md:col-span-2"><Label>Ürün</Label><Select value={line.productId || '__manual__'} onValueChange={(value) => value === '__manual__' ? setManualMode(index) : applyProduct(index, value)}><SelectTrigger><SelectValue placeholder="Ürün seçin" /></SelectTrigger><SelectContent><SelectItem value="__manual__">Manuel giriş</SelectItem>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.sku} - {product.name}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Grup</Label><Select value={line.sectionKey} onValueChange={(value) => form.setValue(`lines.${index}.sectionKey`, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SECTION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Ürün kodu</Label><Input value={line.details?.code || line.sku || ''} onChange={(event) => form.setValue(`lines.${index}.details.code`, event.target.value)} /></div>
                      <div><Label>Birim</Label><Input value={line.unit || ''} onChange={(event) => form.setValue(`lines.${index}.unit`, event.target.value)} /></div>
                      <div className="md:col-span-3"><Label>Açıklama / satış birimi</Label><Input value={line.name} onChange={(event) => form.setValue(`lines.${index}.name`, event.target.value)} /></div>
                      <div><Label>Detay 1</Label><Input value={line.details?.primary || ''} onChange={(event) => form.setValue(`lines.${index}.details.primary`, event.target.value)} /></div>
                      <div><Label>Detay 2</Label><Input value={line.details?.secondary || ''} onChange={(event) => form.setValue(`lines.${index}.details.secondary`, event.target.value)} /></div>
                      <div><Label>Miktar</Label><NumericEditor value={Number(line.qty || 0)} onValueChange={(value) => form.setValue(`lines.${index}.qty`, value)} /></div>
                      <div><Label>{`Birim fiyat (${getCurrencySymbol(form.watch('currency'))})`}</Label><NumericEditor value={Number(line.unitPrice || 0)} onValueChange={(value) => form.setValue(`lines.${index}.unitPrice`, value)} /></div>
                      <div><Label>İskonto 1 %</Label><NumericEditor value={Number(line.discount || 0)} max={50} onValueChange={(value) => form.setValue(`lines.${index}.discount`, value)} /></div>
                      <div><Label>İskonto 2 %</Label><NumericEditor value={Number(line.discountSecondary || 0)} max={50} onValueChange={(value) => form.setValue(`lines.${index}.discountSecondary`, value)} /></div>
                      <div><Label>KDV %</Label><NumericEditor value={Number(line.tax || 0)} onValueChange={(value) => form.setValue(`lines.${index}.tax`, value)} /></div>
                      <div className="md:col-span-3 rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">Etkin iskonto: %{getEffectiveDiscountRate(line).toFixed(2)}</div>
                      {dynamicSchema.length > 0 && <div className="md:col-span-3 grid gap-3 rounded-lg border border-border/70 p-3"><p className="text-sm font-medium">Teknik alanlar</p><div className="grid gap-3 md:grid-cols-2">{dynamicSchema.map((field) => { const value = line.details?.attributes?.[field.field_key] ?? ''; const path = `lines.${index}.details.attributes.${field.field_key}`; if (field.type === 'textarea') return <div key={field.field_key} className="md:col-span-2"><Label>{field.label}</Label><Textarea value={value} onChange={(event) => form.setValue(path, event.target.value)} /></div>; if (field.type === 'select') return <div key={field.field_key}><Label>{field.label}</Label><Select value={String(value || '__empty__')} onValueChange={(nextValue) => form.setValue(path, nextValue === '__empty__' ? '' : nextValue)}><SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger><SelectContent><SelectItem value="__empty__">Boş</SelectItem>{(field.options || []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>; return <div key={field.field_key}><Label>{field.label}</Label><Input type={field.type === 'number' ? 'number' : 'text'} value={value} onChange={(event) => form.setValue(path, field.type === 'number' ? Number(event.target.value) : event.target.value)} /></div> })}</div></div>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

            <TabsContent value="review" className="space-y-3">
              <Card><CardContent className="grid gap-2 pt-4 text-sm"><p>Belge türü: {DOCUMENT_TYPE_TR[documentMode]}</p><p>Müşteri: {form.watch('customerName') || selectedCustomer?.name || '-'}</p><p>Hazırlayan: {preparers.find((user) => user.id === form.watch('preparedById'))?.fullName || '-'}</p><p>Satıcı firma: {getSellerCompanyLabel(sellerCompanies, form.watch('sellerCompanyKey'))}</p><p>Para birimi: {getCurrencySymbol(form.watch('currency'))} {getCurrencyLabel(form.watch('currency'))}</p><p>Kur: {formatExchangeRate(form.watch('exchangeRate'), form.watch('currency'))}</p><p>Teslim tarihi: {form.watch('delivery') ? formatDate(form.watch('delivery')) : '-'}</p><p>Şablon: {templateLabel(documentMode, form.watch('templateKey'))}</p><p>Satır sayısı: {lines.length}</p><p>Ara toplam: {formatDocumentAmount(subtotal, form.watch('currency'))}</p><p>Toplam iskonto: {formatDocumentAmount(discountTotal, form.watch('currency'))}</p><p>KDV: {formatDocumentAmount(taxTotal, form.watch('currency'))}</p><p>Genel toplam: {formatDocumentAmount(total, form.watch('currency'))}</p></CardContent></Card>
          </TabsContent>
        </Tabs>
        <DialogFooter><Button type="button" onClick={handleSaveClick} disabled={saving}>{saving ? 'Kaydediliyor...' : isEditing ? 'Değişiklikleri kaydet' : 'Kaydet'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export function QuoteDetailPage() {
  const params = useParams({ from: '/crm/quotes/$quoteId' })
  const navigate = useNavigate()
  const { data, sendQuote, requestQuoteApproval, convertQuote, deleteQuotes } = useAppStore()
  const { toast } = useToast()
  const [auditLogs, setAuditLogs] = useState<QuoteAuditLogItem[]>([])
  const [approvalSteps, setApprovalSteps] = useState<{ id: string; role: string; status: string; comment?: string; acted_by?: string; updated_at?: string }[]>([])
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const quote = data.quotes.find((item) => item.id === params.quoteId) ?? data.quotes[0]
  const company = data.companies.find((item) => item.id === quote?.customerId)
  const sellerCompanies = data.sellerCompanies || []
  if (!quote) return <p className="text-muted-foreground">Belge bulunamadı</p>

  useEffect(() => {
    if (!quote) return
    api.get('/audit/', { params: { entity: 'Quote', entity_id: quote.id } }).then((res) => setAuditLogs(res.data || [])).catch(() => setAuditLogs([]))
    api.get('/approvals/', { params: { quote_id: quote.id } }).then((res) => setApprovalSteps(res.data?.[0]?.steps || [])).catch(() => setApprovalSteps([]))
  }, [quote?.id])

  const customerSnapshot = quote.contractConfig?.customerSnapshot || quote.contractConfig?.customer_snapshot || {}
  const termsLines = getTermsText(quote.contractConfig).split('\n').map((line) => line.trim()).filter(Boolean)
  const contractNotesLines = getContractNotesText(quote.contractConfig).split('\n').map((line) => line.trim()).filter(Boolean)

  const handleSend = async () => {
    try {
      await sendQuote(quote.id)
      toast({ title: 'Belge gönderildi olarak işaretlendi' })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Gönderim durumu güncellenemedi', variant: 'destructive' })
    }
  }

  const handleRequestApproval = async () => {
    try {
      await requestQuoteApproval(quote.id)
      const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } })
      setApprovalSteps(refreshed.data?.[0]?.steps || [])
      toast({ title: 'Belge onay sürecine gönderildi' })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Onay süreci başlatılamadı', variant: 'destructive' })
    }
  }

  const handleConvert = async () => {
    try {
      const contract = await convertQuote(quote.id)
      toast({ title: 'Teklif sözleşmeye dönüştürüldü' })
      if (contract?.id) {
        navigate({ to: '/crm/quotes/$quoteId', params: { quoteId: contract.id } })
      }
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Sözleşmeye dönüştürme sırasında hata oluştu', variant: 'destructive' })
    }
  }

  const handleDownload = async () => {
    try {
      await downloadDocument(quote.id)
      toast({ title: `${DOCUMENT_TYPE_TR[quote.documentType]} dosyaları indirildi` })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || error?.message || 'Dosya oluşturulamadı', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!confirm(`${DOCUMENT_TYPE_TR[quote.documentType]} ${quote.number} kaydı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return

    setDeleting(true)
    try {
      await deleteQuotes([quote.id])
      toast({ title: `${DOCUMENT_TYPE_TR[quote.documentType]} silindi` })
      navigate({ to: '/crm/quotes' })
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Silme sırasında hata oluştu', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${quote.number} - ${quote.customerName || company?.name || ''}`}
        description={`${DOCUMENT_TYPE_TR[quote.documentType]} - ${quoteStatusTr(quote.status)} - ${formatCurrency(quote.total, quote.currency)}`}
        actions={
          <div className="flex gap-2">
            <RbacGuard perm="quotes.edit">
              <DocumentWizardTrigger
                quote={quote}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="mr-2 h-4 w-4" />
                    Düzenle
                  </Button>
                }
              />
            </RbacGuard>
            <RbacGuard perm="quotes.edit"><Button size="sm" variant="outline" onClick={handleSend}><Send className="mr-2 h-4 w-4" />Gönderildi işaretle</Button></RbacGuard>
            <Button onClick={handleDownload}><Download className="mr-2 h-4 w-4" />İndir</Button>
            <RbacGuard perm="quotes.edit"><Button size="sm" variant="outline" onClick={handleRequestApproval}><Shield className="mr-2 h-4 w-4" />Onay iste</Button></RbacGuard>
            {quote.documentType === 'Quote' ? <RbacGuard perm="quotes.edit"><Button size="sm" onClick={handleConvert}><Check className="mr-2 h-4 w-4" />Sözleşmeye dönüştür</Button></RbacGuard> : null}
            <RbacGuard perm="quotes.edit"><Button size="sm" variant="destructive" disabled={deleting} onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />Sil</Button></RbacGuard>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-3">
          <TabsTrigger value="overview">Özet</TabsTrigger>
          <TabsTrigger value="lines">Kalemler</TabsTrigger>
          <TabsTrigger value="document">Belge</TabsTrigger>
          <TabsTrigger value="pricing">Fiyatlama</TabsTrigger>
          <TabsTrigger value="approval">Onay</TabsTrigger>
          <TabsTrigger value="history">Geçmiş</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><Card><CardContent className="grid gap-2 pt-4 text-sm"><p>Müşteri: {quote.customerName || company?.name}</p><p>Sahip: {quote.owner}</p><p>Hazırlayan: {quote.preparedByName || '-'}</p><p>Oluşturulma: {formatDateTime(quote.createdAt)}</p><p>Geçerlilik: {formatDate(quote.validUntil)}</p><p>Para birimi: {getCurrencySymbol(quote.currency)} {getCurrencyLabel(quote.currency)}</p><p>Kur: {formatExchangeRate(quote.contractConfig?.exchangeRate || quote.contractConfig?.exchange_rate, quote.currency)}</p><p>Ödeme: {quote.terms.payment || '-'}</p><p>Teslim tarihi: {quote.terms.delivery ? formatDate(quote.terms.delivery) : '-'}</p><p>KDV oranı: %{quote.vatRate ?? 20}</p><p>Toplam: {formatCurrency(quote.total, quote.currency)}</p></CardContent></Card></TabsContent>
        <TabsContent value="lines"><Card><CardContent className="space-y-3 pt-4">{quote.lines.map((line, index) => <div key={`${line.name}-${index}`} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{line.name}</p><p className="text-muted-foreground">{sectionLabel(line.sectionKey)} - Kod: {line.details?.code || line.sku || '-'}</p></div><p>{formatCurrency(line.unitPrice, quote.currency)} / {line.unit || 'Adet'}</p></div><div className="mt-2 grid gap-1 md:grid-cols-3"><span>Detay 1: {line.details?.primary || '-'}</span><span>Detay 2: {line.details?.secondary || '-'}</span><span>Miktar: {line.qty}</span><span>İskonto 1: %{line.discount || 0}</span><span>İskonto 2: %{line.discountSecondary || 0}</span><span>KDV: %{line.tax || 0}</span><span>Etkin iskonto: %{getEffectiveDiscountRate(line).toFixed(2)}</span><span>Net tutar: {formatCurrency(getLineDiscountedBase(line), quote.currency)}</span><span>Tutar: {formatCurrency(getLineBase(line), quote.currency)}</span></div>{line.details?.attributes && Object.keys(line.details.attributes).length > 0 && <div className="mt-3 grid gap-2 rounded-md bg-muted/30 p-3 md:grid-cols-2">{Object.entries(line.details.attributes).map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}</div>}</div>)}</CardContent></Card></TabsContent>
        <TabsContent value="document"><Card><CardContent className="grid gap-2 pt-4 text-sm"><p>Satıcı firma: {getSellerCompanyLabel(sellerCompanies, quote.sellerCompanyKey)}</p><p>Şablon: {templateLabel(quote.documentType, quote.contractConfig?.templateKey || quote.contractConfig?.template_key)}</p><p>Cari ünvanı: {customerSnapshot.name || quote.customerName || company?.name || '-'}</p><p>Vergi bilgisi: {[customerSnapshot.tax_office || customerSnapshot.taxOffice, customerSnapshot.tax_number || customerSnapshot.taxNumber].filter(Boolean).join(' / ') || '-'}</p><p>Yetkili: {customerSnapshot.authorized_person || customerSnapshot.authorizedPerson || '-'}</p><p>Telefon / mail: {[customerSnapshot.phone, customerSnapshot.email].filter(Boolean).join(' / ') || '-'}</p><p>Adres: {customerSnapshot.address || '-'}</p>{termsLines.length > 0 && <div className="space-y-2 pt-2"><p className="font-medium">Maddeler</p>{termsLines.map((term, index) => <p key={`term-${index}`}>{term}</p>)}</div>}{contractNotesLines.length > 0 && <div className="space-y-2 pt-2"><p className="font-medium">Sözleşme notları</p>{contractNotesLines.map((term, index) => <p key={`contract-note-${index}`}>{term}</p>)}</div>}</CardContent></Card></TabsContent>
        <TabsContent value="pricing"><Card><CardContent className="pt-4 space-y-2 text-sm"><p>Fiyatlama kuralları müşteri, ürün kategorisi ve hacim bazlı uygulanır.</p><div className="flex gap-2"><Badge>VIP müşteri %8</Badge><Badge>Donanım %5</Badge><Badge>50k+ %3</Badge></div></CardContent></Card></TabsContent>
        <TabsContent value="approval"><Card><CardContent className="pt-4 space-y-2"><CardDescription>Satır içi onay akışı</CardDescription>{approvalSteps.length === 0 && <p className="text-sm text-muted-foreground">Onay kaydı yok</p>}{approvalSteps.map((step) => <div key={step.id} className="flex items-center justify-between rounded-md border p-2"><div><p className="font-semibold">{step.role}</p><p className="text-xs text-muted-foreground">Durum: {step.status}</p>{step.comment && <p className="text-xs text-muted-foreground">Not: {step.comment}</p>}</div>{step.status === 'Waiting' && <div className="flex gap-2"><RbacGuard perm="quotes.approve"><Button size="sm" disabled={busyStep === step.id} onClick={async () => { setBusyStep(step.id); await api.post(`/approvals/step/${step.id}/action/`, { action: 'approve' }); const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } }); setApprovalSteps(refreshed.data?.[0]?.steps || []); setBusyStep(null) }}>Onayla</Button></RbacGuard><RbacGuard perm="quotes.approve"><Button size="sm" variant="outline" disabled={busyStep === step.id} onClick={async () => { const reason = prompt('Ret nedeni:'); setBusyStep(step.id); await api.post(`/approvals/step/${step.id}/action/`, { action: 'reject', comment: reason || '' }); const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } }); setApprovalSteps(refreshed.data?.[0]?.steps || []); setBusyStep(null) }}>Reddet</Button></RbacGuard></div>}</div>)}<RbacGuard perm="quotes.edit"><Button size="sm" variant="ghost" disabled={busyStep !== null} onClick={async () => { setBusyStep('resubmit'); if (approvalSteps[0]) { await api.post(`/approvals/step/${approvalSteps[0].id}/action/`, { action: 'resubmit' }); const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } }); setApprovalSteps(refreshed.data?.[0]?.steps || []) } setBusyStep(null) }}>Yeniden gönder</Button></RbacGuard></CardContent></Card></TabsContent>
        <TabsContent value="history"><AuditHistoryList logs={auditLogs} companies={data.companies} users={data.users} currency={quote.currency} /></TabsContent>
      </Tabs>
    </div>
  )
}

function AuditHistoryList({ logs, companies, users, currency = 'TRY' }: { logs: QuoteAuditLogItem[]; companies: any[]; users: any[]; currency?: string }) {
  const groups = useMemo(() => buildAuditChangeGroups(logs, users), [logs, users])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Değişiklik Geçmişi</CardTitle>
        <CardDescription>Tarih, saat, kullanıcı ve değişiklik detayları olay bazlı gruplandırılır.</CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz değişiklik kaydı bulunamadı.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const actionMeta = getAuditActionMeta(group.action)
              const summaryText = getAuditSummaryText(group.details, companies, users, currency)

              return (
                <section key={group.id} className="rounded-xl border border-border/70 bg-card/30 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={actionMeta.variant as any}>{actionMeta.label}</Badge>
                        {group.details.length > 0 && <Badge variant="muted">{group.details.length} değişiklik</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{group.userLabel}</span>
                        <span>{formatDateTime(group.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {group.details.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {summaryText && (
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          {summaryText}
                        </div>
                      )}
                      {group.details.map((detail) => (
                        <div key={detail.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{detail.label}</p>
                            <Badge variant="outline">
                              {isEmptyAuditValue(detail.oldValue) ? 'Eklendi' : isEmptyAuditValue(detail.newValue) ? 'Kaldırıldı' : 'Güncellendi'}
                            </Badge>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Önce</p>
                              <AuditValueBlock fieldKey={detail.fieldKey} value={detail.oldValue} kind={detail.kind} companies={companies} users={users} currency={currency} />
                            </div>
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sonra</p>
                              <AuditValueBlock fieldKey={detail.fieldKey} value={detail.newValue} kind={detail.kind} companies={companies} users={users} currency={currency} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {group.action === 'updated'
                        ? 'Bu kayıt eski audit formatında tutulduğu için alan bazlı fark bilgisi yok. Bu güncellemeden sonra yapılan değişikliklerde önce/sonra farkları burada görünecek.'
                        : actionMeta.description}
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AuditValueBlock({ fieldKey, value, kind, companies, users, currency = 'TRY' }: { fieldKey: string; value: any; kind: AuditChangeDetail['kind']; companies: any[]; users: any[]; currency?: string }) {
  if (value === undefined || value === null || value === '') {
    return <p className="text-sm text-muted-foreground">Boş</p>
  }

  if (kind === 'lines' && Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kalem yok</p>
        ) : (
          value.map((line, index) => {
            const lineDetails = [
              line.code ? `Kod: ${line.code}` : null,
              line.section_key ? `Grup: ${sectionLabel(line.section_key)}` : null,
              `Miktar: ${line.qty || 0} ${line.unit || 'Adet'}`,
              `Birim fiyat: ${formatCurrency(Number(line.unit_price || 0), currency)}`,
              `İskonto: %${Number(line.discount || 0)} + %${Number(line.discount_secondary || 0)}`,
              `KDV: %${Number(line.tax || 0)}`,
            ].filter(Boolean)

            return (
              <div key={`${line.code || line.name || 'line'}-${index}`} className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-semibold">{index + 1}. kalem - {line.name || 'Adsız kalem'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{lineDetails.join(' • ')}</p>
              </div>
            )
          })
        )}
      </div>
    )
  }

  if (kind === 'array' && Array.isArray(value)) {
    return (
      <div className="space-y-1">
        {value.length === 0 ? <p className="text-sm text-muted-foreground">Kayıt yok</p> : value.map((item, index) => <p key={`${fieldKey}-${index}`} className="text-sm">{formatAuditValue(fieldKey, item, companies, users, currency)}</p>)}
      </div>
    )
  }

  if (kind === 'object' && isPlainObject(value)) {
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={`${fieldKey}-${key}`} className="grid gap-1 text-sm md:grid-cols-[160px_1fr]">
            <span className="text-muted-foreground">{getAuditFieldLabel(key)}</span>
            <span>{formatAuditValue(key, nestedValue, companies, users, currency)}</span>
          </div>
        ))}
      </div>
    )
  }

  if (fieldKey.split('.').at(-1) === 'status') {
    return <Badge variant={getQuoteStatusBadgeVariant(String(value)) as any}>{formatAuditValue(fieldKey, value, companies, users, currency)}</Badge>
  }

  return <p className="text-sm leading-6 whitespace-pre-wrap break-words">{formatAuditValue(fieldKey, value, companies, users, currency)}</p>
}
