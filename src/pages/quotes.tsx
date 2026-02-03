import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/app-shell'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Quote } from '@/types'
import { Check, Download, Plus, Send, Shield } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { RbacGuard } from '@/components/rbac'
import api from '@/lib/api'
import { CardDescription } from '@/components/ui/card'

const wizardSchema = z.object({
  customerId: z.string(),
  owner: z.string(),
  lines: z.array(
    z.object({
      sku: z.string(),
      name: z.string(),
      qty: z.coerce.number().positive(),
      unitPrice: z.coerce.number().positive(),
      discount: z.coerce.number().optional(),
      tax: z.coerce.number().optional(),
      category: z.string().optional(),
    })
  ),
  validUntil: z.string(),
  payment: z.string().min(2),
  delivery: z.string().min(2),
  notes: z.string().optional(),
})

export function QuotesPage() {
  const { data } = useAppStore()
  const { toast } = useToast()
  const [status, setStatus] = useState('all')
  const [customer, setCustomer] = useState('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const quotes = data.quotes ?? []
  const companies = data.companies
  const products = data.products
  const owners = useMemo(() => Array.from(new Set(data.leads.map((l) => l.owner))), [data.leads])

  const filtered = useMemo(
    () =>
      quotes.filter((q) => {
        const matchesStatus = status === 'all' || q.status === status
        const matchesCustomer = customer === 'all' || q.customerId === customer
        const matchesMin = !minAmount || q.total >= Number(minAmount)
        const matchesMax = !maxAmount || q.total <= Number(maxAmount)
        return matchesStatus && matchesCustomer && matchesMin && matchesMax
      }),
    [quotes, status, customer, minAmount, maxAmount]
  )

  const columns: ColumnDef<Quote>[] = [
    { accessorKey: 'number', header: 'Teklif No' },
    {
      accessorKey: 'customerId',
      header: 'Müşteri',
      cell: ({ row }) => companies.find((c) => c.id === row.original.customerId)?.name ?? '',
    },
    { accessorKey: 'owner', header: 'Sahip' },
    { accessorKey: 'total', header: 'Tutar', cell: ({ row }) => formatCurrency(row.original.total) },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    { accessorKey: 'validUntil', header: 'Geçerlilik', cell: ({ row }) => formatDate(row.original.validUntil) },
    {
      id: 'link',
      header: '',
      cell: ({ row }) => (
        <Link to="/crm/quotes/$quoteId" params={{ quoteId: row.original.id }} className="text-xs text-primary underline">
          Görüntüle
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teklif Yönetimi"
        description="Liste, filtre, toplu aksiyonlar"
        actions={
          <div className="flex gap-2">
            <RbacGuard perm="quotes.edit">
              <QuoteWizardTrigger companies={companies} products={products} owners={owners} />
            </RbacGuard>
            <RbacGuard perm="quotes.view">
              <Button variant="outline" size="sm" onClick={() => toast({ title: 'CSV indirildi (demo)' })}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </RbacGuard>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            {['Draft', 'Sent', 'Under Review', 'Approved', 'Rejected', 'Converted'].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Müşteri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm müşteriler</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Min tutar" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-28" />
        <Input placeholder="Max tutar" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-28" />
      </div>
      <Card>
        <CardContent className="pt-4">
          <DataTable
            columns={[
              {
                id: 'select',
                header: ({ table }) => (
                  <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />
                ),
                cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
                size: 32,
              },
              ...columns,
            ]}
            data={filtered}
            onExport={(rows) => {
              const csv = rows.map((r) => [r.number, r.customerId, r.owner, r.total, r.status, r.validUntil].join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = 'quotes.csv'
              a.click()
            }}
            renderToolbar={<></>}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function QuoteWizardTrigger({
  companies,
  products,
  owners,
}: {
  companies: { id: string; name: string; region: string; industry: string }[]
  products: { sku: string; name: string; price: number; category: string }[]
  owners: string[]
}) {
  const createQuote = useAppStore((s) => s.createQuote)
  const { toast } = useToast()
  const form = useForm<z.infer<typeof wizardSchema>>({
    resolver: zodResolver(wizardSchema) as any,
    defaultValues: {
      customerId: companies[0]?.id ?? '',
      owner: owners[0] ?? '',
      lines: [
        {
          sku: products[0]?.sku ?? '',
          name: products[0]?.name ?? '',
          qty: 1,
          unitPrice: products[0]?.price ?? 1000,
          discount: 0,
          tax: 18,
          category: products[0]?.category ?? 'Genel',
        },
      ],
      validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      payment: 'Net 30',
      delivery: 'CIF',
      notes: '',
    },
  })

  const addLine = () => {
    const prod = products[Math.floor(Math.random() * products.length)] ?? { sku: '', name: 'Ürün', price: 1000, category: 'Genel' }
    form.setValue('lines', [
      ...form.getValues('lines'),
      { sku: prod.sku, name: prod.name, qty: 1, unitPrice: prod.price, discount: 0, tax: 18, category: prod.category },
    ])
  }

  const subtotal = form.watch('lines').reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const discount = form.watch('lines').reduce((s, l) => s + (l.discount ?? 0) / 100 * l.qty * l.unitPrice, 0)
  const tax = (subtotal - discount) * 0.18
  const total = subtotal - discount + tax

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Yeni teklif
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Teklif oluştur</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="customer">
          <TabsList className="mb-3 grid grid-cols-4">
            <TabsTrigger value="customer">Müşteri</TabsTrigger>
            <TabsTrigger value="lines">Ürünler</TabsTrigger>
            <TabsTrigger value="terms">Şartlar</TabsTrigger>
            <TabsTrigger value="review">Özet</TabsTrigger>
          </TabsList>
          <TabsContent value="customer" className="space-y-3">
            <Label>Müşteri</Label>
            <Select value={form.watch('customerId')} onValueChange={(v) => form.setValue('customerId', v)}>
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
            <div className="text-sm text-muted-foreground">
              {companies.find((c) => c.id === form.watch('customerId'))?.region} •{' '}
              {companies.find((c) => c.id === form.watch('customerId'))?.industry}
            </div>
          </TabsContent>
          <TabsContent value="lines" className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Kalemler</Label>
              <Button size="sm" variant="outline" onClick={addLine}>
                Ürün ekle
              </Button>
            </div>
            {form.watch('lines').map((line, idx) => (
              <div key={idx} className="grid grid-cols-6 gap-2 rounded-md border p-2">
                <Input value={line.name} onChange={(e) => form.setValue(`lines.${idx}.name`, e.target.value)} />
                <Input type="number" value={line.qty} onChange={(e) => form.setValue(`lines.${idx}.qty`, Number(e.target.value))} />
                <Input type="number" value={line.unitPrice} onChange={(e) => form.setValue(`lines.${idx}.unitPrice`, Number(e.target.value))} />
                <Input type="number" value={line.discount ?? 0} onChange={(e) => form.setValue(`lines.${idx}.discount`, Number(e.target.value))} />
                <Input type="number" value={line.tax ?? 18} onChange={(e) => form.setValue(`lines.${idx}.tax`, Number(e.target.value))} />
                <Input value={line.category ?? ''} onChange={(e) => form.setValue(`lines.${idx}.category`, e.target.value)} />
              </div>
            ))}
            <div className="text-sm text-muted-foreground">Ara toplam: {formatCurrency(subtotal)} • İskonto: {formatCurrency(discount)} • Vergi: {formatCurrency(tax)} • Genel toplam: {formatCurrency(total)}</div>
          </TabsContent>
          <TabsContent value="terms" className="grid gap-3">
            <div>
              <Label>Geçerlilik</Label>
              <Input type="date" {...form.register('validUntil')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ödeme</Label>
                <Input {...form.register('payment')} />
              </div>
              <div>
                <Label>Teslimat</Label>
                <Input {...form.register('delivery')} />
              </div>
            </div>
            <div>
              <Label>Notlar</Label>
              <Textarea {...form.register('notes')} />
            </div>
          </TabsContent>
          <TabsContent value="review" className="space-y-2 text-sm">
            <p>Müşteri: {companies.find((c) => c.id === form.watch('customerId'))?.name}</p>
            <p>Satır sayısı: {form.watch('lines').length}</p>
            <p>Toplam: {formatCurrency(total)}</p>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            onClick={form.handleSubmit((values) => {
              const payload = {
                customerId: values.customerId,
                validUntil: values.validUntil || null,
                payment: values.payment,
                delivery: values.delivery,
                notes: values.notes,
                status: 'Draft',
                lines: values.lines.map((l) => ({
                  product: undefined,
                  name: l.name || 'Satır',
                  qty: Number(l.qty || 1),
                  unitPrice: Number(l.unitPrice || 0),
                  discount: Number(l.discount || 0),
                  tax: Number(l.tax || 0),
                })),
              }
              createQuote(payload as unknown as Quote)
              toast({ title: 'Teklif oluşturuluyor...' })
            })}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function QuoteDetailPage() {
  const params = useParams({ from: '/crm/quotes/$quoteId' })
  const { data, updateQuote, convertQuote } = useAppStore()
  const { toast } = useToast()
  const [auditLogs, setAuditLogs] = useState<
    { id: string; action: string; field: string; old_value: string; new_value: string; created_at: string; user?: string }[]
  >([])
  const [approvalSteps, setApprovalSteps] = useState<
    { id: string; role: string; status: string; comment?: string; acted_by?: string; updated_at?: string }[]
  >([])
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const quote = data.quotes.find((q) => q.id === params.quoteId) ?? data.quotes[0]
  const company = data.companies.find((c) => c.id === quote?.customerId)
  if (!quote) return <p className="text-muted-foreground">Teklif bulunamadı</p>

  useEffect(() => {
    if (!quote) return
    api
      .get('/audit/', { params: { entity: 'Quote', entity_id: quote.id } })
      .then((res) => setAuditLogs(res.data || []))
      .catch(() => setAuditLogs([]))

    api
      .get('/approvals/', { params: { quote_id: quote.id } })
      .then((res) => {
        const inst = res.data?.[0]
        if (inst?.steps) {
          setApprovalSteps(inst.steps)
        }
      })
      .catch(() => setApprovalSteps([]))
  }, [quote?.id])

  const approve = (role: Quote['approval'][number]['role']) => {
    updateQuote(quote.id, {
      approval: quote.approval.map((s) => (s.role === role ? { ...s, status: 'Approved', updatedAt: new Date().toISOString() } : s)),
      status: role === 'Finance' ? 'Approved' : quote.status,
    })
    toast({ title: `${role} onayı alındı` })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${quote.number} • ${company?.name ?? ''}`}
        description={`Durum: ${quote.status} • Toplam ${formatCurrency(quote.total)}`}
        actions={
          <div className="flex gap-2">
            <RbacGuard perm="quotes.edit">
              <Button size="sm" variant="outline" onClick={() => updateQuote(quote.id, { status: 'Sent' })}>
                <Send className="mr-2 h-4 w-4" /> Gönder
              </Button>
            </RbacGuard>
            <RbacGuard perm="quotes.edit">
              <Button size="sm" variant="outline" onClick={() => approve('Manager')}>
                <Shield className="mr-2 h-4 w-4" /> Onay iste
              </Button>
            </RbacGuard>
            <RbacGuard perm="quotes.approve">
              <Button
                size="sm"
                onClick={() => {
                  convertQuote(quote.id)
                  toast({ title: 'Satış siparişine dönüştürüldü' })
                }}
              >
                <Check className="mr-2 h-4 w-4" /> Satış siparişi
              </Button>
            </RbacGuard>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-3">
          <TabsTrigger value="overview">Özet</TabsTrigger>
          <TabsTrigger value="lines">Kalemler</TabsTrigger>
          <TabsTrigger value="pricing">Fiyatlama</TabsTrigger>
          <TabsTrigger value="approval">Onay</TabsTrigger>
          <TabsTrigger value="history">Geçmiş</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardContent className="grid gap-2 pt-4 text-sm">
              <p>Müşteri: {company?.name}</p>
              <p>Sahip: {quote.owner}</p>
              <p>Geçerlilik: {formatDate(quote.validUntil)}</p>
              <p>Ödeme: {quote.terms.payment}</p>
              <p>Teslim: {quote.terms.delivery}</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="lines">
          <Card>
            <CardContent className="space-y-2 pt-4">
              {quote.lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 text-sm rounded-md border p-2">
                  <span>{l.name}</span>
                  <span>{l.qty} adet</span>
                  <span>{formatCurrency(l.unitPrice)}</span>
                  <span>İskonto %{l.discount ?? 0}</span>
                  <span>Vergi %{l.tax ?? 18}</span>
                </div>
              ))}
              <div className="text-sm text-muted-foreground">
                Ara toplam {formatCurrency(quote.subtotal)} • İskonto {formatCurrency(quote.discountTotal)} • Vergi {formatCurrency(quote.taxTotal)} • Toplam {formatCurrency(quote.total)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pricing">
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <p>Fiyatlama kuralları demo: müşteri/ürün kategorisi/hacim bazlı.</p>
              <div className="flex gap-2">
                <Badge>VIP müşteri %8</Badge>
                <Badge>Donanım %5</Badge>
                <Badge>50k+ %3</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="approval">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <CardDescription>Satır içi onay akışı (backend)</CardDescription>
              {approvalSteps.length === 0 && <p className="text-sm text-muted-foreground">Onay kaydı yok</p>}
              {approvalSteps.map((step) => (
                <div key={step.id} className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <p className="font-semibold">{step.role}</p>
                    <p className="text-xs text-muted-foreground">Durum: {step.status}</p>
                    {step.comment && <p className="text-xs text-muted-foreground">Not: {step.comment}</p>}
                    {step.acted_by && (
                      <p className="text-xs text-muted-foreground">
                        İşleyen: {step.acted_by} {step.updated_at ? `• ${formatDate(step.updated_at)}` : ''}
                      </p>
                    )}
                  </div>
                  {step.status === 'Waiting' && (
                    <div className="flex gap-2">
                      <RbacGuard perm="quotes.approve">
                        <Button
                          size="sm"
                          disabled={busyStep === step.id}
                          onClick={async () => {
                            setBusyStep(step.id)
                            await api.post(`/approvals/step/${step.id}/action/`, { action: 'approve' })
                            const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } })
                            setApprovalSteps(refreshed.data?.[0]?.steps || [])
                            setBusyStep(null)
                          }}
                        >
                          Onayla
                        </Button>
                      </RbacGuard>
                      <RbacGuard perm="quotes.approve">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyStep === step.id}
                          onClick={async () => {
                            const reason = prompt('Ret nedeni:')
                            setBusyStep(step.id)
                            await api.post(`/approvals/step/${step.id}/action/`, { action: 'reject', comment: reason || '' })
                            const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } })
                            setApprovalSteps(refreshed.data?.[0]?.steps || [])
                            setBusyStep(null)
                          }}
                        >
                          Reddet
                        </Button>
                      </RbacGuard>
                    </div>
                  )}
                </div>
              ))}
              <RbacGuard perm="quotes.edit">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyStep !== null}
                  onClick={async () => {
                    setBusyStep('resubmit')
                    if (approvalSteps[0]) {
                      await api.post(`/approvals/step/${approvalSteps[0].id}/action/`, { action: 'resubmit' })
                      const refreshed = await api.get('/approvals/', { params: { quote_id: quote.id } })
                      setApprovalSteps(refreshed.data?.[0]?.steps || [])
                    }
                    setBusyStep(null)
                  }}
                >
                  Yeniden gönder
                </Button>
              </RbacGuard>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              {auditLogs.length === 0 && <p className="text-muted-foreground text-sm">Audit kaydı bulunamadı</p>}
              {auditLogs.map((h) => (
                <div key={h.id} className="rounded-md border p-2">
                  <p className="font-semibold">{h.field || h.action}</p>
                  <p>{h.old_value ?? '-'} → {h.new_value ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.user || '—'} • {formatDate(h.created_at)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

