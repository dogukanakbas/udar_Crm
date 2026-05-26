import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, GripVertical, Plus, Save, Trash2, Upload } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import api from '@/lib/api'
import { RbacGuard } from '@/components/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { normalizePaymentOptions } from '@/lib/payment-options'
import { getDefaultPriceList, normalizePriceListKey, normalizePriceLists, type PriceListOption } from '@/lib/price-lists'

type DocumentTemplateLibraryItem = {
  template_key: string
  document_type?: 'Quote' | 'Contract' | 'Master'
  label: string
  default_filename: string
  current_filename: string
  has_custom: boolean
  source_type: 'default' | 'custom'
  uploaded_at?: string | null
  seller_company_key?: string
  uses_shared_custom?: boolean
}

type SellerTemplateGroup = {
  seller_company_key: string
  seller_short_name: string
  seller_display_name: string
  master_template?: DocumentTemplateLibraryItem
}

type TemplatePlaceholderGroup = {
  group: string
  description: string
  items: Array<{
    token: string
    label: string
  }>
}

const DEFAULT_DOCUMENT_COLUMNS = ['Kod', 'Satış Birimi', 'Ölçü / Gövde', 'Renk / Kapak', 'Miktar', 'Liste Fiyatı', 'İSK1%', 'İSK2%', 'Birim', 'Birim Net Fiyatı', 'Tutar']
const DEFAULT_DOCUMENT_TERMS_TEXT = [
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
const SELLER_MASTER_TEMPLATE_KEY = 'seller_master'
const DEFAULT_MASTER_TEMPLATE_ITEM: DocumentTemplateLibraryItem = {
  template_key: SELLER_MASTER_TEMPLATE_KEY,
  document_type: 'Master',
  label: 'Firma ana Excel şablonu',
  default_filename: 'seller-master-template.xlsx',
  current_filename: 'seller-master-template.xlsx',
  has_custom: false,
  source_type: 'default',
}

const normalizeServiceExpenseTaxRate = (value: unknown) => {
  const parsed = Number(value ?? 20)
  if (!Number.isFinite(parsed)) return 20
  return Math.min(100, Math.max(0, parsed))
}

const normalizeColumnKey = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '')

const isDiscountOneColumn = (value: string) => {
  const key = normalizeColumnKey(value)
  return key === 'iskonto' || key === 'isk' || key.includes('iskonto1') || key.includes('1iskonto') || key.includes('isk1') || key.includes('1isk')
}

const isDiscountTwoColumn = (value: string) => {
  const key = normalizeColumnKey(value)
  return key.includes('iskonto2') || key.includes('2iskonto') || key.includes('isk2') || key.includes('2isk')
}

const normalizeDocumentColumns = (columns: string[]) => {
  const parsed = columns.map((column) => String(column || '').trim()).filter(Boolean)
  const base = (parsed.length ? parsed : DEFAULT_DOCUMENT_COLUMNS).filter(
    (column) => !isDiscountOneColumn(column) && !isDiscountTwoColumn(column)
  )
  const keys = base.map(normalizeColumnKey)
  let listPriceIndex = -1
  keys.forEach((key, index) => {
    if (key.includes('liste') || (key.includes('fiyat') && !key.includes('net'))) {
      listPriceIndex = index
    }
  })
  const unitIndex = keys.findIndex((key) => key === 'birim' || key.endsWith('birim'))
  const insertAt = listPriceIndex >= 0 ? listPriceIndex + 1 : unitIndex >= 0 ? unitIndex : base.length
  return [...base.slice(0, insertAt), 'İSK1%', 'İSK2%', ...base.slice(insertAt)]
}

const normalizeDocumentGroup = (category: any, index: number) => {
  const defaults = category.templateDefaults || {}
  const columns = Array.isArray(defaults.document_columns) && defaults.document_columns.length
    ? normalizeDocumentColumns(defaults.document_columns)
    : DEFAULT_DOCUMENT_COLUMNS
  const technicalItems = Array.isArray(defaults.technical_items) ? defaults.technical_items : []
  return {
    id: String(category.id || `new-${index}`),
    name: category.name || '',
    templateDefaults: {
      section_key: defaults.section_key || '',
      unit: defaults.unit || 'Adet',
      tax: Number(defaults.tax ?? 20),
      discount: Number(defaults.discount ?? 0),
      discount_secondary: Number(defaults.discount_secondary ?? 0),
      template_family: defaults.template_family || '',
      document_order: Number(defaults.document_order ?? index),
      document_columns: columns,
      technical_items: technicalItems,
    },
    attributeSchema: category.attributeSchema || [],
  }
}

const parseDocumentColumnsText = (value: string) =>
  normalizeDocumentColumns(
    value
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean)
  )

const parseTechnicalItemsText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

function SortableProductGroupCard({
  item,
  onPatch,
  onSave,
  saving,
}: {
  item: any
  onPatch: (id: string, patch: any) => void
  onSave: (item: any) => void
  saving: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const defaults = item.templateDefaults || {}
  const documentColumnsText = useMemo(
    () => (defaults.document_columns || DEFAULT_DOCUMENT_COLUMNS).join(', '),
    [defaults.document_columns]
  )
  const technicalItemsText = useMemo(
    () => (defaults.technical_items || []).join('\n'),
    [defaults.technical_items]
  )
  const [columnsDraft, setColumnsDraft] = useState(documentColumnsText)
  const [technicalItemsDraft, setTechnicalItemsDraft] = useState(technicalItemsText)

  const setTemplate = (key: string, value: any) =>
    onPatch(item.id, { templateDefaults: { ...defaults, [key]: value } })

  useEffect(() => {
    setColumnsDraft(documentColumnsText)
  }, [documentColumnsText])

  useEffect(() => {
    setTechnicalItemsDraft(technicalItemsText)
  }, [technicalItemsText])

  const getItemWithDrafts = () => ({
    ...item,
    templateDefaults: {
      ...defaults,
      document_columns: parseDocumentColumnsText(columnsDraft),
      technical_items: parseTechnicalItemsText(technicalItemsDraft),
    },
  })

  const commitColumnsDraft = () => setTemplate('document_columns', parseDocumentColumnsText(columnsDraft))
  const commitTechnicalItemsDraft = () => setTemplate('technical_items', parseTechnicalItemsText(technicalItemsDraft))

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-border/70 bg-background/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <button
            type="button"
            className="mt-8 rounded-md border border-border/70 p-2 text-muted-foreground hover:text-foreground"
            aria-label="Ürün grubunu sırala"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Ürün grubu adı</Label>
              <Input value={item.name} onChange={(event) => onPatch(item.id, { name: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Belge grup anahtarı</Label>
              <Input value={defaults.section_key || ''} onChange={(event) => setTemplate('section_key', event.target.value)} placeholder="steel_door" />
            </div>
            <div className="space-y-1">
              <Label>Şablon ailesi</Label>
              <Input value={defaults.template_family || ''} onChange={(event) => setTemplate('template_family', event.target.value)} placeholder="steel" />
            </div>
            <div className="space-y-1">
              <Label>Varsayılan birim</Label>
              <Input value={defaults.unit || ''} onChange={(event) => setTemplate('unit', event.target.value)} placeholder="Adet / Metre" />
            </div>
            <div className="space-y-1">
              <Label>Varsayılan KDV</Label>
              <Input type="number" value={defaults.tax ?? 20} onChange={(event) => setTemplate('tax', Number(event.target.value || 0))} />
            </div>
            <div className="space-y-1">
              <Label>Belge sırası</Label>
              <Input type="number" value={defaults.document_order ?? 0} onChange={(event) => setTemplate('document_order', Number(event.target.value || 0))} />
            </div>
          </div>
        </div>
        <RbacGuard perm="products.edit">
          <Button size="sm" onClick={() => onSave(getItemWithDrafts())} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Kaydet
          </Button>
        </RbacGuard>
      </div>

      <details className="mt-4 rounded-lg border border-dashed border-border/70 p-3">
        <summary className="cursor-pointer text-sm font-medium">Tablo kolonları ve teknik alt maddeler</summary>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="space-y-1">
            <Label>Tablo kolonları</Label>
            <Textarea
              rows={5}
              value={columnsDraft}
              onChange={(event) => setColumnsDraft(event.target.value)}
              onBlur={commitColumnsDraft}
            />
            <p className="text-xs text-muted-foreground">Excel tablo başlıkları soldan sağa bu sırayla yorumlanır.</p>
          </div>
          <div className="space-y-1">
            <Label>Teknik alt maddeler</Label>
            <Textarea
              rows={5}
              value={technicalItemsDraft}
              onChange={(event) => setTechnicalItemsDraft(event.target.value)}
              onBlur={commitTechnicalItemsDraft}
              placeholder="Her satıra ayrı teknik alt madde yazın"
            />
            <p className="text-xs text-muted-foreground">Her satır ayrı teknik alt madde olarak kaydedilir; yazarken boşluklar korunur.</p>
          </div>
        </div>
      </details>
    </div>
  )
}

export function DocumentProductGroupManager() {
  const { data, upsertCategory } = useAppStore()
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const normalized = (data.categories || [])
      .map((category, index) => normalizeDocumentGroup(category, index))
      .sort((left, right) => Number(left.templateDefaults.document_order ?? 999) - Number(right.templateDefaults.document_order ?? 999) || left.name.localeCompare(right.name, 'tr'))
    setItems(normalized)
  }, [data.categories])

  const patchItem = (id: string, patch: any) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...patch, templateDefaults: patch.templateDefaults || item.templateDefaults }
          : item
      )
    )
  }

  const saveItem = async (item: any) => {
    setSavingId(item.id)
    try {
      const isNew = String(item.id).startsWith('new-')
      await upsertCategory({
        id: isNew ? undefined : item.id,
        name: item.name || 'Yeni ürün grubu',
        templateDefaults: item.templateDefaults,
        attributeSchema: item.attributeSchema || [],
      } as any)
      toast({ title: 'Ürün grubu kaydedildi' })
    } catch (error: any) {
      toast({
        title: 'Ürün grubu kaydedilemedi',
        description: error?.response?.data?.detail || 'Lütfen bilgileri kontrol edip tekrar deneyin.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const saveAllOrder = async () => {
    setSavingId('__order__')
    try {
      await Promise.all(
        items.map((item, index) =>
          upsertCategory({
            id: String(item.id).startsWith('new-') ? undefined : item.id,
            name: item.name || 'Yeni ürün grubu',
            templateDefaults: { ...item.templateDefaults, document_order: index },
            attributeSchema: item.attributeSchema || [],
          } as any)
        )
      )
      toast({ title: 'Ürün grubu sırası kaydedildi' })
    } catch {
      toast({ title: 'Sıralama kaydedilemedi', variant: 'destructive' })
    } finally {
      setSavingId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id)
      const newIndex = current.findIndex((item) => item.id === over.id)
      return arrayMove(current, oldIndex, newIndex).map((item, index) => ({
        ...item,
        templateDefaults: { ...item.templateDefaults, document_order: index },
      }))
    })
  }

  const addGroup = () => {
    const id = `new-${Date.now()}`
    setItems((current) => [
      ...current,
      normalizeDocumentGroup(
        {
          id,
          name: 'Yeni ürün grubu',
          templateDefaults: {
            section_key: `custom_${current.length + 1}`,
            unit: 'Adet',
            tax: 20,
            template_family: 'custom',
            document_order: current.length,
            document_columns: DEFAULT_DOCUMENT_COLUMNS,
            technical_items: [],
          },
          attributeSchema: [],
        },
        current.length
      ),
    ])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ürün Grupları</CardTitle>
        <CardDescription>
          Belge tablolarının ürün grubu sırasını, varsayılan birim/KDV bilgisini ve her gruba özel teknik alt maddeleri buradan yönetin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <RbacGuard perm="products.edit">
            <Button size="sm" variant="outline" onClick={addGroup}>
              <Plus className="mr-2 h-4 w-4" />
              Ürün grubu ekle
            </Button>
            <Button size="sm" onClick={saveAllOrder} disabled={savingId === '__order__'}>
              {savingId === '__order__' ? 'Sıra kaydediliyor...' : 'Ürün sırasını kaydet'}
            </Button>
          </RbacGuard>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item) => (
                <SortableProductGroupCard
                  key={item.id}
                  item={item}
                  onPatch={patchItem}
                  onSave={saveItem}
                  saving={savingId === item.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  )
}

async function downloadTemplateFile(
  templateKey: string,
  variant: 'current' | 'default',
  expectedFilename: string,
  sellerCompanyKey?: string
) {
  const response = await api.get('/quotes/template-library-download/', {
    params: { template_key: templateKey, variant, seller_company_key: sellerCompanyKey || undefined },
    responseType: 'blob',
  })
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const disposition = response.headers['content-disposition'] || ''
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/)
  link.href = url
  link.download = fileNameMatch?.[1] || expectedFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export function DocumentTemplateLibrary() {
  const { data } = useAppStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sellerTemplateGroups, setSellerTemplateGroups] = useState<SellerTemplateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<{ templateKey: string; sellerCompanyKey: string } | null>(null)
  const [priceLists, setPriceLists] = useState<PriceListOption[]>(normalizePriceLists())
  const [paymentOptions, setPaymentOptions] = useState<string[]>(normalizePaymentOptions())
  const [serviceExpenseTaxRate, setServiceExpenseTaxRate] = useState(20)
  const [quoteTermsText, setQuoteTermsText] = useState(DEFAULT_DOCUMENT_TERMS_TEXT)
  const [contractTermsText, setContractTermsText] = useState(DEFAULT_DOCUMENT_TERMS_TEXT)
  const [savingSettings, setSavingSettings] = useState(false)
  const [placeholderGroups, setPlaceholderGroups] = useState<TemplatePlaceholderGroup[]>([])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await api.get('/quotes/template-library/')
      setSellerTemplateGroups(response.data?.seller_templates || [])
    } catch {
      toast({
        title: 'Şablonlar alınamadı',
        description: 'Şablon kütüphanesi yüklenemedi, lütfen tekrar deneyin.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    api
      .get('/auth/organization-settings/')
      .then((response) => {
        setPriceLists(normalizePriceLists(response.data?.price_lists))
        setPaymentOptions(normalizePaymentOptions(response.data?.payment_options))
        setServiceExpenseTaxRate(normalizeServiceExpenseTaxRate(response.data?.service_expense_tax_rate))
        setQuoteTermsText(response.data?.quote_terms_text || DEFAULT_DOCUMENT_TERMS_TEXT)
        setContractTermsText(response.data?.contract_terms_text || DEFAULT_DOCUMENT_TERMS_TEXT)
      })
      .catch(() => {
        setPriceLists(normalizePriceLists())
        setPaymentOptions(normalizePaymentOptions())
        setServiceExpenseTaxRate(20)
        setQuoteTermsText(DEFAULT_DOCUMENT_TERMS_TEXT)
        setContractTermsText(DEFAULT_DOCUMENT_TERMS_TEXT)
      })
  }, [])

  useEffect(() => {
    api
      .get('/quotes/template-placeholders/')
      .then((response) => setPlaceholderGroups(response.data?.groups || []))
      .catch(() => setPlaceholderGroups([]))
  }, [])

  const fallbackSellerTemplateGroups = useMemo<SellerTemplateGroup[]>(
    () =>
      sellerTemplateGroups.length
        ? sellerTemplateGroups
        : (data.sellerCompanies || []).map((seller) => ({
            seller_company_key: seller.key,
            seller_short_name: seller.shortName || seller.key,
            seller_display_name: seller.displayName || seller.legalName || seller.key,
            master_template: { ...DEFAULT_MASTER_TEMPLATE_ITEM, seller_company_key: seller.key },
          })),
    [data.sellerCompanies, sellerTemplateGroups]
  )

  const openUploadPicker = (templateKey: string, sellerCompanyKey = '') => {
    setPendingTemplate({ templateKey, sellerCompanyKey })
    fileInputRef.current?.click()
  }

  const updatePriceList = (key: string, patch: Partial<PriceListOption>) => {
    setPriceLists((current) =>
      normalizePriceLists(
        current.map((priceList) =>
          priceList.key === key
            ? {
                ...priceList,
                ...patch,
                key: patch.key ? normalizePriceListKey(patch.key, priceList.key) : priceList.key,
              }
            : patch.is_default
              ? { ...priceList, is_default: false }
              : priceList
        )
      )
    )
  }

  const addPriceList = () => {
    setPriceLists((current) =>
      normalizePriceLists([
        ...current,
        { key: `list_${current.length + 1}`, label: `2026/${current.length + 1}. LİSTE`, is_default: false },
      ])
    )
  }

  const removePriceList = (key: string) => {
    setPriceLists((current) => normalizePriceLists(current.filter((priceList) => priceList.key !== key)))
  }

  const updatePaymentOption = (index: number, value: string) => {
    setPaymentOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)))
  }

  const addPaymentOption = () => {
    setPaymentOptions((current) => [...current, 'Yeni ödeme tipi'])
  }

  const removePaymentOption = (index: number) => {
    setPaymentOptions((current) => normalizePaymentOptions(current.filter((_, optionIndex) => optionIndex !== index)))
  }

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !pendingTemplate) return

    const formData = new FormData()
    formData.append('template_key', pendingTemplate.templateKey)
    formData.append('seller_company_key', pendingTemplate.sellerCompanyKey)
    formData.append('file', file)

    const activeUploadKey = `${pendingTemplate.sellerCompanyKey}:${pendingTemplate.templateKey}`
    setUploadingKey(activeUploadKey)
    try {
      await api.post('/quotes/template-library-upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast({
        title: 'Şablon yüklendi',
        description: 'Yeni dosya artık belge dışa aktarımlarında kullanılacak.',
      })
      await fetchTemplates()
    } catch (error: any) {
      toast({
        title: 'Şablon yüklenemedi',
        description: error?.response?.data?.detail || 'Dosya sisteme alınamadı.',
        variant: 'destructive',
      })
    } finally {
      setUploadingKey(null)
      setPendingTemplate(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şablon Kütüphanesi</CardTitle>
        <CardDescription>
          Teklif ve sözleşme şablonlarını indirip Excel içinde düzenleyebilir, logonuzu yerleştirip tekrar sisteme yükleyebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Belge sabitleri</CardTitle>
            <CardDescription>Fiyat listelerini burada tanımlayın; müşteriler ve teklifler bu listelerden birini kullanır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Fiyat listeleri</p>
                <p className="text-xs text-muted-foreground">Ürün ve müşteri kartlarında kullanılacak liste etiketleri.</p>
              </div>
              {priceLists.map((priceList, index) => (
                <div key={priceList.key} className="grid gap-2 md:grid-cols-[minmax(120px,0.8fr)_minmax(180px,1.4fr)_auto_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>Kod</Label>
                    <Input
                      value={priceList.key}
                      onChange={(event) => updatePriceList(priceList.key, { key: event.target.value })}
                      disabled={data.settings.role !== 'Admin' || savingSettings}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Etiket</Label>
                    <Input
                      value={priceList.label}
                      onChange={(event) => updatePriceList(priceList.key, { label: event.target.value })}
                      disabled={data.settings.role !== 'Admin' || savingSettings}
                    />
                  </div>
                  <Button
                    type="button"
                    variant={priceList.is_default ? 'default' : 'outline'}
                    disabled={data.settings.role !== 'Admin' || savingSettings}
                    onClick={() => updatePriceList(priceList.key, { is_default: true })}
                  >
                    {priceList.is_default ? 'Varsayılan' : 'Varsayılan yap'}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={data.settings.role !== 'Admin' || savingSettings || priceLists.length <= 1}
                    onClick={() => removePriceList(priceList.key)}
                    title="Fiyat listesini sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {index === 0 ? <p className="text-xs text-muted-foreground md:col-span-4">Varsayılan liste yeni müşteri ve teklifler için otomatik seçilir.</p> : null}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addPriceList} disabled={data.settings.role !== 'Admin' || savingSettings}>
                <Plus className="mr-2 h-4 w-4" />
                Fiyat listesi ekle
              </Button>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Hizmet KDV oranı</p>
                <p className="text-xs text-muted-foreground">Teklif ve sözleşme çıktılarındaki HİZMETLER tablosunda kullanılacak genel KDV oranı.</p>
              </div>
              <div className="max-w-xs space-y-2">
                <Label>Hizmet KDV %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={serviceExpenseTaxRate}
                  onChange={(event) => setServiceExpenseTaxRate(normalizeServiceExpenseTaxRate(event.target.value))}
                  disabled={data.settings.role !== 'Admin' || savingSettings}
                />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Ödeme tipleri</p>
                <p className="text-xs text-muted-foreground">Teklif oluşturma ekranında seçim olarak görünür; manuel giriş seçeneği ayrıca kalır.</p>
              </div>
              {paymentOptions.map((option, index) => (
                <div key={`payment-option-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>{index + 1}. ödeme tipi</Label>
                    <Input
                      value={option}
                      onChange={(event) => updatePaymentOption(index, event.target.value)}
                      disabled={data.settings.role !== 'Admin' || savingSettings}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={data.settings.role !== 'Admin' || savingSettings || paymentOptions.length <= 1}
                    onClick={() => removePaymentOption(index)}
                    title="Ödeme tipini sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addPaymentOption} disabled={data.settings.role !== 'Admin' || savingSettings}>
                <Plus className="mr-2 h-4 w-4" />
                Ödeme tipi ekle
              </Button>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Belge koşulları</p>
                <p className="text-xs text-muted-foreground">Yeni oluşturulan teklif ve sözleşmeler bu metinleri ayrı ayrı varsayılan koşul olarak kullanır. Her dolu satır çıktıda ayrı koşul satırı olur.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-3">
                  <Label>Teklif koşulları</Label>
                  <Textarea
                    rows={10}
                    value={quoteTermsText}
                    onChange={(event) => setQuoteTermsText(event.target.value)}
                    disabled={data.settings.role !== 'Admin' || savingSettings}
                  />
                  <p className="text-xs text-muted-foreground">Teklif PDF/Excel çıktılarında TEKLİF KOŞULLARI başlığı altında görünür.</p>
                </div>
                <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-3">
                  <Label>Sözleşme koşulları</Label>
                  <Textarea
                    rows={10}
                    value={contractTermsText}
                    onChange={(event) => setContractTermsText(event.target.value)}
                    disabled={data.settings.role !== 'Admin' || savingSettings}
                  />
                  <p className="text-xs text-muted-foreground">Sözleşme PDF/Excel çıktılarında SÖZLEŞME KOŞULLARI başlığı altında görünür.</p>
                </div>
              </div>
            </div>
            <RbacGuard perm="quotes.edit">
              <Button
                onClick={async () => {
                  setSavingSettings(true)
                  try {
                    const response = await api.patch('/auth/organization-settings/', {
                      price_lists: priceLists,
                      payment_options: paymentOptions,
                      service_expense_tax_rate: serviceExpenseTaxRate,
                      quote_terms_text: quoteTermsText,
                      contract_terms_text: contractTermsText,
                    })
                    setPriceLists(normalizePriceLists(response.data?.price_lists))
                    setPaymentOptions(normalizePaymentOptions(response.data?.payment_options))
                    setServiceExpenseTaxRate(normalizeServiceExpenseTaxRate(response.data?.service_expense_tax_rate))
                    setQuoteTermsText(response.data?.quote_terms_text || DEFAULT_DOCUMENT_TERMS_TEXT)
                    setContractTermsText(response.data?.contract_terms_text || DEFAULT_DOCUMENT_TERMS_TEXT)
                    toast({
                      title: 'Belge sabitleri güncellendi',
                      description: `${getDefaultPriceList(response.data?.price_lists).label}, ödeme tipleri ve koşullar yeni belgelerde kullanılacak.`,
                    })
                  } catch (error: any) {
                    toast({
                      title: 'Ayar kaydedilemedi',
                      description: error?.response?.data?.detail || 'Fiyat listesi etiketi güncellenemedi.',
                      variant: 'destructive',
                    })
                  } finally {
                    setSavingSettings(false)
                  }
                }}
                disabled={data.settings.role !== 'Admin' || savingSettings}
              >
                {savingSettings ? 'Kaydediliyor...' : 'Belge sabitlerini kaydet'}
              </Button>
            </RbacGuard>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Dinamik placeholder rehberi</CardTitle>
            <CardDescription>
              Excel şablonuna süslü parantez ile placeholder yazabilirsiniz. Sistem dışa aktarım sırasında bunları otomatik doldurur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              Örnek kullanım: bir hücreye {'{'}cariUnvani{'}'} veya {'{'}saticiFirma1.banka1.iban{'}'} yazın. Şablonu sisteme yüklediğinizde belge oluşturulurken gerçek verilerle yer değiştirir.
            </div>
            <div className="space-y-4">
              {placeholderGroups.map((group) => (
                <div key={group.group} className="rounded-lg border border-border/70 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{group.group}</p>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {group.items.map((item) => (
                      <div key={item.token} className="rounded-md border border-border/60 bg-background/40 p-3">
                        <p className="font-mono text-xs text-primary">{item.token}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xltx,.xlsm"
          className="hidden"
          onChange={handleUploadChange}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Şablonlar yükleniyor...</p>
        ) : (
          <>
            {fallbackSellerTemplateGroups.map((sellerGroup) => {
              const template = sellerGroup.master_template || { ...DEFAULT_MASTER_TEMPLATE_ITEM, seller_company_key: sellerGroup.seller_company_key }
              const templateUploadKey = `${sellerGroup.seller_company_key}:${template.template_key}`
              return (
                <section key={sellerGroup.seller_company_key} className="space-y-4 rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{sellerGroup.seller_short_name || sellerGroup.seller_company_key}</h3>
                      <p className="text-xs text-muted-foreground">
                        {sellerGroup.seller_display_name || sellerGroup.seller_company_key} için tek ana Excel şablonu. Logo için {'{'}saticiLogo{'}'}, ürün tabloları için {'{'}urunGruplari{'}'} alanını kullanın.
                      </p>
                    </div>
                    <Badge variant={template.has_custom ? 'default' : 'secondary'}>
                      {template.has_custom ? 'Firma şablonu yüklü' : 'Varsayılan ana şablon'}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <p className="font-medium">Ana Excel şablonu</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Varsayılan dosya: {template.default_filename}</p>
                          <p>Kullanılan dosya: {template.current_filename}</p>
                          <p>Logo noktası: {'{'}saticiLogo{'}'}</p>
                          <p>Dinamik tablo noktası: {'{'}urunGruplari{'}'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadTemplateFile(template.template_key, 'default', template.default_filename, sellerGroup.seller_company_key)
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Varsayılanı indir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadTemplateFile(template.template_key, 'current', template.current_filename, sellerGroup.seller_company_key)
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Kullanılanı indir
                        </Button>
                        <RbacGuard perm="quotes.edit">
                          <Button
                            size="sm"
                            onClick={() => openUploadPicker(template.template_key, sellerGroup.seller_company_key)}
                            disabled={uploadingKey === templateUploadKey}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {uploadingKey === templateUploadKey ? 'Yükleniyor...' : 'Şablon yükle'}
                          </Button>
                        </RbacGuard>
                      </div>
                    </div>
                  </div>
                </section>
              )
            })}
            {fallbackSellerTemplateGroups.length === 0 && (
              <p className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Aktif satıcı firma bulunamadı. Önce Satıcı Firmalar sayfasından firma ekleyin.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
