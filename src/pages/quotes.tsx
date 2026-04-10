// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Check, Download, Plus, Send, Shield, Trash2 } from 'lucide-react'

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
import { TemplateQuoteWizardTrigger } from '@/components/quote-template-wizard'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { useAppStore } from '@/state/use-app-store'
import type { Product, Quote, SalesDocumentType } from '@/types'

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

const SELLER_OPTIONS = [{ value: 'ORTKA', label: 'ORTKA' }, { value: 'AYKA', label: 'AYKA' }]
const ADD_CUSTOMER_OPTION = '__add_company__'

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
  templateKey: z.string().optional(),
  contractDate: z.string().optional(),
  validUntil: z.string().optional(),
  validityLabel: z.string().optional(),
  priceListLabel: z.string().optional(),
  payment: z.string().optional(),
  paymentOption: z.string().optional(),
  delivery: z.string().optional(),
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

const getInitialValues = (mode: SalesDocumentType, companies: any[], preparers: any[], products: Product[]) => {
  const company = companies[0]
  return {
    customerId: company?.id ?? '',
    preparedById: preparers[0]?.id ?? '',
    sellerCompanyKey: 'AYKA',
    templateKey: '',
    contractDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    validityLabel: '',
    priceListLabel: '2026/1. LİSTE',
    payment: '',
    paymentOption: '',
    delivery: '',
    deliveryType: '',
    notes: '',
    customerName: company?.name ?? '',
    customerTaxOffice: company?.taxOffice ?? '',
    customerTaxNumber: company?.taxNumber ?? '',
    customerAddress: company?.address ?? '',
    customerAuthorizedPerson: company?.authorizedPerson ?? '',
    customerPhone: company?.phone ?? '',
    customerEmail: company?.email ?? '',
    signatureCustomerLabel: company?.name ?? '',
    termsText: DEFAULT_TERMS_TEXT,
    contractNotesText: DEFAULT_CONTRACT_NOTES_TEXT,
    lines: [products[0] ? buildLineFromProduct(products[0]) : createEmptyLine()],
  }
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
        quote.total,
      ].join(',')
    )
    .join('\n')

async function downloadDocument(quoteId: string) {
  const manifestResponse = await api.get(`/quotes/${quoteId}/export-files/`)
  const files = manifestResponse.data?.files || []
  if (!files.length) throw new Error('Bu belge için uygun XLSX şablonu bulunamadı')

  for (const file of files) {
    const response = await api.get(`/quotes/${quoteId}/export-xlsx/`, {
      params: file.template_key ? { template_key: file.template_key } : undefined,
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
  const { data } = useAppStore()
  const { toast } = useToast()
  const [status, setStatus] = useState('all')
  const [customer, setCustomer] = useState('all')
  const [documentType, setDocumentType] = useState<'all' | SalesDocumentType>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

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

  const columns: ColumnDef<Quote>[] = [
    { accessorKey: 'documentType', header: 'Tür', cell: ({ row }) => <Badge variant="outline">{DOCUMENT_TYPE_TR[row.original.documentType]}</Badge> },
    { accessorKey: 'number', header: 'No' },
    { accessorKey: 'createdAt', header: 'Oluşturulma', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { accessorKey: 'customerId', header: 'Müşteri', cell: ({ row }) => row.original.customerName || companies.find((company) => company.id === row.original.customerId)?.name || '' },
    { accessorKey: 'preparedByName', header: 'Hazırlayan', cell: ({ row }) => row.original.preparedByName || row.original.owner },
    { accessorKey: 'total', header: 'Tutar', cell: ({ row }) => formatCurrency(row.original.total) },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{quoteStatusTr(row.original.status)}</Badge> },
    { accessorKey: 'validUntil', header: 'Geçerlilik', cell: ({ row }) => formatDate(row.original.validUntil) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await downloadDocument(row.original.id)
                toast({ title: `${DOCUMENT_TYPE_TR[row.original.documentType]} dosyaları indirildi` })
              } catch (error: any) {
                toast({ title: error?.response?.data?.detail || error?.message || 'Dosya oluşturulamadı', variant: 'destructive' })
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            XLSX indir
          </Button>
          <Link to="/crm/quotes/$quoteId" params={{ quoteId: row.original.id }} className="text-xs text-primary underline">
            Görüntüle
          </Link>
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
              <TemplateQuoteWizardTrigger companies={companies} />
            </RbacGuard>
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
          <Label className="text-xs text-muted-foreground">Müşteri</Label>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger>
              <SelectValue placeholder="Tüm müşteriler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm müşteriler</SelectItem>
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

function DocumentWizardTrigger({ mode }: { mode: SalesDocumentType }) {
  const { data, createCompany, createQuote } = useAppStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const companies = data.companies
  const products = data.products
  const preparers = useMemo(() => data.users.filter((user) => user.canPrepareQuotes || user.permissions?.includes('quotes.prepare')), [data.users])
  const form = useForm({ resolver: zodResolver(documentSchema) as any, defaultValues: getInitialValues(mode, companies, preparers, products) })

  useEffect(() => {
    if (!open) form.reset(getInitialValues(mode, companies, preparers, products))
  }, [open, mode, companies, preparers, products, form])

  const selectedCustomer = companies.find((company) => company.id === form.watch('customerId'))
  const lines = form.watch('lines')

  const applyCustomerToForm = (company: any, includeCustomerId = false) => {
    if (!company) return
    if (includeCustomerId) form.setValue('customerId', company.id, { shouldDirty: true, shouldValidate: true })
    form.setValue('customerName', company.name || '')
    form.setValue('customerTaxOffice', company.taxOffice || '')
    form.setValue('customerTaxNumber', company.taxNumber || '')
    form.setValue('customerAddress', company.address || '')
    form.setValue('customerAuthorizedPerson', company.authorizedPerson || '')
    form.setValue('customerPhone', company.phone || '')
    form.setValue('customerEmail', company.email || '')
    form.setValue('signatureCustomerLabel', company.name || '')
  }

  useEffect(() => {
    if (!selectedCustomer) return
    applyCustomerToForm(selectedCustomer)
  }, [selectedCustomer, form])

  const subtotal = lines.reduce((sum, line) => sum + getLineBase(line), 0)
  const discountTotal = lines.reduce((sum, line) => sum + getLineDiscountTotal(line), 0)
  const taxTotal = lines.reduce((sum, line) => sum + getLineDiscountedBase(line) * (Number(line.tax || 0) / 100), 0)
  const total = subtotal - discountTotal + taxTotal

  const addLine = () => form.setValue('lines', [...lines, createEmptyLine()], { shouldDirty: true })
  const removeLine = (index: number) => form.setValue('lines', lines.filter((_, currentIndex) => currentIndex !== index), { shouldDirty: true })
  const applyProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId)
    form.setValue(`lines.${index}`, buildLineFromProduct(product, lines[index]), { shouldDirty: true })
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

    if (nextCompany) applyCustomerToForm(nextCompany, true)
    toast({ title: 'Müşteri eklendi' })
  }

  const handleSave = form.handleSubmit(async (values) => {
    const discountValidationMessage = getDiscountValidationMessage(values.lines)
    if (discountValidationMessage) {
      toast({ title: discountValidationMessage, variant: 'destructive' })
      return
    }

    try {
      await createQuote({
        documentType: mode,
        customerId: values.customerId,
        preparedById: values.preparedById,
        sellerCompanyKey: values.sellerCompanyKey,
        status: 'Draft',
        validUntil: values.validUntil || '',
        payment: values.payment || '',
        delivery: values.delivery || '',
        notes: values.notes || '',
        contractConfig: {
          templateMode: values.templateKey ? 'manual' : 'auto',
          templateKey: values.templateKey || '',
          contractDate: values.contractDate,
          validityLabel: values.validityLabel,
          priceListLabel: values.priceListLabel,
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
        lines: values.lines.map((line, index) => ({
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
      } as any)
      toast({ title: `${DOCUMENT_TYPE_TR[mode]} kaydedildi` })
      form.reset(getInitialValues(mode, companies, preparers, products))
      setOpen(false)
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Kayıt sırasında hata oluştu', variant: 'destructive' })
    }
  })

  return (
    <>
      <CompanyModal open={customerModalOpen} onOpenChange={setCustomerModalOpen} onSubmit={handleCustomerCreate} />
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={mode === 'Contract' ? 'default' : 'outline'}>
          <Plus className="mr-2 h-4 w-4" />
          {mode === 'Contract' ? 'Yeni sözleşme' : 'Yeni teklif'}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn('max-h-[92vh] max-w-[82rem] overflow-y-auto', customerModalOpen && 'pointer-events-none opacity-0')}>
        <DialogHeader><DialogTitle>{mode === 'Contract' ? 'Sözleşme oluştur' : 'Teklif oluştur'}</DialogTitle></DialogHeader>
        <Tabs defaultValue="customer">
          <TabsList className="mb-3 grid grid-cols-4">
            <TabsTrigger value="customer">Müşteri</TabsTrigger>
            <TabsTrigger value="document">Belge</TabsTrigger>
            <TabsTrigger value="lines">Kalemler</TabsTrigger>
            <TabsTrigger value="review">Özet</TabsTrigger>
          </TabsList>
          <TabsContent value="customer" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Müşteri</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCustomerModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Müşteri ekle
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
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ADD_CUSTOMER_OPTION}>Yeni müşteri / firma ekle</SelectItem>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Listeden ayrılmadan yeni firma ekleyebilir ve eklediğiniz müşteriyi anında seçebilirsiniz.</p>
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
              <div><Label>Hazırlayan</Label><Select value={form.watch('preparedById') || '__none__'} onValueChange={(value) => form.setValue('preparedById', value === '__none__' ? '' : value)}><SelectTrigger><SelectValue placeholder="Hazırlayan seçin" /></SelectTrigger><SelectContent><SelectItem value="__none__">Seçili değil</SelectItem>{preparers.map((user) => <SelectItem key={user.id} value={user.id}>{user.fullName || user.username}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Satıcı firma</Label><Select value={form.watch('sellerCompanyKey') || 'AYKA'} onValueChange={(value) => form.setValue('sellerCompanyKey', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SELLER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Şablon</Label><Select value={form.watch('templateKey') || '__auto__'} onValueChange={(value) => form.setValue('templateKey', value === '__auto__' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_OPTIONS[mode].map((option) => <SelectItem key={option.value || '__auto__'} value={option.value || '__auto__'}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Belge tarihi</Label><Input type="date" value={form.watch('contractDate') || ''} onChange={(event) => form.setValue('contractDate', event.target.value)} /></div>
              <div><Label>Geçerlilik tarihi</Label><Input type="date" value={form.watch('validUntil') || ''} onChange={(event) => form.setValue('validUntil', event.target.value)} /></div>
              <div><Label>Geçerlilik etiketi</Label><Input value={form.watch('validityLabel') || ''} onChange={(event) => form.setValue('validityLabel', event.target.value)} /></div>
              <div><Label>Fiyat listesi etiketi</Label><Input value={form.watch('priceListLabel') || ''} onChange={(event) => form.setValue('priceListLabel', event.target.value)} /></div>
              <div><Label>İmza etiketi</Label><Input value={form.watch('signatureCustomerLabel') || ''} onChange={(event) => form.setValue('signatureCustomerLabel', event.target.value)} /></div>
              <div><Label>Teslim tipi</Label><Input value={form.watch('deliveryType') || ''} onChange={(event) => form.setValue('deliveryType', event.target.value)} /></div>
              <div><Label>Ödeme tipi</Label><Input value={form.watch('paymentOption') || ''} onChange={(event) => form.setValue('paymentOption', event.target.value)} /></div>
              <div><Label>Ödeme metni</Label><Input value={form.watch('payment') || ''} onChange={(event) => form.setValue('payment', event.target.value)} /></div>
              <div><Label>Teslim metni</Label><Input value={form.watch('delivery') || ''} onChange={(event) => form.setValue('delivery', event.target.value)} /></div>
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
                      <div><Label>Birim fiyat</Label><NumericEditor value={Number(line.unitPrice || 0)} onValueChange={(value) => form.setValue(`lines.${index}.unitPrice`, value)} /></div>
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
            <Card><CardContent className="grid gap-2 pt-4 text-sm"><p>Belge türü: {DOCUMENT_TYPE_TR[mode]}</p><p>Müşteri: {form.watch('customerName') || selectedCustomer?.name || '-'}</p><p>Hazırlayan: {preparers.find((user) => user.id === form.watch('preparedById'))?.fullName || '-'}</p><p>Satıcı firma: {form.watch('sellerCompanyKey') || '-'}</p><p>Şablon: {templateLabel(mode, form.watch('templateKey'))}</p><p>Satır sayısı: {lines.length}</p><p>Ara toplam: {formatCurrency(subtotal)}</p><p>Toplam iskonto: {formatCurrency(discountTotal)}</p><p>KDV: {formatCurrency(taxTotal)}</p><p>Genel toplam: {formatCurrency(total)}</p></CardContent></Card>
          </TabsContent>
        </Tabs>
        <DialogFooter><Button onClick={handleSave}>Kaydet</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export function QuoteDetailPage() {
  const params = useParams({ from: '/crm/quotes/$quoteId' })
  const { data, updateQuote, convertQuote } = useAppStore()
  const { toast } = useToast()
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; field: string; old_value: string; new_value: string; created_at: string; user?: string }[]>([])
  const [approvalSteps, setApprovalSteps] = useState<{ id: string; role: string; status: string; comment?: string; acted_by?: string; updated_at?: string }[]>([])
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const quote = data.quotes.find((item) => item.id === params.quoteId) ?? data.quotes[0]
  const company = data.companies.find((item) => item.id === quote?.customerId)
  if (!quote) return <p className="text-muted-foreground">Belge bulunamadı</p>

  useEffect(() => {
    if (!quote) return
    api.get('/audit/', { params: { entity: 'Quote', entity_id: quote.id } }).then((res) => setAuditLogs(res.data || [])).catch(() => setAuditLogs([]))
    api.get('/approvals/', { params: { quote_id: quote.id } }).then((res) => setApprovalSteps(res.data?.[0]?.steps || [])).catch(() => setApprovalSteps([]))
  }, [quote?.id])

  const customerSnapshot = quote.contractConfig?.customerSnapshot || quote.contractConfig?.customer_snapshot || {}
  const termsLines = getTermsText(quote.contractConfig).split('\n').map((line) => line.trim()).filter(Boolean)
  const contractNotesLines = getContractNotesText(quote.contractConfig).split('\n').map((line) => line.trim()).filter(Boolean)

  const approve = (role: any) => {
    updateQuote(quote.id, {
      approval: (quote.approval || []).map((step) => (step.role === role ? { ...step, status: 'Approved', updatedAt: new Date().toISOString() } : step)),
      status: role === 'Finance' ? 'Approved' : quote.status,
    })
    toast({ title: `${role} onayı alındı` })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${quote.number} - ${quote.customerName || company?.name || ''}`}
        description={`${DOCUMENT_TYPE_TR[quote.documentType]} - ${quoteStatusTr(quote.status)} - ${formatCurrency(quote.total)}`}
        actions={
          <div className="flex gap-2">
            <RbacGuard perm="quotes.edit"><Button size="sm" variant="outline" onClick={() => updateQuote(quote.id, { status: 'Sent' })}><Send className="mr-2 h-4 w-4" />Gönder</Button></RbacGuard>
            <Button onClick={async () => { try { await downloadDocument(quote.id); toast({ title: `${DOCUMENT_TYPE_TR[quote.documentType]} dosyaları indirildi` }) } catch (error: any) { toast({ title: error?.response?.data?.detail || error?.message || 'Dosya oluşturulamadı', variant: 'destructive' }) } }}><Download className="mr-2 h-4 w-4" />XLSX indir</Button>
            <RbacGuard perm="quotes.edit"><Button size="sm" variant="outline" onClick={() => approve('Manager')}><Shield className="mr-2 h-4 w-4" />Onay iste</Button></RbacGuard>
            <RbacGuard perm="quotes.approve"><Button size="sm" onClick={() => { convertQuote(quote.id); toast({ title: 'Satış siparişine dönüştürüldü' }) }}><Check className="mr-2 h-4 w-4" />Satış siparişi</Button></RbacGuard>
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

        <TabsContent value="overview"><Card><CardContent className="grid gap-2 pt-4 text-sm"><p>Müşteri: {quote.customerName || company?.name}</p><p>Sahip: {quote.owner}</p><p>Hazırlayan: {quote.preparedByName || '-'}</p><p>Oluşturulma: {formatDateTime(quote.createdAt)}</p><p>Geçerlilik: {formatDate(quote.validUntil)}</p><p>Ödeme: {quote.terms.payment || '-'}</p><p>Teslim: {quote.terms.delivery || '-'}</p><p>KDV oranı: %{quote.vatRate ?? 20}</p><p>Toplam: {formatCurrency(quote.total)}</p></CardContent></Card></TabsContent>
        <TabsContent value="lines"><Card><CardContent className="space-y-3 pt-4">{quote.lines.map((line, index) => <div key={`${line.name}-${index}`} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{line.name}</p><p className="text-muted-foreground">{sectionLabel(line.sectionKey)} - Kod: {line.details?.code || line.sku || '-'}</p></div><p>{formatCurrency(line.unitPrice)} / {line.unit || 'Adet'}</p></div><div className="mt-2 grid gap-1 md:grid-cols-3"><span>Detay 1: {line.details?.primary || '-'}</span><span>Detay 2: {line.details?.secondary || '-'}</span><span>Miktar: {line.qty}</span><span>İskonto 1: %{line.discount || 0}</span><span>İskonto 2: %{line.discountSecondary || 0}</span><span>KDV: %{line.tax || 0}</span><span>Etkin iskonto: %{getEffectiveDiscountRate(line).toFixed(2)}</span><span>Net tutar: {formatCurrency(getLineDiscountedBase(line))}</span><span>Tutar: {formatCurrency(getLineBase(line))}</span></div>{line.details?.attributes && Object.keys(line.details.attributes).length > 0 && <div className="mt-3 grid gap-2 rounded-md bg-muted/30 p-3 md:grid-cols-2">{Object.entries(line.details.attributes).map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}</div>}</div>)}</CardContent></Card></TabsContent>
        <TabsContent value="document"><Card><CardContent className="grid gap-2 pt-4 text-sm"><p>Satıcı firma: {quote.sellerCompanyKey || '-'}</p><p>Şablon: {templateLabel(quote.documentType, quote.contractConfig?.templateKey || quote.contractConfig?.template_key)}</p><p>Cari ünvanı: {customerSnapshot.name || quote.customerName || company?.name || '-'}</p><p>Vergi bilgisi: {[customerSnapshot.tax_office || customerSnapshot.taxOffice, customerSnapshot.tax_number || customerSnapshot.taxNumber].filter(Boolean).join(' / ') || '-'}</p><p>Yetkili: {customerSnapshot.authorized_person || customerSnapshot.authorizedPerson || '-'}</p><p>Telefon / mail: {[customerSnapshot.phone, customerSnapshot.email].filter(Boolean).join(' / ') || '-'}</p><p>Adres: {customerSnapshot.address || '-'}</p>{termsLines.length > 0 && <div className="space-y-2 pt-2"><p className="font-medium">Maddeler</p>{termsLines.map((term, index) => <p key={`term-${index}`}>{term}</p>)}</div>}{contractNotesLines.length > 0 && <div className="space-y-2 pt-2"><p className="font-medium">Sözleşme notları</p>{contractNotesLines.map((term, index) => <p key={`contract-note-${index}`}>{term}</p>)}</div>}</CardContent></Card></TabsContent>
        <TabsContent value="pricing"><Card><CardContent className="pt-4 space-y-2 text-sm"><p>Fiyatlama kuralları müşteri, ürün kategorisi ve hacim bazlı uygulanır.</p><div className="flex gap-2"><Badge>VIP müşteri %8</Badge><Badge>Donanım %5</Badge><Badge>50k+ %3</Badge></div></CardContent></Card></TabsContent>
        <TabsContent value="approval"><Card><CardContent className="pt-4 space-y-2"><CardDescription>Satır içi onay akışı</CardDescription>{approvalSteps.length === 0 && <p className="text-sm text-muted-foreground">Onay kaydı yok</p>}{approvalSteps.map((step) => <div key={step.id} className="flex items-center justify-between rounded-md border p-2"><div><p className="font-semibold">{step.role}</p><p className="text-xs text-muted-foreground">Durum: {step.status}</p>{step.comment && <p className="text-xs text-muted-foreground">Not: {step.comment}</p>}</div>{step.status === 'Waiting' && <div className="flex gap-2"><RbacGuard perm="quotes.approve"><Button size="sm" disabled={busyStep === step.id} onClick={async () => { setBusyStep(step.id); await api.post(`/approvals/step/${step.id}/action/`, { action: 'approve' }); const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } }); setApprovalSteps(refreshed.data?.[0]?.steps || []); setBusyStep(null) }}>Onayla</Button></RbacGuard><RbacGuard perm="quotes.approve"><Button size="sm" variant="outline" disabled={busyStep === step.id} onClick={async () => { const reason = prompt('Ret nedeni:'); setBusyStep(step.id); await api.post(`/approvals/step/${step.id}/action/`, { action: 'reject', comment: reason || '' }); const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } }); setApprovalSteps(refreshed.data?.[0]?.steps || []); setBusyStep(null) }}>Reddet</Button></RbacGuard></div>}</div>)}<RbacGuard perm="quotes.edit"><Button size="sm" variant="ghost" disabled={busyStep !== null} onClick={async () => { setBusyStep('resubmit'); if (approvalSteps[0]) { await api.post(`/approvals/step/${approvalSteps[0].id}/action/`, { action: 'resubmit' }); const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } }); setApprovalSteps(refreshed.data?.[0]?.steps || []) } setBusyStep(null) }}>Yeniden gönder</Button></RbacGuard></CardContent></Card></TabsContent>
        <TabsContent value="history"><Card><CardContent className="pt-4 space-y-2 text-sm">{auditLogs.length === 0 && <p className="text-muted-foreground text-sm">Audit kaydı bulunamadı</p>}{auditLogs.map((item) => <div key={item.id} className="rounded-md border p-2"><p className="font-semibold">{item.field || item.action}</p><p>{item.old_value ?? '-'} → {item.new_value ?? '-'}</p><p className="text-xs text-muted-foreground">{item.user || '—'} • {formatDate(item.created_at)}</p></div>)}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  )
}
