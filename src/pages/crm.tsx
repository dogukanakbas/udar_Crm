// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyModal } from '@/components/company-modal'
import { DataTable } from '@/components/data-table'
import { SearchableCombobox } from '@/components/searchable-combobox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/app-shell'
import { useToast } from '@/components/ui/use-toast'
import { normalizeCompanySize, normalizeCountryLabel } from '@/lib/location-data'
import { downloadCompaniesAsXlsx } from '@/lib/company-export-xlsx'
import { useAppStore } from '@/state/use-app-store'
import { hasPermission } from '@/lib/permissions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Opportunity, Contact as ContactType, Company as CompanyType } from '@/types'
import { BadgeCheck, Download, HandCoins, Plus, Timer, Trash2, Upload } from 'lucide-react'

const contactSchema = z.object({
  companyId: z.string(),
  name: z.string().min(2),
  role: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  phone: z.string().optional().default(''),
  owner: z.string().optional().default(''),
})

const opportunitySchema = z.object({
  name: z.string().min(2),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
  stage: z.string().default('Qualification'),
  value: z.coerce.number().default(0),
  closeDate: z.string().optional(),
})

const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  Qualification: 'Ön değerlendirme',
  Discovery: 'Keşif',
  Proposal: 'Teklif',
  Negotiation: 'Müzakere',
  'Closed Won': 'Kazanıldı',
  'Closed Lost': 'Kaybedildi',
}
const opportunityStageTr = (s: string) => OPPORTUNITY_STAGE_LABELS[s] ?? s

function ContactModal({
  children,
  companies,
  contact,
  onSubmit,
}: {
  children: React.ReactNode
  companies: CompanyType[]
  contact?: ContactType
  onSubmit: (values: z.infer<typeof contactSchema>) => void
}) {
  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema) as any,
    defaultValues: {
      companyId: contact?.companyId ?? companies[0]?.id ?? '',
      name: contact?.name ?? '',
      role: contact?.role ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      owner: contact?.owner ?? '',
    },
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Kişi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ad</Label>
            <Input {...form.register('name')} />
          </div>
          <div>
            <Label>Cari</Label>
            <Select value={form.watch('companyId')} onValueChange={(v) => form.setValue('companyId', v)}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rol</Label>
              <Input {...form.register('role')} />
            </div>
            <div>
              <Label>Sahip</Label>
              <Input {...form.register('owner')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-posta</Label>
              <Input type="email" {...form.register('email')} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input {...form.register('phone')} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
          <Button
            onClick={form.handleSubmit(async (values) => {
              setSubmitError(null)
              try {
                await onSubmit(values)
              } catch (err: any) {
                const detail = err?.response?.data
                if (detail && typeof detail === 'object') {
                  const msg = detail.email?.[0] || detail.name?.[0] || detail.detail || 'Kaydedilemedi'
                  setSubmitError(msg)
                } else {
                  setSubmitError('Kaydedilemedi')
                }
              }
            })}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OpportunityModal({
  children,
  companies,
  onSubmit,
}: {
  children: React.ReactNode
  companies: CompanyType[]
  onSubmit: (values: z.infer<typeof opportunitySchema>) => void
}) {
  const form = useForm<z.infer<typeof opportunitySchema>>({
    resolver: zodResolver(opportunitySchema) as any,
    defaultValues: {
      name: '',
      companyId: companies[0]?.id ?? '',
      stage: 'Qualification',
      value: 0,
    },
  })
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Fırsat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ad</Label>
            <Input {...form.register('name')} />
          </div>
          <div>
            <Label>Cari</Label>
            <Select value={form.watch('companyId')} onValueChange={(v) => form.setValue('companyId', v)}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Aşama</Label>
              <Select value={form.watch('stage')} onValueChange={(v) => form.setValue('stage', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {opportunityStageTr(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Değer</Label>
              <Input type="number" {...form.register('value', { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <Label>Kapanış Tarihi</Label>
            <Input type="date" {...form.register('closeDate')} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={form.handleSubmit(onSubmit)}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export function OpportunitiesPage() {
  const { data, updateOpportunityStage, createOpportunity } = useAppStore()
  const { toast } = useToast()
  const stages: Opportunity['stage'][] = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

  const grouped = stages.map((stage) => ({
    stage,
    items: data.opportunities.filter((o) => o.stage === stage),
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fırsatlar"
        description="Satış hattı aşamalarını yönetin"
        actions={
          <div className="flex items-center gap-2">
            <OpportunityModal
              companies={data.companies}
              onSubmit={(values) => {
                createOpportunity(values as any)
                toast({ title: 'Fırsat oluşturuldu' })
              }}
            >
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Yeni fırsat
              </Button>
            </OpportunityModal>
            <Badge variant="outline">{data.opportunities.length} fırsat</Badge>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map((col) => (
          <Card key={col.stage} className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{opportunityStageTr(col.stage)}</CardTitle>
                <CardDescription>{formatCurrency(col.items.reduce((sum, o) => sum + o.value, 0))}</CardDescription>
              </div>
              <Badge variant="secondary">{col.items.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {col.items.map((opp) => (
                <div key={opp.id} className="rounded-lg border border-border/80 bg-background p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{opp.name}</p>
                    <Badge variant="outline">{opp.owner}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatCurrency(opp.value)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Kapanış {opp.closeDate ? formatDate(opp.closeDate) : '—'}
                    </span>
                  </div>
                  <Select
                    value={opp.stage}
                    onValueChange={(value) => updateOpportunityStage(opp.id, value as Opportunity['stage'])}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {opportunityStageTr(stage)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function CompaniesPage() {
  const { data, createCompany, updateCompany, deleteCompany } = useAppStore()
  const { toast } = useToast()
  const [industryFilter, setIndustryFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [editingCompany, setEditingCompany] = useState<CompanyType | null>(null)
  const canDeletePartners = hasPermission(data.settings.role, data.rolePermissions || [], 'partners.delete')
  const canImportPartners = hasPermission(data.settings.role, data.rolePermissions || [], 'partners.import')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [importingPartners, setImportingPartners] = useState(false)
  const normalizeFilterValue = (value?: string) => value?.trim() ?? ''

  const normalizedCompanies = useMemo(
    () =>
      data.companies.map((company) => ({
        ...company,
        country: normalizeCountryLabel(company.country),
        size: normalizeCompanySize(company.size),
      })),
    [data.companies]
  )

  const getFilterOptions = (companies: CompanyType[], selector: (company: CompanyType) => string | undefined) =>
    Array.from(
      new Set(
        companies
          .map((company) => normalizeFilterValue(selector(company)))
          .filter((value): value is string => Boolean(value))
      )
    ).sort((left, right) => left.localeCompare(right, 'tr'))

  const filterOptions = useMemo(
    () => ({
      industries: getFilterOptions(normalizedCompanies, (company) => company.industry),
      countries: getFilterOptions(normalizedCompanies, (company) => company.country),
      regions: getFilterOptions(
        countryFilter === 'all'
          ? normalizedCompanies
          : normalizedCompanies.filter(
              (company) => normalizeFilterValue(company.country) === countryFilter
            ),
        (company) => company.region
      ),
      sizes: getFilterOptions(normalizedCompanies, (company) => company.size),
    }),
    [countryFilter, normalizedCompanies]
  )

  useEffect(() => {
    if (regionFilter !== 'all' && !filterOptions.regions.includes(regionFilter)) {
      setRegionFilter('all')
    }
  }, [filterOptions.regions, regionFilter])

  const filteredCompanies = useMemo(
    () =>
      normalizedCompanies.filter(
        (company) =>
          (industryFilter === 'all' || normalizeFilterValue(company.industry) === industryFilter) &&
          (countryFilter === 'all' || normalizeFilterValue(company.country) === countryFilter) &&
          (regionFilter === 'all' || normalizeFilterValue(company.region) === regionFilter) &&
          (sizeFilter === 'all' || normalizeFilterValue(company.size) === sizeFilter)
      ),
    [countryFilter, industryFilter, normalizedCompanies, regionFilter, sizeFilter]
  )

  const hasActiveFilters =
    industryFilter !== 'all' ||
    countryFilter !== 'all' ||
    regionFilter !== 'all' ||
    sizeFilter !== 'all'

  const companyStats = useMemo(
    () => ({
      total: data.companies.length,
      taxReady: data.companies.filter((company) => company.taxNumber || company.taxOffice).length,
      contactReady: data.companies.filter((company) => company.phone || company.email || company.address).length,
    }),
    [data.companies]
  )

  const resetFilters = () => {
    setIndustryFilter('all')
    setCountryFilter('all')
    setRegionFilter('all')
    setSizeFilter('all')
  }

  const handleDeleteCompany = async (company: CompanyType) => {
    if (!canDeletePartners) return
    if (!confirm(`${company.name} cari kartı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return
    try {
      await deleteCompany(company.id)
      toast({ title: 'Cari silindi' })
    } catch (error: any) {
      toast({
        title: 'Cari silinemedi',
        description: error?.response?.data?.detail || 'Bu cari ilişkili kayıtlar nedeniyle silinemiyor olabilir.',
        variant: 'destructive',
      })
    }
  }

  const handleBulkDeleteCompanies = async (companies: CompanyType[], clearSelection: () => void) => {
    if (!canDeletePartners || companies.length === 0) return
    if (!confirm(`${companies.length} cari kartı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return
    try {
      for (const company of companies) {
        await deleteCompany(company.id)
      }
      clearSelection()
      toast({ title: 'Cariler silindi', description: `${companies.length} cari silindi.` })
    } catch (error: any) {
      toast({
        title: 'Bazı cariler silinemedi',
        description: error?.response?.data?.detail || 'İlişkili teklif veya sözleşmesi olan cariler silinemez.',
        variant: 'destructive',
      })
    }
  }

  const handleImportPartners = async (file?: File | null) => {
    if (!file || importingPartners) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('update_existing', 'true')
    setImportingPartners(true)
    try {
      const response = await api.post('/partners/import-excel/', formData)
      await useAppStore.getState().hydrateFromApi()
      const result = response.data || {}
      toast({
        title: 'Cari aktarımı tamamlandı',
        description: `${result.created || 0} yeni, ${result.updated || 0} güncellendi, ${result.skipped || 0} atlandı.`,
      })
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        toast({
          title: 'Bazı satırlar aktarılamadı',
          description: `${result.errors.length} satır için hata var. İlk hata: ${result.errors[0]?.detail || 'Bilinmeyen hata'}`,
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === 'string' ? error.response.data : '') ||
        error?.message ||
        'Excel dosyası okunamadı.'
      toast({
        title: 'Cari aktarımı başarısız',
        description: detail,
        variant: 'destructive',
      })
    } finally {
      setImportingPartners(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const columns: ColumnDef<(typeof data.companies)[number]>[] = useMemo(
    () => [
      { accessorKey: 'name', header: 'Cari' },
      { accessorKey: 'industry', header: 'Sektör' },
      { accessorKey: 'authorizedPerson', header: 'Yetkili' },
      {
        accessorKey: 'taxNumber',
        header: 'Vergi',
        cell: ({ row }) => [row.original.taxOffice, row.original.taxNumber].filter(Boolean).join(' / ') || '—',
      },
      {
        accessorKey: 'contact',
        header: 'İletişim',
        cell: ({ row }) => [row.original.phone, row.original.email].filter(Boolean).join(' / ') || '—',
      },
      {
        accessorKey: 'currency',
        header: 'Para birimi',
        cell: ({ row }) => row.original.currency || '—',
      },
      {
        accessorKey: 'location',
        header: 'Konum',
        cell: ({ row }) => [row.original.region, row.original.country].filter(Boolean).join(' / ') || '—',
      },
      {
        accessorKey: 'address',
        header: 'Adres',
        cell: ({ row }) => row.original.address || '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingCompany(row.original)}>
              Düzenle
            </Button>
            {canDeletePartners ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDeleteCompany(row.original)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canDeletePartners]
  )
  return (
    <div className="space-y-4">
      {editingCompany ? (
        <CompanyModal
          company={editingCompany}
          open={Boolean(editingCompany)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingCompany(null)
          }}
          onSubmit={async (values) => {
            await updateCompany(editingCompany.id, values as any)
            toast({ title: 'Cari güncellendi' })
            setEditingCompany(null)
          }}
        />
      ) : null}
      <PageHeader
        title="Cari Kartı"
        description="Cari bilgiler, vergi detayları ve sözleşmede kullanılacak alıcı alanları"
        actions={
          <div className="flex items-center gap-2">
            {canImportPartners ? (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={(event) => handleImportPartners(event.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importingPartners}
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importingPartners ? 'Aktarılıyor...' : 'İçe aktar'}
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={filteredCompanies.length === 0}
              onClick={() => {
                downloadCompaniesAsXlsx(filteredCompanies)
                toast({ title: 'Dışa aktarma hazır', description: `${filteredCompanies.length} cari dışa aktarıldı.` })
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Dışa aktar
            </Button>
            <CompanyModal
              onSubmit={async (values) => {
                await createCompany(values as any)
                toast({ title: 'Cari oluşturuldu' })
              }}
            >
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Yeni cari
              </Button>
            </CompanyModal>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Toplam cari</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{companyStats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vergi bilgisi dolu</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {companyStats.taxReady}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">İletişim bilgisi dolu</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {companyStats.contactReady}
          </CardContent>
        </Card>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Cari filtreleri</h3>
            <p className="text-sm text-muted-foreground">
              Sektör, ülke, şehir ve ölçek alanlarını seçimle daralt. Şehir seçenekleri seçilen ülkeye göre otomatik daralır.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filteredCompanies.length} cari gösteriliyor</Badge>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Filtreleri temizle
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Sektör" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm sektörler</SelectItem>
              {filterOptions.industries.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchableCombobox
            value={countryFilter}
            options={[
              { value: 'all', label: 'Tüm ülkeler', searchText: 'tum ulkeler' },
              ...filterOptions.countries.map((country) => ({ value: country, label: country, searchText: country })),
            ]}
            placeholder="Ülke"
            searchPlaceholder="Ülke ara..."
            emptyMessage="Ülke bulunamadı."
            onValueChange={setCountryFilter}
          />
          <SearchableCombobox
            value={regionFilter}
            options={[
              { value: 'all', label: 'Tüm şehirler', searchText: 'tum sehirler' },
              ...filterOptions.regions.map((region) => ({ value: region, label: region, searchText: region })),
            ]}
            placeholder="Şehir"
            searchPlaceholder="Şehir ara..."
            emptyMessage="Şehir bulunamadı."
            onValueChange={setRegionFilter}
          />
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Ölçek" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm ölçekler</SelectItem>
              {filterOptions.sizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filteredCompanies}
        searchKey="name"
        renderSelectionActions={
          canDeletePartners
            ? ({ selectedRows, clearSelection }) => (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkDeleteCompanies(selectedRows as CompanyType[], clearSelection)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Seçilileri sil
                </Button>
              )
            : undefined
        }
      />
    </div>
  )
}

export function ContactsPage() {
  const { data, createContact } = useAppStore()
  const { toast } = useToast()
  const columns: ColumnDef<(typeof data.contacts)[number]>[] = [
    { accessorKey: 'name', header: 'İsim' },
    { accessorKey: 'role', header: 'Rol' },
    {
      accessorKey: 'companyId',
      header: 'Cari',
      cell: ({ row }) => data.companies.find((c) => c.id === row.original.companyId)?.name ?? '',
    },
    { accessorKey: 'email', header: 'E-posta' },
    { accessorKey: 'phone', header: 'Telefon' },
    { accessorKey: 'owner', header: 'Sahip' },
  ]
  return (
    <div>
      <PageHeader
        title="Kişiler"
        description="Hesaplarla ilişkili kişiler"
        actions={
          <ContactModal
            companies={data.companies}
            onSubmit={(values) => {
              createContact(values as any)
              toast({ title: 'Kişi oluşturuldu' })
            }}
          >
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Yeni kişi
            </Button>
          </ContactModal>
        }
      />
      <DataTable columns={columns} data={data.contacts} searchKey="name" />
    </div>
  )
}
