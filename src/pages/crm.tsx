// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/app-shell'
import { useToast } from '@/components/ui/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { normalizeCompanySize, normalizeCountryLabel } from '@/lib/location-data'
import { downloadCompaniesAsXlsx } from '@/lib/company-export-xlsx'
import { useAppStore } from '@/state/use-app-store'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Lead, Opportunity, Contact as ContactType, Company as CompanyType } from '@/types'
import { BadgeCheck, Download, HandCoins, Plus, Timer } from 'lucide-react'

const leadSchema = z.object({
  name: z.string().min(2),
  title: z.string().min(2),
  companyId: z.string(),
  email: z.string().email(),
  phone: z.string(),
  owner: z.string(),
  status: z.string(),
  source: z.string(),
  score: z.coerce.number().min(0).max(100),
})

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

export function LeadsPage() {
  const { data, deleteLead, createLead, updateLead, createCompany, createContact } = useAppStore()
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const { toast } = useToast()

  const filtered = useMemo(
    () =>
      data.leads.filter(
        (lead) =>
          (statusFilter === 'all' || lead.status === statusFilter) &&
          (ownerFilter === 'all' || lead.owner === ownerFilter) &&
          (sourceFilter === 'all' || lead.source === sourceFilter)
      ),
    [data.leads, statusFilter, ownerFilter, sourceFilter]
  )

  const columns: ColumnDef<Lead>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Tümünü seç"
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Satırı seç" />
      ),
      size: 40,
    },
    { accessorKey: 'name', header: 'Aday' },
    {
      accessorKey: 'companyId',
      header: 'Şirket',
      cell: ({ row }) => data.companies.find((c) => c.id === row.original.companyId)?.name ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
    },
    { accessorKey: 'source', header: 'Kaynak' },
    { accessorKey: 'owner', header: 'Sahip' },
    {
      accessorKey: 'score',
      header: 'Skor',
      cell: ({ row }) => <Badge variant={row.original.score > 75 ? 'success' : 'outline'}>{row.original.score}</Badge>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Oluşturulma',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <LeadModal
            lead={row.original}
            companies={data.companies}
            owners={Array.from(new Set(data.leads.map((l) => l.owner)))}
            onSubmit={(values) => updateLead(row.original.id, values as any)}
          >
            <Button variant="ghost" size="sm">
              Düzenle
            </Button>
          </LeadModal>
          <Button variant="ghost" size="sm" onClick={() => deleteLead(row.original.id)}>
            Sil
          </Button>
        </div>
      ),
    },
  ]

  const onExport = () => {
    const csv = filtered.map((lead) => ({
      name: lead.name,
      company: data.companies.find((c) => c.id === lead.companyId)?.name ?? '',
      status: lead.status,
      owner: lead.owner,
      score: lead.score,
    }))
    const blob = new Blob([csv.map((row) => Object.values(row).join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aday_musteriler.csv'
    a.click()
  }

  return (
    <div>
      <PageHeader
        title="Aday müşteri listesi"
        description="Filtreler, kayıtlı görünümler, satır içi işlemler"
        actions={
          <div className="flex items-center gap-2">
            {data.savedViews.leads?.map((view) => (
              <Button
                key={view.name}
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter(view.filters.status ?? 'all')
                  setOwnerFilter(view.filters.owner ?? 'all')
                  setSourceFilter(view.filters.source ?? 'all')
                }}
              >
                {view.name}
              </Button>
            ))}
            <CompanyModal
              onSubmit={(values) => {
                createCompany(values as any)
                toast({ title: 'Şirket oluşturuldu' })
              }}
            >
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Yeni şirket
              </Button>
            </CompanyModal>
            <ContactModal
              companies={data.companies}
              onSubmit={(values) => {
                createContact(values as any)
                toast({ title: 'Kişi oluşturuldu' })
              }}
            >
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Yeni kişi
              </Button>
            </ContactModal>
            <LeadModal
              companies={data.companies}
              owners={Array.from(new Set(data.leads.map((l) => l.owner)))}
              onSubmit={(values) => {
                createLead(values as any)
                toast({ title: 'Aday müşteri oluşturuldu' })
              }}
            >
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Yeni lead
              </Button>
            </LeadModal>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {Array.from(new Set(data.leads.map((l) => l.status))).map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sahip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm sahipler</SelectItem>
            {Array.from(new Set(data.leads.map((l) => l.owner))).map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Kaynak" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kaynaklar</SelectItem>
            {Array.from(new Set(data.leads.map((l) => l.source))).map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={filtered} searchKey="name" onExport={onExport} />
    </div>
  )
}

function LeadModal({
  children,
  companies,
  owners,
  onSubmit,
  lead,
}: {
  children: React.ReactNode
  companies: { id: string; name: string }[]
  owners: string[]
  onSubmit: (values: z.infer<typeof leadSchema>) => void
  lead?: Lead
}) {
  const form = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema) as any,
    defaultValues: {
      name: lead?.name ?? '',
      title: lead?.title ?? '',
      companyId: lead?.companyId ?? companies[0]?.id ?? '',
      email: lead?.email ?? '',
      phone: lead?.phone ?? '',
      owner: lead?.owner ?? owners[0] ?? '',
      status: lead?.status ?? 'New',
      source: lead?.source ?? 'Website',
      score: lead?.score ?? 50,
    },
  })

  useEffect(() => {
    form.reset({
      name: lead?.name ?? '',
      title: lead?.title ?? '',
      companyId: lead?.companyId ?? companies[0]?.id ?? '',
      email: lead?.email ?? '',
      phone: lead?.phone ?? '',
      owner: lead?.owner ?? owners[0] ?? '',
      status: lead?.status ?? 'New',
      source: lead?.source ?? 'Website',
      score: lead?.score ?? 50,
    })
  }, [lead, form, companies, owners])

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aday müşteri oluştur</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => {
            onSubmit(values as z.infer<typeof leadSchema>)
          })}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>İsim</Label>
              <Input {...form.register('name')} />
            </div>
            <div>
              <Label>Unvan</Label>
              <Input {...form.register('title')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Şirket</Label>
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
            <div>
              <Label>Sahip</Label>
              <Select value={form.watch('owner')} onValueChange={(v) => form.setValue('owner', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-posta</Label>
              <Input {...form.register('email')} type="email" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input {...form.register('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Durum</Label>
              <Input {...form.register('status')} />
            </div>
            <div>
              <Label>Kaynak</Label>
              <Input {...form.register('source')} />
            </div>
            <div>
              <Label>Skor</Label>
              <Input type="number" {...form.register('score', { valueAsNumber: true })} />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit">Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LeadDetailPage() {
  const params = useParams({ from: '/crm/leads/$leadId' })
  const { data } = useAppStore()
  const lead = data.leads.find((l) => l.id === params.leadId)
  const company = data.companies.find((c) => c.id === lead?.companyId)

  if (!lead) return <p className="text-muted-foreground">Kayıt bulunamadı</p>

  return (
    <div className="space-y-4">
      <PageHeader
        title={lead.name}
        description={company?.name}
        actions={<Badge variant="secondary">{lead.status}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zaman çizelgesi</CardTitle>
            <CardDescription>Son notlar ve e-postalar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.timeline.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                <Badge variant="outline">{item.type}</Badge>
                <div>
                  <p className="text-sm font-semibold">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.author} • {formatDate(item.date)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Detaylar</CardTitle>
            <CardDescription>Sahip, kaynak, skor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Sahip" value={lead.owner} />
            <DetailRow label="Ünvan" value={lead.title} />
            <DetailRow label="Kaynak" value={lead.source} />
            <DetailRow label="Skor" value={lead.score.toString()} />
            <Separator />
            <DetailRow label="E-posta" value={lead.email} />
            <DetailRow label="Telefon" value={lead.phone} />
            <Separator />
            <DetailRow label="Oluşturulma" value={formatDate(lead.createdAt)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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
            <Label>Şirket</Label>
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
  leads,
  onSubmit,
}: {
  children: React.ReactNode
  companies: CompanyType[]
  leads: Lead[]
  onSubmit: (values: z.infer<typeof opportunitySchema>) => void
}) {
  const form = useForm<z.infer<typeof opportunitySchema>>({
    resolver: zodResolver(opportunitySchema) as any,
    defaultValues: {
      name: '',
      companyId: companies[0]?.id ?? '',
      leadId: leads[0]?.id ?? '',
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Şirket</Label>
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
            <div>
              <Label>Aday müşteri</Label>
              <Select value={form.watch('leadId') ?? 'none'} onValueChange={(v) => form.setValue('leadId', v === 'none' ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              leads={data.leads}
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
  const { data, createCompany, updateCompany } = useAppStore()
  const { toast } = useToast()
  const [industryFilter, setIndustryFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [editingCompany, setEditingCompany] = useState<CompanyType | null>(null)
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

  const columns: ColumnDef<(typeof data.companies)[number]>[] = useMemo(
    () => [
      { accessorKey: 'name', header: 'Şirket' },
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
          <Button variant="ghost" size="sm" onClick={() => setEditingCompany(row.original)}>
            Düzenle
          </Button>
        ),
      },
    ],
    []
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
            toast({ title: 'Şirket güncellendi' })
            setEditingCompany(null)
          }}
        />
      ) : null}
      <PageHeader
        title="Şirketler"
        description="Cari bilgiler, vergi detayları ve sözleşmede kullanılacak alıcı alanları"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filteredCompanies.length === 0}
              onClick={() => {
                downloadCompaniesAsXlsx(filteredCompanies)
                toast({ title: 'Dışa aktarma hazır', description: `${filteredCompanies.length} şirket dışa aktarıldı.` })
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Dışa aktar
            </Button>
            <CompanyModal
              onSubmit={async (values) => {
                await createCompany(values as any)
                toast({ title: 'Şirket oluşturuldu' })
              }}
            >
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Yeni şirket
              </Button>
            </CompanyModal>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Toplam şirket</CardTitle>
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
            <h3 className="text-sm font-semibold">Firma filtreleri</h3>
            <p className="text-sm text-muted-foreground">
              Sektör, ülke, şehir ve ölçek alanlarını seçimle daralt. Şehir seçenekleri seçilen ülkeye göre otomatik daralır.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filteredCompanies.length} şirket gösteriliyor</Badge>
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
      <DataTable columns={columns} data={filteredCompanies} searchKey="name" />
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
      header: 'Şirket',
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
