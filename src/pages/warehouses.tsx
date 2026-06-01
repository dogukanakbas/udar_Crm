import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeftRight, Download, Minus, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react'

import api from '@/lib/api'
import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { SearchableCombobox } from '@/components/searchable-combobox'
import { useAppStore } from '@/state/use-app-store'
import { hasPermission } from '@/lib/permissions'

type Warehouse = { id: number; code: string; name: string; city?: string; address?: string; responsible?: string; phone?: string; email?: string; description?: string; capacity?: number; capacity_unit?: string; is_active: boolean; stock_total?: number; location_count?: number }
type Location = { id: number; warehouse: number; warehouse_code: string; warehouse_name: string; code: string; name: string; description?: string; is_active: boolean }
type Stock = { id: number; product: number; product_sku: string; product_name: string; category_name: string; warehouse: number; warehouse_code: string; warehouse_name: string; location: number; location_code: string; location_name: string; quantity: number; detail_1: string; detail_2: string; detail_1_override?: string; detail_2_override?: string }
type Summary = { active_warehouses: number; total_stock: number; critical_stock: number; recent_movements: number; by_warehouse: { name: string; value: number }[]; movement_trend: { day: string; movement_type: string; value: number }[]; top_products: { name: string; value: number }[] }
type Operation = 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER'
type Movement = { id: number; movement_type: string; quantity: number; reference?: string; note?: string; location_from?: string; location_to?: string; created_at: string }
type AllocationRow = { location_id: string; quantity: string; detail_1_override: string; detail_2_override: string }

const blankWarehouse = { code: '', name: '', city: '', address: '', responsible: '', phone: '', email: '', description: '', capacity: '', capacity_unit: '', is_active: true }
const blankLocation = { warehouse: '', code: '', name: '', description: '', is_active: true }
const blankAllocationRow = (): AllocationRow => ({ location_id: '', quantity: '', detail_1_override: '', detail_2_override: '' })
const movementLabels: Record<string, string> = { IN: 'Giriş', OUT: 'Çıkış', ADJUST: 'Sayım', TRANSFER: 'Transfer', OPENING: 'Açılış' }
const apiErrorMessage = (error: any) => {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat().find((item) => typeof item === 'string')
    if (typeof first === 'string') return first
  }
  return 'İşlem tamamlanamadı. Alanları kontrol edip tekrar deneyin.'
}

function useWarehouseData() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const reload = async () => {
    const [warehouseResponse, locationResponse] = await Promise.all([api.get('/warehouses/'), api.get('/inventory-locations/')])
    setWarehouses(warehouseResponse.data || [])
    setLocations(locationResponse.data || [])
  }
  useEffect(() => { void reload() }, [])
  return { warehouses, locations, reload }
}

export function WarehouseManagementPage() {
  const { toast } = useToast()
  const { warehouses, locations, reload } = useWarehouseData()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [warehouseOpen, setWarehouseOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [warehouseForm, setWarehouseForm] = useState<any>(blankWarehouse)
  const [locationForm, setLocationForm] = useState<any>(blankLocation)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')

  const loadSummary = () => api.get('/warehouse-dashboard/', { params: { warehouse: selectedWarehouse === 'all' ? undefined : selectedWarehouse } }).then((response) => setSummary(response.data))
  useEffect(() => { void loadSummary() }, [selectedWarehouse])
  const visibleWarehouses = selectedWarehouse === 'all' ? warehouses : warehouses.filter((item) => String(item.id) === selectedWarehouse)

  const saveWarehouse = async () => {
    try {
      await api.post('/warehouses/', { ...warehouseForm, capacity: warehouseForm.capacity || null })
      setWarehouseOpen(false); setWarehouseForm(blankWarehouse); await reload(); await loadSummary()
      toast({ title: 'Depo oluşturuldu' })
    } catch (error) {
      toast({ title: 'Depo oluşturulamadı', description: apiErrorMessage(error), variant: 'destructive' })
    }
  }
  const saveLocation = async () => {
    try {
      await api.post('/inventory-locations/', { ...locationForm, warehouse: Number(locationForm.warehouse) })
      setLocationOpen(false); setLocationForm(blankLocation); await reload()
      toast({ title: 'Raf oluşturuldu' })
    } catch (error) {
      toast({ title: 'Raf oluşturulamadı', description: apiErrorMessage(error), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Depo Yönetimi" description="Depo kapasitesi, raf yapısı ve stok hareketlerini tek ekrandan izleyin."
        actions={<><Button variant="outline" onClick={() => setLocationOpen(true)}><Plus className="mr-2 h-4 w-4" />Raf ekle</Button><Button onClick={() => setWarehouseOpen(true)}><Plus className="mr-2 h-4 w-4" />Yeni depo</Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Aktif depo" value={summary?.active_warehouses || 0} />
        <Metric label="Toplam stok" value={summary?.total_stock || 0} />
        <Metric label="Kritik ürün" value={summary?.critical_stock || 0} />
        <Metric label="Son 30 gün hareket" value={summary?.recent_movements || 0} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Depo bazlı stok"><BarChart data={summary?.by_warehouse || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><ReTooltip /><Bar dataKey="value" fill="#2b7a6b" radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <ChartCard title="Hareket trendi"><AreaChart data={summary?.movement_trend || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><ReTooltip /><Area type="monotone" dataKey="value" stroke="#b7791f" fill="#f6d89a" /></AreaChart></ChartCard>
      </div>
      <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Depolar ve raflar</CardTitle><CardDescription>Hareket geçmişi bulunan kayıtlar silinmez, pasife alınır.</CardDescription></div><Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm depolar</SelectItem>{warehouses.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {visibleWarehouses.map((warehouse) => <div key={warehouse.id} className="rounded-md border border-border/70 p-4"><div className="flex items-start justify-between"><div><p className="font-semibold">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.code} {warehouse.city ? `• ${warehouse.city}` : ''}</p></div><Badge variant={warehouse.is_active ? 'success' : 'secondary'}>{warehouse.is_active ? 'Aktif' : 'Pasif'}</Badge></div><div className="mt-3 flex gap-4 text-sm"><span>{Number(warehouse.stock_total || 0)} stok</span><span>{warehouse.location_count || 0} raf</span></div><div className="mt-3 flex flex-wrap gap-2">{locations.filter((item) => item.warehouse === warehouse.id).map((item) => <Badge key={item.id} variant="outline">{item.code} {item.name}</Badge>)}</div></div>)}
        </CardContent>
      </Card>
      <WarehouseDialog open={warehouseOpen} form={warehouseForm} setForm={setWarehouseForm} onClose={() => setWarehouseOpen(false)} onSave={saveWarehouse} />
      <LocationDialog open={locationOpen} form={locationForm} setForm={setLocationForm} warehouses={warehouses} onClose={() => setLocationOpen(false)} onSave={saveLocation} />
    </div>
  )
}

export function WarehouseOperationsPage() {
  const { toast } = useToast()
  const { warehouses, locations, reload } = useWarehouseData()
  const products = useAppStore((state) => state.data.products)
  const categories = useAppStore((state) => state.data.categories || [])
  const settings = useAppStore((state) => state.data.settings)
  const permissions = useAppStore((state) => state.data.rolePermissions || [])
  const importRef = useRef<HTMLInputElement | null>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [query, setQuery] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selected, setSelected] = useState<Stock | null>(null)
  const [operation, setOperation] = useState<Operation>('IN')
  const [operationOpen, setOperationOpen] = useState(false)
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [allocationProduct, setAllocationProduct] = useState<any>(null)
  const [form, setForm] = useState<any>({ quantity: '', note: '', reference: '', target_location_id: '', detail_1_override: '', detail_2_override: '' })
  const [allocations, setAllocations] = useState<AllocationRow[]>([blankAllocationRow()])

  const loadStocks = async () => {
    const [stockResponse, movementResponse] = await Promise.all([
      api.get('/warehouse-stocks/', { params: { q: query || undefined, warehouse: warehouseFilter === 'all' ? undefined : warehouseFilter, category: categoryFilter === 'all' ? undefined : categoryFilter } }),
      api.get('/stock-movements/', { params: { ordering: '-created_at' } }),
    ])
    setStocks(stockResponse.data || [])
    setMovements((movementResponse.data || []).slice(0, 12))
  }
  useEffect(() => { const timer = window.setTimeout(() => void loadStocks(), 250); return () => window.clearTimeout(timer) }, [query, warehouseFilter, categoryFilter])
  const activeLocations = useMemo(() => locations.filter((item) => item.is_active), [locations])
  const legacyProducts = products.filter((item: any) => item.inventoryMode !== 'warehouse' && Number(item.stock || 0) > 0)

  const startOperation = (stock: Stock, type: Operation) => {
    setSelected(stock); setOperation(type)
    setForm({ quantity: type === 'ADJUST' ? String(stock.quantity) : '', note: '', reference: '', target_location_id: '', detail_1_override: stock.detail_1_override || '', detail_2_override: stock.detail_2_override || '' })
    setOperationOpen(true)
  }
  const submitOperation = async () => {
    const path = operation === 'IN' ? 'stock-in' : operation === 'OUT' ? 'stock-out' : operation === 'ADJUST' ? 'adjust' : 'transfer'
    try {
      await api.post(`/warehouse-stocks/${path}/`, { ...form, product_id: selected?.product || form.product_id, location_id: selected?.location || form.location_id })
      setOperationOpen(false); await loadStocks()
      toast({ title: `${movementLabels[operation]} işlemi tamamlandı` })
    } catch (error) {
      toast({ title: 'Stok işlemi tamamlanamadı', description: apiErrorMessage(error), variant: 'destructive' })
    }
  }
  const exportWorkbook = async () => {
    const response = await api.get('/warehouse-stocks/export/', { responseType: 'blob' })
    const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'depo-sayim-sablonu.xlsx'; link.click(); URL.revokeObjectURL(url)
  }
  const importWorkbook = async (file?: File) => {
    if (!file) return
    const body = new FormData(); body.append('file', file)
    const response = await api.post('/warehouse-stocks/import-count/', body)
    await loadStocks(); toast({ title: 'Sayım Excel’i işlendi', description: `${response.data.changed_rows} satır güncellendi.` })
  }
  const submitAllocation = async () => {
    try {
      await api.post('/warehouse-stocks/allocate-opening-balance/', { product_id: allocationProduct.id, allocations: allocations.map((item) => ({ ...item, location_id: Number(item.location_id) })) })
      setAllocationOpen(false); setAllocationProduct(null); setAllocations([blankAllocationRow()])
      await useAppStore.getState().hydrateFromApi({ force: true }); await loadStocks(); await reload()
      toast({ title: 'Açılış stokları depolara devredildi' })
    } catch (error) {
      toast({ title: 'Açılış devri tamamlanamadı', description: apiErrorMessage(error), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Depo" description="Raf bazlı stokları arayın; giriş, çıkış, sayım ve transfer işlemlerini hesap yapmadan uygulayın."
        actions={<><input ref={importRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => void importWorkbook(event.target.files?.[0])} /><Button onClick={() => { setSelected(null); setOperation('IN'); setForm({ product_id: '', location_id: '', quantity: '', note: '', reference: '', detail_1_override: '', detail_2_override: '' }); setOperationOpen(true) }}><Plus className="mr-2 h-4 w-4" />Stok girişi</Button><Button variant="outline" onClick={() => importRef.current?.click()}><Upload className="mr-2 h-4 w-4" />İçe aktar</Button><Button variant="outline" onClick={() => void exportWorkbook()}><Download className="mr-2 h-4 w-4" />Dışa aktar</Button></>} />
      <Card>
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_220px_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Ürün kodu, ad, kategori veya detay ara" /></div><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm ürün grupları</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={warehouseFilter} onValueChange={setWarehouseFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm depolar</SelectItem>{warehouses.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void loadStocks()}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button></div>
      </Card>
      <Card padded={false}><Table><TableHeader><TableRow><TableHead>Ürün kodu</TableHead><TableHead>Ürün adı</TableHead><TableHead>Detay-1</TableHead><TableHead>Detay-2</TableHead><TableHead>Depo / Raf</TableHead><TableHead className="text-right">Miktar</TableHead><TableHead /></TableRow></TableHeader><TableBody>{stocks.map((stock) => <TableRow key={stock.id}><TableCell className="font-medium">{stock.product_sku}</TableCell><TableCell>{stock.product_name}</TableCell><TableCell>{stock.detail_1 || '-'}</TableCell><TableCell>{stock.detail_2 || '-'}</TableCell><TableCell>{stock.warehouse_name} / {stock.location_code}</TableCell><TableCell className="text-right font-semibold">{stock.quantity}</TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => startOperation(stock, 'IN')}><Plus className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => startOperation(stock, 'OUT')}><Minus className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => startOperation(stock, 'ADJUST')}><RefreshCw className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => startOperation(stock, 'TRANSFER')}><ArrowLeftRight className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></Card>
      <Card><CardHeader><CardTitle>Son stok hareketleri</CardTitle><CardDescription>Giriş, çıkış, sayım ve transfer kayıtları değiştirilemez.</CardDescription></CardHeader><CardContent className="space-y-2">{movements.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"><div><span className="font-medium">{movementLabels[item.movement_type] || item.movement_type}</span><span className="ml-2 text-muted-foreground">{item.location_from || '-'} → {item.location_to || '-'}</span></div><div className="text-right"><p className="font-semibold">{item.quantity}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('tr-TR')}</p></div></div>)}</CardContent></Card>
      {hasPermission(settings.role, permissions, 'warehouse_stock.allocate') && legacyProducts.length > 0 && <Card><CardHeader><CardTitle>Eski stokları depolara aktar</CardTitle><CardDescription>Bu alan yalnız sistem geçişi içindir. Önceden tek toplam olarak tutulan ürün stoklarını ilk kez depo, raf ve varyantlara dağıtır. Günlük işlemler için üstteki stok girişi butonunu kullanın.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/30 p-3"><div><p className="text-sm font-medium">{legacyProducts.length} ürün aktarım bekliyor</p><p className="text-xs text-muted-foreground">Sıfır bakiyeli ürünler bu listede gösterilmez.</p></div><Button variant="outline" onClick={() => { setAllocationProduct(null); setAllocations([blankAllocationRow()]); setAllocationOpen(true) }}><ArrowLeftRight className="mr-2 h-4 w-4" />Aktarım aracını aç</Button></div></CardContent></Card>}
      <OperationDialog open={operationOpen} type={operation} form={form} setForm={setForm} locations={activeLocations} products={products} standalone={!selected} onClose={() => setOperationOpen(false)} onSave={submitOperation} />
      <AllocationDialog open={allocationOpen} product={allocationProduct} setProduct={setAllocationProduct} products={legacyProducts} rows={allocations} setRows={setAllocations} locations={activeLocations} onClose={() => setAllocationOpen(false)} onSave={submitAllocation} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{Number(value).toLocaleString('tr-TR')}</p></Card> }
function ChartCard({ title, children }: any) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></CardContent></Card> }
function Field({ label, children }: any) { return <div className="space-y-1"><Label>{label}</Label>{children}</div> }

function WarehouseDialog({ open, form, setForm, onClose, onSave }: any) {
  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }))
  return <Dialog open={open} onOpenChange={onClose}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Yeni depo</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2"><Field label="Depo kodu"><Input value={form.code} onChange={(e) => set('code', e.target.value)} /></Field><Field label="Depo adı"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field><Field label="Şehir"><Input value={form.city} onChange={(e) => set('city', e.target.value)} /></Field><Field label="Sorumlu"><Input value={form.responsible} onChange={(e) => set('responsible', e.target.value)} /></Field><Field label="Telefon"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field><Field label="E-posta"><Input value={form.email} onChange={(e) => set('email', e.target.value)} /></Field><Field label="Kapasite"><Input type="number" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} /></Field><Field label="Kapasite birimi"><Input value={form.capacity_unit} onChange={(e) => set('capacity_unit', e.target.value)} /></Field><div className="md:col-span-2"><Field label="Adres"><Textarea value={form.address} onChange={(e) => set('address', e.target.value)} /></Field></div></div><DialogFooter><Button onClick={onSave}>Kaydet</Button></DialogFooter></DialogContent></Dialog>
}
function LocationDialog({ open, form, setForm, warehouses, onClose, onSave }: any) {
  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }))
  return <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Yeni raf</DialogTitle></DialogHeader><Field label="Depo"><Select value={form.warehouse} onValueChange={(v) => set('warehouse', v)}><SelectTrigger><SelectValue placeholder="Depo seçin" /></SelectTrigger><SelectContent>{warehouses.filter((w: any) => w.is_active).map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Raf kodu"><Input value={form.code} onChange={(e) => set('code', e.target.value)} /></Field><Field label="Raf adı"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field><DialogFooter><Button onClick={onSave}>Kaydet</Button></DialogFooter></DialogContent></Dialog>
}
function OperationDialog({ open, type, form, setForm, locations, products, standalone, onClose, onSave }: any) {
  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }))
  const productOptions = products.map((item: any) => ({ value: String(item.id), label: `${item.sku} · ${item.name}`, searchText: item.categoryName || item.category || '' }))
  const selectProduct = (productId: string) => {
    const product = products.find((item: any) => String(item.id) === productId)
    const details = Object.values(product?.attributeValues || {}).filter((value) => value != null && String(value).trim())
    setForm((current: any) => ({ ...current, product_id: productId, detail_1_override: String(product?.templateDefaults?.primary || details[0] || ''), detail_2_override: String(product?.templateDefaults?.secondary || details[1] || '') }))
  }
  return <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>{movementLabels[type]} işlemi</DialogTitle></DialogHeader>{standalone && <><Field label="Ürün"><SearchableCombobox value={String(form.product_id || '')} options={productOptions} placeholder="Ürün seçin" searchPlaceholder="Ürün kodu veya adı yazın" emptyMessage="Eşleşen ürün bulunamadı" onValueChange={selectProduct} /></Field><Field label="Depo / raf"><Select value={form.location_id} onValueChange={(v) => set('location_id', v)}><SelectTrigger><SelectValue placeholder="Raf seçin" /></SelectTrigger><SelectContent>{locations.map((item: Location) => <SelectItem key={item.id} value={String(item.id)}>{item.warehouse_name} / {item.code}</SelectItem>)}</SelectContent></Select></Field></>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Detay-1"><Input value={form.detail_1_override || ''} onChange={(e) => set('detail_1_override', e.target.value)} disabled={!standalone && type !== 'ADJUST'} /></Field><Field label="Detay-2"><Input value={form.detail_2_override || ''} onChange={(e) => set('detail_2_override', e.target.value)} disabled={!standalone && type !== 'ADJUST'} /></Field></div><Field label={type === 'ADJUST' ? 'Hedef miktar' : 'Miktar'}><Input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>{type === 'TRANSFER' && <Field label="Hedef raf"><Select value={form.target_location_id} onValueChange={(v) => set('target_location_id', v)}><SelectTrigger><SelectValue placeholder="Hedef rafı seçin" /></SelectTrigger><SelectContent>{locations.map((item: Location) => <SelectItem key={item.id} value={String(item.id)}>{item.warehouse_name} / {item.code}</SelectItem>)}</SelectContent></Select></Field>}<Field label="Referans"><Input value={form.reference} onChange={(e) => set('reference', e.target.value)} /></Field><Field label="Açıklama"><Textarea value={form.note} onChange={(e) => set('note', e.target.value)} /></Field><DialogFooter><Button onClick={onSave}>Uygula</Button></DialogFooter></DialogContent></Dialog>
}
function AllocationDialog({ open, product, setProduct, products, rows, setRows, locations, onClose, onSave }: any) {
  const total = rows.reduce((sum: number, row: AllocationRow) => sum + Number(row.quantity || 0), 0)
  const expected = Number(product?.stock || 0)
  const remaining = expected - total
  const isReady = Boolean(product) && rows.length > 0 && rows.every((row: AllocationRow) => row.location_id && Number(row.quantity) > 0) && remaining === 0
  const productOptions = products.map((item: any) => ({ value: String(item.id), label: `${item.sku} · ${item.name}`, searchText: item.categoryName || item.category || '' }))
  const updateRow = (index: number, key: keyof AllocationRow, value: string) => setRows((current: AllocationRow[]) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  const removeRow = (index: number) => setRows((current: AllocationRow[]) => current.filter((_: AllocationRow, rowIndex: number) => rowIndex !== index))
  const selectProduct = (productId: string) => {
    setProduct(products.find((item: any) => String(item.id) === productId) || null)
    setRows([blankAllocationRow()])
  }
  return <Dialog open={open} onOpenChange={onClose}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Eski stokları depolara aktar</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Kaynak, eski sistemdeki ürün toplamıdır. Satırlarda bu toplamın başlangıçta hangi depo, raf ve varyantlarda bulunduğunu tanımlayın.</p><Field label="Aktarılacak ürün"><SearchableCombobox value={String(product?.id || '')} options={productOptions} placeholder="Ürün seçin" searchPlaceholder="Ürün kodu veya adı yazın" emptyMessage="Aktarım bekleyen ürün bulunamadı" onValueChange={selectProduct} /></Field>{product && <><div className="grid gap-2 sm:grid-cols-3"><Metric label="Eski toplam stok" value={expected} /><Metric label="Dağıtılan" value={total} /><Metric label="Kalan" value={remaining} /></div><div className="space-y-2">{rows.map((row: AllocationRow, index: number) => <div key={index} className="grid gap-2 rounded-md border border-border/70 p-3 lg:grid-cols-[minmax(180px,1fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_110px_auto]"><Select value={row.location_id} onValueChange={(value) => updateRow(index, 'location_id', value)}><SelectTrigger><SelectValue placeholder="Depo / raf" /></SelectTrigger><SelectContent>{locations.map((item: Location) => <SelectItem key={item.id} value={String(item.id)}>{item.warehouse_name} / {item.code}</SelectItem>)}</SelectContent></Select><Input value={row.detail_1_override} onChange={(event) => updateRow(index, 'detail_1_override', event.target.value)} placeholder="Detay-1" /><Input value={row.detail_2_override} onChange={(event) => updateRow(index, 'detail_2_override', event.target.value)} placeholder="Detay-2" /><Input type="number" min="0" value={row.quantity} onChange={(event) => updateRow(index, 'quantity', event.target.value)} placeholder="Miktar" /><Button type="button" size="icon" variant="ghost" disabled={rows.length === 1} onClick={() => removeRow(index)}><Trash2 className="h-4 w-4" /></Button></div>)}</div><Button type="button" variant="outline" size="sm" onClick={() => setRows((current: AllocationRow[]) => [...current, blankAllocationRow()])}><Plus className="mr-2 h-4 w-4" />Dağıtım satırı ekle</Button></>}<DialogFooter><Button onClick={onSave} disabled={!isReady}>Devral</Button></DialogFooter></DialogContent></Dialog>
}
