import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { getCompanyCurrencyOptions, resolveCompanyCurrency, type SupportedCurrencyCode } from '@/lib/location-data'
import { formatCurrency, formatExchangeRate, getCurrencySymbol, normalizeCurrency, cn } from '@/lib/utils'
import type { Company, Quote } from '@/types'
import {
  type QuoteTemplateId,
  type MobilyaSubListId,
  MOBILYA_SUB_LIST_META,
  computeTemplateLines,
  excelGrandTotals,
  quoteTemplateById,
  rowsForLine,
  patchLineFromPriceRow,
  sumLinesExVat,
  type TemplateLineInput,
  QUOTE_EXCEL_TEMPLATES,
} from '@/lib/quote-excel-template'
import {
  ERP_BOILERPLATE_TR,
  STANDARD_QUOTE_NOTES_COLUMN_TR,
  STANDARD_QUOTE_TERMS_KDV10_TR,
  STANDARD_QUOTE_TERMS_KDV20_TR,
  formatTermsBlock,
} from '@/lib/quote-template-legal'
import { Checkbox } from '@/components/ui/checkbox'
import {
  IBAN_BLOCK_AYKA,
  IBAN_BLOCK_ORTKA,
  INTERNAL_SELLERS,
  QUOTE_PREPARER_OPTIONS,
  type InternalSellerKey,
  formatSellerBlock,
} from '@/lib/quote-template-parties'
import { FileSpreadsheet, Plus } from 'lucide-react'

function emptyLine(over?: Partial<TemplateLineInput>): TemplateLineInput {
  return {
    code: '',
    measure: '',
    color: '',
    qty: 0,
    disc1: 0,
    disc2: 0,
    unit: 'Adet',
    manualListPrice: 0,
    manualLineName: '',
    ...over,
  }
}

function emptyLines(count: number, factory?: (i: number) => Partial<TemplateLineInput>) {
  return Array.from({ length: count }, (_, i) => emptyLine(factory?.(i)))
}

export function TemplateQuoteWizardTrigger({
  companies,
}: {
  companies: Company[]
}) {
  const createQuote = useAppStore((s) => s.createQuote)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  const [templateId, setTemplateId] = useState<QuoteTemplateId>('celik_kapi')
  const template = quoteTemplateById(templateId)

  const [customerId, setCustomerId] = useState(companies[0]?.id ?? '')
  const [currency, setCurrency] = useState<SupportedCurrencyCode>(() =>
    resolveCompanyCurrency(companies[0]?.currency, companies[0]?.country)
  )
  const [exchangeRate, setExchangeRate] = useState(() =>
    resolveCompanyCurrency(companies[0]?.currency, companies[0]?.country) === 'TRY' ? 1 : 1
  )
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
  const [priceListRef, setPriceListRef] = useState('2026/1. LİSTE')
  const [validityWorkDays, setValidityWorkDays] = useState<'3' | '7' | '10'>('7')
  const [lines, setLines] = useState<TemplateLineInput[]>(() => emptyLines(quoteTemplateById('celik_kapi').maxTableLines))

  const [teslimSekli, setTeslimSekli] = useState('')
  const [odemeSekli, setOdemeSekli] = useState('')
  const [teslimSuresi, setTeslimSuresi] = useState('')
  const [montajHizmeti, setMontajHizmeti] = useState('')
  const [nakliye, setNakliye] = useState('')
  const [gecerlilikAciklama, setGecerlilikAciklama] = useState('')

  const [sellingEntity, setSellingEntity] = useState<InternalSellerKey>('ortka')
  const [signingEntity, setSigningEntity] = useState<InternalSellerKey>('ayka')
  const [selectedPreparers, setSelectedPreparers] = useState<Record<string, boolean>>({})
  const [salesRepArea, setSalesRepArea] = useState('')
  const [buyerUnvan, setBuyerUnvan] = useState('')
  const [buyerVergi, setBuyerVergi] = useState('')
  const [buyerAdres, setBuyerAdres] = useState('')
  const [buyerYetkili, setBuyerYetkili] = useState('')
  const [buyerIletisim, setBuyerIletisim] = useState('')
  const [technicalSpecsText, setTechnicalSpecsText] = useState('')
  const [ibanInNotes, setIbanInNotes] = useState<'ortka' | 'ayka' | 'both'>('both')
  const [includeErpBoilerplate, setIncludeErpBoilerplate] = useState(true)
  const [includeStandardTerms, setIncludeStandardTerms] = useState(true)
  const [includeNotesColumn, setIncludeNotesColumn] = useState(false)
  /** Kod combobox: hangi satırın listesi açık (dialog içinde tek popover). */
  const [codePickerRow, setCodePickerRow] = useState<number | null>(null)
  /** cmdk Dialog içinde güvenilir değil; manuel liste + bu filtre. */
  const [codePickerFilter, setCodePickerFilter] = useState('')
  const selectedCompany = useMemo(() => companies.find((company) => company.id === customerId), [companies, customerId])
  const selectedCompanyCurrencyOptions = useMemo(
    () => getCompanyCurrencyOptions(selectedCompany?.country),
    [selectedCompany?.country]
  )
  const effectiveCurrency = normalizeCurrency(currency)

  const syncTemplate = (id: QuoteTemplateId) => {
    setTemplateId(id)
    const t = quoteTemplateById(id)
    if (id === 'mobilya') {
      setLines(
        emptyLines(9, (i) => ({
          mobilyaSubList: i < 3 ? 'mutfak' : i < 6 ? 'portmanto' : 'banyo',
          unit: i < 3 ? 'Metre' : i < 6 ? 'm²' : 'Adet',
        }))
      )
    } else {
      setLines(emptyLines(t.maxTableLines))
    }
    if (!teslimSekli.trim()) setTeslimSekli(t.defaultDeliveryGroupLabel)
  }

  useEffect(() => {
    if (!selectedCompany) return

    const preferredCurrency = resolveCompanyCurrency(selectedCompany.currency, selectedCompany.country)
    setCurrency(preferredCurrency)
    setExchangeRate((currentRate) => (preferredCurrency === 'TRY' ? 1 : currentRate > 0 ? currentRate : 1))
  }, [selectedCompany?.country, selectedCompany?.currency, selectedCompany?.id])

  const computed = useMemo(() => computeTemplateLines(template, lines), [template, lines])
  const subEx = sumLinesExVat(computed)
  const totals = excelGrandTotals(subEx, template.vatRate)

  const pickerContextLine = codePickerRow !== null ? lines[codePickerRow] : null
  const pickerPriceRows = useMemo(() => {
    if (!pickerContextLine) return []
    return rowsForLine(template, pickerContextLine)
  }, [template, pickerContextLine])

  const filteredPickerRows = useMemo(() => {
    const q = codePickerFilter.trim().toLowerCase()
    if (!q) return pickerPriceRows
    return pickerPriceRows.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    )
  }, [pickerPriceRows, codePickerFilter])

  const updateLine = (idx: number, patch: Partial<TemplateLineInput>) => {
    setLines((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const handleSubmit = () => {
    const activeLines = computed.filter((l) => {
      if (!l.qty || l.qty <= 0) return false
      if (template.id === 'mobilya' && l.mobilyaSubList === 'banyo')
        return l.lineTotalExVat > 0
      return !!l.code.trim()
    })
    if (activeLines.length === 0) {
      toast({
        title: 'Satır gerekli',
        description:
          template.id === 'mobilya'
            ? 'En az bir satırda miktar girin; mutfak/portmanto için kod, banyo için ürün adı ve liste fiyatı.'
            : 'En az bir satırda kod seçip miktar > 0 girin.',
        variant: 'destructive',
      })
      return
    }
    if (!customerId) {
      toast({ title: 'Müşteri seçin', variant: 'destructive' })
      return
    }

    const preparersLine = QUOTE_PREPARER_OPTIONS.filter((p) => selectedPreparers[p.id])
      .map((p) => p.label)
      .join(' | ')

    const ibanSection =
      ibanInNotes === 'both'
        ? `--- ORTKA IBAN özeti ---\n${IBAN_BLOCK_ORTKA}\n--- AYKA IBAN özeti ---\n${IBAN_BLOCK_AYKA}`
        : ibanInNotes === 'ortka'
          ? IBAN_BLOCK_ORTKA
          : IBAN_BLOCK_AYKA

    const standardTermsLines = template.id === 'mobilya' ? STANDARD_QUOTE_TERMS_KDV10_TR : STANDARD_QUOTE_TERMS_KDV20_TR

    const notesParts: string[] = [
      `Şablon (Excel uyumlu): ${template.label}`,
      `Teklif no ön eki (Excel): ${template.numberPrefix}<zaman damgası>`,
      `KDV oranı (şablon): %${template.vatPercent}`,
      `Fiyat listesi: ${priceListRef}`,
      `Geçerlilik: teklif tarihinden ${validityWorkDays} iş günü`,
      `---`,
    ]

    if (includeErpBoilerplate) {
      notesParts.push(`=== ERP / SİSTEM NOTU ===`, ERP_BOILERPLATE_TR, `---`)
    }
    if (includeStandardTerms) {
      notesParts.push(formatTermsBlock(standardTermsLines, '=== GENEL ŞARTLAR & TEKLİF NOTLARI (şablona uyumlu) ==='), `---`)
    }
    if (includeNotesColumn) {
      notesParts.push(
        formatTermsBlock(STANDARD_QUOTE_NOTES_COLUMN_TR, '=== TEKLİF NOTLARI (Excel sağ sütun özeti) ==='),
        `---`
      )
    }

    notesParts.push(
      `=== TARAFLAR (Excel) ===`,
      `Satışı yapan şirket (seçim): ${INTERNAL_SELLERS[sellingEntity].title}`,
      `Satış şirketi detay:\n${formatSellerBlock(sellingEntity)}`,
      `Kaşe / imza tarafı (Excel): ${INTERNAL_SELLERS[signingEntity].title} adına`,
      `Hazırlayan (işaretlenenler, satır 31): ${preparersLine || '—'}`,
      `Satış temsilcisi bilgi alanı (satır 29): ${salesRepArea || '—'}`,
      `--- ALICI BİLGİLERİ (satır 23–27) ---`,
      `Cari ünvanı: ${buyerUnvan || '—'}`,
      `Vergi dairesi / no: ${buyerVergi || '—'}`,
      `Adres: ${buyerAdres || '—'}`,
      `Yetkili: ${buyerYetkili || '—'}`,
      `Telefon / e-posta: ${buyerIletisim || '—'}`,
      `--- Teknik özellik / temsilci metni (şablon gövdesi) ---`,
      technicalSpecsText.trim() || '—',
      `---`,
      `Teslim şekli: ${teslimSekli || '—'}`,
      `Ödeme şekli: ${odemeSekli || '—'}`,
      `Teslim süresi: ${teslimSuresi || '—'}`,
      `Montaj: ${montajHizmeti || '—'}`,
      `Nakliye: ${nakliye || '—'}`,
      `Geçerlilik notu: ${gecerlilikAciklama || '—'}`,
      `---`,
      `=== İBAN (Excel satır 77–83, seçime göre) ===`,
      ibanSection,
      `---`,
      `Para birimi: ${getCurrencySymbol(effectiveCurrency)}`,
      `Kur: ${formatExchangeRate(exchangeRate, effectiveCurrency)}`,
      `Ara toplam (KDV hariç): ${formatCurrency(totals.subtotalExVat, effectiveCurrency)}`,
      `KDV %${template.vatPercent}: ${formatCurrency(totals.vat, effectiveCurrency)}`,
      `Yekün: ${formatCurrency(totals.grand, effectiveCurrency)}`
    )

    const lineLabel = (l: (typeof activeLines)[0]) => {
      const grp =
        template.id === 'mobilya'
          ? ` [${l.mobilyaSubList === 'mutfak' ? 'Mutfak' : l.mobilyaSubList === 'portmanto' ? 'Portmanto' : 'Banyo'}]`
          : ''
      if (template.id === 'mobilya' && l.mobilyaSubList === 'banyo') {
        return `${l.manualLineName || l.salesUnitName}${grp} | Gövde:${l.measure || '—'} | Kapak:${l.color || '—'} | Birim:${l.unit}`
      }
      return `${l.code} — ${l.salesUnitName}${grp} | Ölçü/Gövde:${l.measure || '—'} | Renk:${l.color || '—'} | Birim:${l.unit}`
    }

    const payload = {
      customerId,
      validUntil: validUntil || null,
      payment: odemeSekli || '—',
      delivery: teslimSekli || '—',
      notes: notesParts.join('\n'),
      status: 'Draft' as const,
      currency: effectiveCurrency,
      contractConfig: {
        exchangeRate: effectiveCurrency === 'TRY' ? 1 : exchangeRate,
      },
      vatRate: template.vatPercent,
      lines: activeLines.map((l) => ({
        name: lineLabel(l),
        qty: l.qty,
        unitPrice: l.netUnit,
        discount: 0,
        tax: 0,
      })),
    }

    createQuote(payload as unknown as Quote)
    toast({
      title: 'Teklif kaydedildi',
      description: `${template.label} • KDV %${template.vatPercent} • Yekün ${formatCurrency(totals.grand, effectiveCurrency)}`,
    })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setCodePickerRow(null)
          setCodePickerFilter('')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" type="button">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Şablon teklif
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Şablon teklif (TASLAKLAR Excel mantığı)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Çelik, iç oda, montaj ve mobilya (mutfak / portmanto / banyo) şablonları; liste fiyatları TASLAKLAR analizinden. Mobilya teklifinde KDV
          %10; diğerlerinde %20. Standart şart paragrafları ve Excel (.xlsx) indirme desteklenir.
        </p>
        <Tabs defaultValue="setup">
          <TabsList className="mb-3 grid grid-cols-5 w-full gap-1">
            <TabsTrigger value="setup" className="text-xs px-1 sm:text-sm sm:px-2">
              Şablon
            </TabsTrigger>
            <TabsTrigger value="parties" className="text-xs px-1 sm:text-sm sm:px-2">
              Taraflar
            </TabsTrigger>
            <TabsTrigger value="lines" className="text-xs px-1 sm:text-sm sm:px-2">
              Kalemler
            </TabsTrigger>
            <TabsTrigger value="terms" className="text-xs px-1 sm:text-sm sm:px-2">
              Şartlar
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs px-1 sm:text-sm sm:px-2">
              Özet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Teklif şablonu</Label>
                <Select value={templateId} onValueChange={(v) => syncTemplate(v as QuoteTemplateId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_EXCEL_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} ({t.productGroupTitle})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Müşteri</Label>
                <Select
                  value={customerId}
                  onValueChange={(id) => {
                    setCustomerId(id)
                    const c = companies.find((x) => x.id === id)
                    if (c?.name) setBuyerUnvan(c.name)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Para birimi</Label>
                <Select
                  value={effectiveCurrency}
                  onValueChange={(nextCurrency) => {
                    const normalizedCurrency = normalizeCurrency(nextCurrency)
                    setCurrency(normalizedCurrency as SupportedCurrencyCode)
                    if (normalizedCurrency === 'TRY') {
                      setExchangeRate(1)
                    } else if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
                      setExchangeRate(1)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCompanyCurrencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{`Kur (${getCurrencySymbol(effectiveCurrency)} -> ₺)`}</Label>
                <Input
                  type="number"
                  min={1}
                  step="0.0001"
                  disabled={effectiveCurrency === 'TRY'}
                  value={effectiveCurrency === 'TRY' ? 1 : exchangeRate}
                  onChange={(event) => setExchangeRate(Number(event.target.value || 1))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {effectiveCurrency === 'TRY'
                    ? 'Türk Lirası seçildiğinde kur 1 kabul edilir.'
                    : formatExchangeRate(exchangeRate, effectiveCurrency)}
                </p>
              </div>
              <div>
                <Label>Geçerlilik (takvim)</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
              <div>
                <Label>Fiyat listesi referansı (Excel «F.LİSTESİ»)</Label>
                <Input value={priceListRef} onChange={(e) => setPriceListRef(e.target.value)} placeholder="2026/1. LİSTE : …" />
              </div>
              <div>
                <Label>İş günü geçerliliği (Excel satır 32)</Label>
                <Select value={validityWorkDays} onValueChange={(v) => setValidityWorkDays(v as '3' | '7' | '10')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 iş günü</SelectItem>
                    <SelectItem value="7">7 iş günü</SelectItem>
                    <SelectItem value="10">10 iş günü</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parties" className="space-y-4 max-h-[min(520px,60vh)] overflow-y-auto pr-1">
            <div className="rounded-md border bg-muted/20 p-3 space-y-3">
              <p className="text-sm font-medium">Satıcı (Excel «SATIŞ ŞİRKETİ» — iki kolondan biri)</p>
              <div className="flex flex-wrap gap-2">
                {(['ortka', 'ayka'] as const).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={sellingEntity === key ? 'default' : 'outline'}
                    onClick={() => setSellingEntity(key)}
                  >
                    {INTERNAL_SELLERS[key].title}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{formatSellerBlock(sellingEntity)}</p>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <Label>Kaşe / imza hangi firma adına (Excel imza bloğu)</Label>
              <div className="flex flex-wrap gap-2">
                {(['ortka', 'ayka'] as const).map((key) => (
                  <Button
                    key={`sig-${key}`}
                    type="button"
                    size="sm"
                    variant={signingEntity === key ? 'secondary' : 'outline'}
                    onClick={() => setSigningEntity(key)}
                  >
                    {key === 'ortka' ? 'ORTKA adına' : 'AYKA adına'}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-sm font-medium">Hazırlayan (Excel satır 31 — çoklu işaretleme)</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {QUOTE_PREPARER_OPTIONS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!selectedPreparers[p.id]}
                      onCheckedChange={(v) =>
                        setSelectedPreparers((prev) => ({ ...prev, [p.id]: v === true }))
                      }
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Satış temsilcisi bilgi alanı (Excel satır 29)</Label>
              <Textarea
                value={salesRepArea}
                onChange={(e) => setSalesRepArea(e.target.value)}
                placeholder="Temsilci iletişim, bölge, not..."
                rows={2}
              />
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Alıcı bilgileri (Excel satır 23–27)</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    const c = companies.find((x) => x.id === customerId)
                    if (c) {
                      setBuyerUnvan(c.name)
                      setBuyerVergi([c.taxOffice, c.taxNumber].filter(Boolean).join(' / '))
                      setBuyerAdres(c.address || `${c.region || ''} • ${c.industry || ''}`.trim())
                      setBuyerYetkili(c.authorizedPerson || '')
                      setBuyerIletisim([c.phone, c.email].filter(Boolean).join(' / '))
                    }
                  }}
                >
                  Müşteri kartından doldur
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label className="text-xs">Cari ünvanı</Label>
                  <Input value={buyerUnvan} onChange={(e) => setBuyerUnvan(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Vergi dairesi / no</Label>
                  <Input value={buyerVergi} onChange={(e) => setBuyerVergi(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Adres</Label>
                  <Textarea value={buyerAdres} onChange={(e) => setBuyerAdres(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Yetkili</Label>
                  <Input value={buyerYetkili} onChange={(e) => setBuyerYetkili(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Telefon / e-posta</Label>
                  <Input value={buyerIletisim} onChange={(e) => setBuyerIletisim(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label>Teknik özellikler / temsilci açıklaması (örn. çelik şablonda satır 44–48)</Label>
              <Textarea
                value={technicalSpecsText}
                onChange={(e) => setTechnicalSpecsText(e.target.value)}
                placeholder="Her satırı Enter ile ayırabilirsiniz (Excel’deki madde işaretli metinler)."
                rows={5}
              />
            </div>

            <div>
              <Label>İBAN bilgisi notlarda</Label>
              <Select value={ibanInNotes} onValueChange={(v) => setIbanInNotes(v as 'ortka' | 'ayka' | 'both')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ortka">Yalnızca ORTKA hesapları</SelectItem>
                  <SelectItem value="ayka">Yalnızca AYKA hesapları</SelectItem>
                  <SelectItem value="both">Her iki kolon (Excel’deki gibi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="lines" className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Ürün grubu: <strong>{template.productGroupTitle}</strong> • En fazla {template.maxTableLines} satır (şablona uygun).
                {template.id === 'mobilya'
                  ? ' Her satırda mutfak, portmanto veya banyo alt listesi seçilir; banyoda şimdilik manuel liste fiyatı girin.'
                  : ''}
              </p>
              <p>
                Kod seçince: <strong>liste fiyatı</strong> ve tutarlar otomatik hesaplanır; <strong>birim</strong> şablona göre (mobilyada alt listeye
                göre) ve <strong>miktar</strong> boşsa 1 yapılır. Ölçü/kapak için listede ayrı kolon yok; ürün adından (m², kasa ölçüsü, Membran/Lake
                vb.) çıkarılabilenler doldurulur. <strong>İskonto</strong> yüzdeleri listede yok, satırdan elle girilir.
              </p>
            </div>
            <ScrollArea className="h-[min(480px,55vh)] rounded-md border">
              <div className="min-w-[920px] p-2 space-y-3">
                <div className="grid grid-cols-12 gap-1 text-[10px] font-medium text-muted-foreground px-1">
                  {template.id === 'mobilya' ? <span className="col-span-2">Alt liste</span> : <span className="col-span-2" />}
                  <span className="col-span-2">Kod</span>
                  <span className="col-span-2">Ölçü / gövde</span>
                  <span className="col-span-1">Renk / kapak</span>
                  <span className="col-span-1">Miktar</span>
                  <span className="col-span-1">İsk1%</span>
                  <span className="col-span-1">İsk2%</span>
                  <span className="col-span-1">Birim</span>
                  <span className="col-span-1">Tutar</span>
                </div>
                {lines.map((line, idx) => {
                  const c = computed[idx]
                  const showBanyoManual = template.id === 'mobilya' && line.mobilyaSubList === 'banyo'
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-start border-b border-border/60 pb-2">
                      {template.id === 'mobilya' ? (
                        <div className="col-span-2">
                          <Select
                            value={line.mobilyaSubList || 'mutfak'}
                            onValueChange={(v) => {
                              const sub = v as MobilyaSubListId
                              const meta = MOBILYA_SUB_LIST_META.find((m) => m.id === sub)
                              updateLine(idx, {
                                mobilyaSubList: sub,
                                code: '',
                                manualLineName: '',
                                manualListPrice: 0,
                                unit: meta?.defaultUnit ?? 'Adet',
                              })
                            }}
                          >
                            <SelectTrigger className="h-8 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MOBILYA_SUB_LIST_META.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="col-span-2" />
                      )}
                      <div className="col-span-2 space-y-1">
                        {!showBanyoManual ? (
                          <Popover
                            open={codePickerRow === idx}
                            onOpenChange={(v) => {
                              if (v) {
                                setCodePickerRow(idx)
                                setCodePickerFilter('')
                              } else {
                                setCodePickerRow(null)
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn('w-full justify-start font-mono text-xs truncate', !line.code && 'text-muted-foreground')}
                                type="button"
                              >
                                {line.code || 'Kod seç…'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="p-0 w-[340px]"
                              align="start"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              {codePickerRow === idx ? (
                                <>
                                  <div className="border-b border-border p-2">
                                    <Input
                                      className="h-9 text-sm"
                                      placeholder="Kod veya ürün ara…"
                                      value={codePickerFilter}
                                      onChange={(e) => setCodePickerFilter(e.target.value)}
                                      autoComplete="off"
                                    />
                                  </div>
                                  <div className="max-h-56 overflow-y-auto p-1">
                                    {filteredPickerRows.length === 0 ? (
                                      <p className="py-6 text-center text-sm text-muted-foreground">Kayıt yok</p>
                                    ) : (
                                      filteredPickerRows.map((r) => (
                                        <button
                                          key={`${line.mobilyaSubList || 'x'}-${r.code}`}
                                          type="button"
                                          className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-left text-xs outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                          onClick={() => {
                                            const cur = lines[idx]
                                            if (!cur) return
                                            updateLine(idx, patchLineFromPriceRow(template, cur, r))
                                            setCodePickerRow(null)
                                            setCodePickerFilter('')
                                          }}
                                        >
                                          <span className="shrink-0 font-mono">{r.code}</span>
                                          <span className="min-w-0 flex-1 break-words">{r.name}</span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </>
                              ) : null}
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <p className="text-[10px] text-muted-foreground px-1">Banyo: liste boş — manuel</p>
                        )}
                        {showBanyoManual && (
                          <Input
                            className="h-8 text-xs"
                            placeholder="Ürün / satış birimi"
                            value={line.manualLineName}
                            onChange={(e) => updateLine(idx, { manualLineName: e.target.value })}
                          />
                        )}
                      </div>
                      <div className="col-span-2">
                        <Input
                          className="h-8 text-xs"
                          value={line.measure}
                          onChange={(e) => updateLine(idx, { measure: e.target.value })}
                          placeholder={template.id === 'mobilya' ? 'Gövde' : 'Ölçü'}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          className="h-8 text-xs"
                          value={line.color}
                          onChange={(e) => updateLine(idx, { color: e.target.value })}
                          placeholder={template.id === 'mobilya' ? 'Kapak' : 'Renk'}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          min={0}
                          step="any"
                          value={line.qty || ''}
                          onChange={(e) => updateLine(idx, { qty: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          min={0}
                          value={line.disc1 || ''}
                          onChange={(e) => updateLine(idx, { disc1: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          min={0}
                          value={line.disc2 || ''}
                          onChange={(e) => updateLine(idx, { disc2: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Select value={line.unit} onValueChange={(v) => updateLine(idx, { unit: v })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Adet">Adet</SelectItem>
                            <SelectItem value="Metre">Metre</SelectItem>
                            <SelectItem value="m²">m²</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 text-[10px] text-muted-foreground leading-tight">
                        {showBanyoManual && (
                          <Input
                            className="h-8 text-xs mb-1"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Liste"
                            value={line.manualListPrice || ''}
                            onChange={(e) => updateLine(idx, { manualListPrice: Number(e.target.value) || 0 })}
                          />
                        )}
                        Net: {c.netUnit ? formatCurrency(c.netUnit, effectiveCurrency) : '—'}
                        <br />
                        <span className="text-foreground font-medium">
                          {c.lineTotalExVat ? formatCurrency(c.lineTotalExVat, effectiveCurrency) : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="terms" className="grid gap-3">
            <div className="rounded-md border bg-muted/20 p-3 space-y-3">
              <p className="text-sm font-medium">Notlara eklenecek standart metinler</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={includeErpBoilerplate} onCheckedChange={(v) => setIncludeErpBoilerplate(v === true)} />
                Mikro ERP / üretim bildirimi paragrafı
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={includeStandardTerms} onCheckedChange={(v) => setIncludeStandardTerms(v === true)} />
                Genel şartlar ({template.id === 'mobilya' ? 'KDV %10 şablonu' : 'KDV %20 şablonu'})
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={includeNotesColumn} onCheckedChange={(v) => setIncludeNotesColumn(v === true)} />
                Teklif notları (ölçü / teyit maddeleri)
              </label>
            </div>
            <div>
              <Label>Teslim şekli</Label>
              <Input value={teslimSekli} onChange={(e) => setTeslimSekli(e.target.value)} placeholder={template.defaultDeliveryGroupLabel} />
            </div>
            <div>
              <Label>Ödeme şekli</Label>
              <Input value={odemeSekli} onChange={(e) => setOdemeSekli(e.target.value)} />
            </div>
            <div>
              <Label>Teslim süresi</Label>
              <Input value={teslimSuresi} onChange={(e) => setTeslimSuresi(e.target.value)} />
            </div>
            <div>
              <Label>Montaj hizmeti</Label>
              <Input value={montajHizmeti} onChange={(e) => setMontajHizmeti(e.target.value)} />
            </div>
            <div>
              <Label>Nakliye</Label>
              <Input value={nakliye} onChange={(e) => setNakliye(e.target.value)} />
            </div>
            <div>
              <Label>Geçerlilik / ek not</Label>
              <Textarea value={gecerlilikAciklama} onChange={(e) => setGecerlilikAciklama(e.target.value)} rows={3} />
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-3 text-sm">
            <div className="rounded-md border p-3 space-y-2 text-xs">
              <p className="font-medium text-sm text-foreground">Taraflar özeti</p>
              <p>
                <span className="text-muted-foreground">Satışı yapan:</span> {INTERNAL_SELLERS[sellingEntity].title}
              </p>
              <p>
                <span className="text-muted-foreground">İmza tarafı:</span> {INTERNAL_SELLERS[signingEntity].title}
              </p>
              <p>
                <span className="text-muted-foreground">Hazırlayan:</span>{' '}
                {QUOTE_PREPARER_OPTIONS.filter((p) => selectedPreparers[p.id])
                  .map((p) => p.label)
                  .join(', ') || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Alıcı ünvan:</span> {buyerUnvan || '—'}
              </p>
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <p>
                <span className="text-muted-foreground">Şablon:</span> {template.label}
              </p>
              <p>
                <span className="text-muted-foreground">Müşteri (kart):</span>{' '}
                {companies.find((c) => c.id === customerId)?.name ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Para birimi:</span> {getCurrencySymbol(effectiveCurrency)}
              </p>
              <p>
                <span className="text-muted-foreground">Kur:</span> {formatExchangeRate(exchangeRate, effectiveCurrency)}
              </p>
              <p>
                <span className="text-muted-foreground">Ara toplam (KDV hariç):</span>{' '}
                {formatCurrency(totals.subtotalExVat, effectiveCurrency)}
              </p>
              <p>
                <span className="text-muted-foreground">KDV %{template.vatPercent}:</span> {formatCurrency(totals.vat, effectiveCurrency)}
              </p>
              <p className="font-semibold text-base">
                <span className="text-muted-foreground font-normal">Yekün:</span> {formatCurrency(totals.grand, effectiveCurrency)}
              </p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
              {computed
                .filter((l) => {
                  if (!l.qty || l.qty <= 0) return false
                  if (template.id === 'mobilya' && l.mobilyaSubList === 'banyo') return l.lineTotalExVat > 0
                  return !!l.code.trim()
                })
                .map((l, li) => (
                  <li key={`${l.mobilyaSubList ?? ''}-${l.code}-${l.manualLineName}-${li}-${l.measure}`}>
                    {(l.code || l.manualLineName || '—') + ` × ${l.qty} ${l.unit}`} →{' '}
                    {formatCurrency(l.lineTotalExVat, effectiveCurrency)} (KDV hariç)
                  </li>
                ))}
            </ul>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            İptal
          </Button>
          <Button type="button" onClick={handleSubmit}>
            <Plus className="mr-2 h-4 w-4" />
            Teklifi kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
