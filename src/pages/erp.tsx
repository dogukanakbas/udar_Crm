// @ts-nocheck
// @ts-nocheck
import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Calendar, Coins, Wallet } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Invoice, Product, SalesOrder } from '@/types'
import { RbacGuard } from '@/components/rbac'

export function SalesOrdersPage() {
  const { data, createSalesOrder } = useAppStore()
  const [step, setStep] = useState<'customer' | 'items'>('customer')
  const form = useForm({
    defaultValues: { customer: data.companies[0]?.id ?? '', items: '' },
  })
  const { toast } = useToast()

  const columns: ColumnDef<SalesOrder>[] = [
    { accessorKey: 'number', header: 'Sipariş' },
    {
      accessorKey: 'customerId',
      header: 'Müşteri',
      cell: ({ row }) =>
        data.companies.find((c) => c.id === row.original.customerId)?.name || row.original.customerName || '',
    },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    { accessorKey: 'amount', header: 'Tutar', cell: ({ row }) => formatCurrency(row.original.amount) },
    { accessorKey: 'shippingDate', header: 'Sevk', cell: ({ row }) => formatDate(row.original.shippingDate) },
    { accessorKey: 'expectedDelivery', header: 'Teslim', cell: ({ row }) => formatDate(row.original.expectedDelivery) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Satış Siparişleri"
        description="Oluşturma, paketleme, sevk durumu"
        actions={
          <RbacGuard perm="orders.edit">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm">Sipariş oluştur</Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Sipariş oluştur</SheetTitle>
                </SheetHeader>
                <Tabs value={step} onValueChange={(val) => setStep(val as any)} className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="customer">Müşteri</TabsTrigger>
                    <TabsTrigger value="items">Kalemler</TabsTrigger>
                  </TabsList>
                  <TabsContent value="customer" className="space-y-3 pt-3">
                    <Label>Müşteri</Label>
                    <Select value={form.watch('customer')} onValueChange={(v) => form.setValue('customer', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data.companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={() => setStep('items')}>
                      Devam <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TabsContent>
                  <TabsContent value="items" className="space-y-3 pt-3">
                    <Label>Kalemler</Label>
                    <Textarea placeholder="SKU, adet, notları yazın" {...form.register('items')} />
                    <Button
                      className="w-full"
                    onClick={() => {
                      const cust = data.companies.find((c) => c.id === form.watch('customer'))
                      createSalesOrder({
                        customer_name: cust?.name || 'Müşteri',
                        status: 'Draft',
                        amount: 0,
                        shipping_date: null,
                        expected_delivery: null,
                      })
                      toast({ title: 'Taslak olarak kaydedildi' })
                    }}
                    >
                      Taslak kaydet
                    </Button>
                  </TabsContent>
                </Tabs>
                <SheetFooter className="pt-4">
                  <Button variant="outline" onClick={() => setStep('customer')}>
                    Sihirbazı sıfırla
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </RbacGuard>
        }
      />
      <DataTable columns={columns} data={data.salesOrders} searchKey="number" />
    </div>
  )
}

export function PurchasesPage() {
  const { data } = useAppStore()
  const columns: ColumnDef<(typeof data.purchaseOrders)[number]>[] = [
    { accessorKey: 'number', header: 'PO' },
    { accessorKey: 'supplier', header: 'Tedarikçi' },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    { accessorKey: 'amount', header: 'Tutar', cell: ({ row }) => formatCurrency(row.original.amount) },
    { accessorKey: 'expectedDate', header: 'ETA', cell: ({ row }) => formatDate(row.original.expectedDate) },
  ]
  return (
    <div className="space-y-4">
      <PageHeader
        title="Satınalma Siparişleri"
        description="Gelen tedarik ve teslim"
        actions={
          <RbacGuard perm="orders.edit">
            <Badge variant="outline">{data.purchaseOrders.length} açık</Badge>
          </RbacGuard>
        }
      />
      <DataTable columns={columns} data={data.purchaseOrders} searchKey="number" />
    </div>
  )
}

export function InventoryPage() {
  const { data, adjustInventory, upsertProduct } = useAppStore()
  const [adjustSku, setAdjustSku] = useState<string | null>(null)
  const [openProduct, setOpenProduct] = useState(false)

  const columns: ColumnDef<Product>[] = [
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'name', header: 'Ürün' },
    { accessorKey: 'category', header: 'Kategori' },
    { accessorKey: 'warehouse', header: 'Depo' },
    { accessorKey: 'stock', header: 'Stok' },
    { accessorKey: 'reserved', header: 'Rezerve' },
    { accessorKey: 'reorderPoint', header: 'Emniyet St.' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <RbacGuard perm="inventory.edit">
            <Button size="sm" variant="outline" onClick={() => setAdjustSku(row.original.sku)}>
              Güncelle
            </Button>
          </RbacGuard>
          <RbacGuard perm="orders.edit">
            <Button size="sm" onClick={() => setAdjustSku(row.original.sku)}>PO Oluştur</Button>
          </RbacGuard>
        </div>
      ),
    },
  ]

  const lowStock = data.products.filter((p) => p.stock - p.reserved < p.reorderPoint)

  return (
    <div className="space-y-4">
      <PageHeader title="Stok" description="Ürünler, depolar, yeniden sipariş akışı" actions={<Badge variant="destructive">{lowStock.length} düşük stok</Badge>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ürünler</CardTitle>
              <RbacGuard perm="products.edit">
                <Button size="sm" onClick={() => setOpenProduct(true)}>
                  Yeni ürün
                </Button>
              </RbacGuard>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={data.products} searchKey="sku" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Düşük stok akışı</CardTitle>
            <CardDescription>Satınalma siparişi aksiyonu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.slice(0, 6).map((item) => (
              <div key={item.sku} className="rounded-lg border border-border/70 p-3">
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">SKU {item.sku}</p>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span>Stok {item.stock - item.reserved}</span>
                  <RbacGuard perm="orders.edit">
                    <Button size="sm" variant="outline" onClick={() => setAdjustSku(item.sku)}>
                      PO Oluştur
                    </Button>
                  </RbacGuard>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <AdjustStockDialog
        sku={adjustSku}
        onClose={() => setAdjustSku(null)}
        onAdjust={(sku, delta) => {
          adjustInventory(sku, delta)
          setAdjustSku(null)
        }}
      />
      <NewProductDialog
        open={openProduct}
        onClose={() => setOpenProduct(false)}
        onSave={async (values) => {
          await upsertProduct(values as any)
          setOpenProduct(false)
        }}
      />
    </div>
  )
}

function AdjustStockDialog({ sku, onClose, onAdjust }: { sku: string | null; onClose: () => void; onAdjust: (sku: string, delta: number) => void }) {
  const form = useForm({ defaultValues: { delta: 5 } })
  if (!sku) return null
  return (
    <Dialog open={!!sku} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Güncelle {sku}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Değişim</Label>
          <Input type="number" {...form.register('delta', { valueAsNumber: true })} />
        </div>
        <DialogFooter>
          <Button onClick={() => onAdjust(sku, Number(form.getValues('delta') || 0))}>Güncelle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewProductDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (product: Partial<Product> & { sku: string }) => void
}) {
  const form = useForm<{ sku: string; name: string; price: number; stock: number }>({
    defaultValues: { sku: '', name: '', price: 0, stock: 0 },
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni ürün</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>SKU</Label>
            <Input {...form.register('sku')} />
          </div>
          <div>
            <Label>Ad</Label>
            <Input {...form.register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fiyat</Label>
              <Input type="number" step="0.01" {...form.register('price', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Stok</Label>
              <Input type="number" step="1" {...form.register('stock', { valueAsNumber: true })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
          <Button
            onClick={form.handleSubmit(async (values) => {
              setSubmitError(null)
              try {
                await onSave(values)
                onClose()
              } catch (err: any) {
                const detail = err?.response?.data
                if (detail && typeof detail === 'object') {
                  const msg = detail.sku?.[0] || detail.name?.[0] || detail.detail || 'Kaydedilemedi'
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

export function InvoicingPage() {
  const { data, markInvoiceStatus, addInvoicePayment } = useAppStore()
  const { toast } = useToast()
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: 'number', header: 'Fatura' },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    {
      accessorKey: 'companyId',
      header: 'Şirket',
      cell: ({ row }) => data.companies.find((c) => c.id === row.original.companyId)?.name ?? '',
    },
    { accessorKey: 'amount', header: 'Tutar', cell: ({ row }) => formatCurrency(row.original.amount) },
    { accessorKey: 'dueDate', header: 'Vade', cell: ({ row }) => formatDate(row.original.dueDate) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => markInvoiceStatus(row.original.id, 'Sent')}>
            Gönder
          </Button>
          <Button size="sm" onClick={() => setPayInvoice(row.original)}>
            Ödendi
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Faturalama" description="Taslak, gönder, ödendi, geciken" actions={<Badge variant="outline">{data.invoices.length} fatura</Badge>} />
      <DataTable columns={columns} data={data.invoices} searchKey="number" />
      <PaymentDialog
        invoice={payInvoice}
        onClose={() => setPayInvoice(null)}
        onSubmit={(payment) => {
          if (!payInvoice) return
          addInvoicePayment(payInvoice.id, payment)
          markInvoiceStatus(payInvoice.id, 'Paid')
          toast({ title: `Fatura ${payInvoice.number} ödendi` })
          setPayInvoice(null)
        }}
      />
    </div>
  )
}

function PaymentDialog({
  invoice,
  onClose,
  onSubmit,
}: {
  invoice: Invoice | null
  onClose: () => void
  onSubmit: (payment: Invoice['payments'][number]) => void
}) {
  const form = useForm({
    resolver: zodResolver(z.object({ amount: z.coerce.number().positive(), method: z.string().min(2) })),
    defaultValues: { amount: 0, method: 'Wire' },
  })

  if (!invoice) return null
  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{invoice.number} ödendi olarak işaretle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Tutar</Label>
          <Input type="number" {...form.register('amount', { valueAsNumber: true })} defaultValue={invoice.amount} />
          <Label>Ödeme yöntemi</Label>
          <Input {...form.register('method')} defaultValue="Wire" />
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit({ date: new Date().toISOString(), amount: Number(form.getValues('amount')), method: form.getValues('method') })}>
            Onayla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccountingPage() {
  const { data } = useAppStore()
  const ar = data.invoices.filter((i) => i.status !== 'Paid').reduce((sum, inv) => sum + inv.amount, 0)
  const ap = data.purchaseOrders.reduce((sum, po) => sum + po.amount, 0)
  const ledger = data.invoices.slice(0, 8).map((inv) => ({
    id: inv.id,
    description: inv.number,
    debit: inv.amount,
    credit: inv.payments.reduce((sum, p) => sum + p.amount, 0),
    date: inv.issuedAt,
  }))

  const columns: ColumnDef<(typeof ledger)[number]>[] = [
    { accessorKey: 'description', header: 'Kayıt' },
    { accessorKey: 'debit', header: 'Borç', cell: ({ row }) => formatCurrency(row.original.debit) },
    { accessorKey: 'credit', header: 'Alacak', cell: ({ row }) => formatCurrency(row.original.credit) },
    { accessorKey: 'date', header: 'Tarih', cell: ({ row }) => formatDate(row.original.date) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Muhasebe" description="Alacak/Borç özet ve yevmiye" actions={<Badge variant="outline">Demo</Badge>} />
      <div className="grid gap-4 md:grid-cols-3">
        <MiniStat title="Alacaklar" value={formatCurrency(ar)} icon={<Wallet className="h-5 w-5 text-primary" />} />
        <MiniStat title="Borçlar" value={formatCurrency(ap)} icon={<Coins className="h-5 w-5 text-primary" />} />
        <MiniStat title="Nakit akışı (tahmini)" value={formatCurrency(ar - ap)} icon={<Calendar className="h-5 w-5 text-primary" />} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Yevmiye</CardTitle>
          <CardDescription>Sunum için örnek kayıtlar</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={ledger} />
        </CardContent>
      </Card>
    </div>
  )
}

function MiniStat({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-xl">{value}</CardTitle>
        </div>
        {icon}
      </CardHeader>
    </Card>
  )
}

