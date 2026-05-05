import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, FileDown, Layers, Loader2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import {
  type ConsumptionSeriesItem,
  downloadMdfExitsPdf,
  downloadMdfStockPdf,
  fetchMdfConsumption,
  fetchMdfSkus,
  formatApiError,
  type StockRow,
} from '@/lib/mdf-api'

export function MdfManagementPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<StockRow[]>([])
  const [chartData, setChartData] = useState<ConsumptionSeriesItem[]>([])
  const [consumptionMonthLabel, setConsumptionMonthLabel] = useState('')
  const [consumptionTotal, setConsumptionTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [entryThickness, setEntryThickness] = useState('')
  const [entryWidth, setEntryWidth] = useState('')
  const [entryHeight, setEntryHeight] = useState('')
  const [entryQty, setEntryQty] = useState('0')
  const [entryNote, setEntryNote] = useState('')

  const [exitDate, setExitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [exitMdfId, setExitMdfId] = useState('')
  const [exitQty, setExitQty] = useState('0')
  const [exitUsage, setExitUsage] = useState('')

  const refreshAll = useCallback(async () => {
    const [skus, cons] = await Promise.all([fetchMdfSkus(), fetchMdfConsumption()])
    setRows(skus)
    setChartData(cons.chartData)
    setConsumptionMonthLabel(cons.monthLabel)
    setConsumptionTotal(cons.total)
    setExitMdfId((prev) => {
      if (prev && skus.some((s) => s.id === prev)) return prev
      return skus[0]?.id ?? ''
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await refreshAll()
      } catch (e) {
        if (!cancelled) {
          toast({
            title: 'MDF verisi yüklenemedi',
            description: formatApiError(e),
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + refreshAll only
  }, [refreshAll])

  const mdfOptions = useMemo(
    () => rows.map((r) => ({ id: r.id, label: `${r.thicknessMm} mm · ${r.widthCm} × ${r.heightCm} cm` })),
    [rows]
  )

  const stats = useMemo(() => {
    const total = rows.length
    const sufficient = rows.filter((r) => r.totalQty >= r.minThreshold).length
    const low = rows.filter((r) => r.totalQty > 0 && r.totalQty < r.minThreshold).length
    const empty = rows.filter((r) => r.totalQty <= 0).length
    return { total, sufficient, low, empty }
  }, [rows])

  const outOfStockLines = useMemo(
    () => rows.filter((r) => r.totalQty <= 0).map((r) => `${r.thicknessMm}mm ${r.widthCm}x${r.heightCm}`),
    [rows]
  )

  const handlePdf = async (kind: 'stock' | 'exit') => {
    try {
      if (kind === 'stock') await downloadMdfStockPdf()
      else await downloadMdfExitsPdf()
      toast({ title: kind === 'stock' ? 'Stok PDF' : 'Çıkış PDF', description: 'İndirme başlatıldı.' })
    } catch (e) {
      toast({ title: 'PDF indirilemedi', description: formatApiError(e), variant: 'destructive' })
    }
  }

  const handleAddStock = async () => {
    const t = Number(entryThickness)
    const w = Number(entryWidth)
    const h = Number(entryHeight)
    const q = Number(entryQty)
    if (!t || !w || !h || q <= 0) {
      toast({ title: 'Eksik bilgi', description: 'Kalınlık, en, boy ve adet zorunludur.', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      await api.post('/mdf-skus/stock-in/', {
        thickness_mm: t,
        width_cm: w,
        height_cm: h,
        quantity: q,
        note: entryNote.trim() || undefined,
      })
      await refreshAll()
      toast({ title: 'Stoka eklendi', description: entryNote || `${t}mm ${w}×${h} — +${q} adet` })
      setEntryThickness('')
      setEntryWidth('')
      setEntryHeight('')
      setEntryQty('0')
      setEntryNote('')
    } catch (e) {
      toast({ title: 'Giriş kaydedilemedi', description: formatApiError(e), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const handleSaveExit = async () => {
    const q = Number(exitQty)
    if (!exitMdfId || q <= 0) {
      toast({ title: 'Eksik bilgi', description: 'MDF seçimi ve adet zorunludur.', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      await api.post('/mdf-skus/stock-out/', {
        sku: Number(exitMdfId),
        movement_date: exitDate,
        quantity: q,
        usage: exitUsage.trim() || undefined,
      })
      await refreshAll()
      toast({ title: 'Çıkış kaydedildi', description: exitUsage || `-${q} adet` })
      setExitQty('0')
      setExitUsage('')
    } catch (e) {
      toast({ title: 'Çıkış kaydedilemedi', description: formatApiError(e), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const updateThresholdLocal = (id: string, value: string) => {
    const n = Number(value)
    if (Number.isNaN(n) || n < 0) return
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, minThreshold: n } : r)))
  }

  const persistThreshold = async (id: string, minThreshold: number) => {
    try {
      await api.patch(`/mdf-skus/${id}/`, { min_threshold: minThreshold })
    } catch (e) {
      toast({ title: 'Eşik güncellenemedi', description: formatApiError(e), variant: 'destructive' })
      await refreshAll()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MDF Yönetimi"
        description="Stok girişi · Çıkış takibi · Özet"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-amber-900/40 bg-amber-900/5 text-amber-950 hover:bg-amber-900/10"
              disabled={busy || loading}
              onClick={() => handlePdf('stock')}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Stok PDF
            </Button>
            <Button
              variant="outline"
              className="border-amber-900/40 bg-amber-900/5 text-amber-950 hover:bg-amber-900/10"
              disabled={busy || loading}
              onClick={() => handlePdf('exit')}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Çıkış PDF
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/mdf/history">Giriş / Çıkış geçmişi</Link>
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Veriler yükleniyor…
        </div>
      )}

      {outOfStockLines.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            <strong>Tükenen stok:</strong> {outOfStockLines.join(' · ')}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-t-4 border-t-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Toplam kalem
            </CardDescription>
            <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">Kayıtlı ürün</CardContent>
        </Card>
        <Card className="overflow-hidden border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Yeterli stok
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-700">{stats.sufficient}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">≥ eşik değeri</CardContent>
        </Card>
        <Card className="overflow-hidden border-t-4 border-t-amber-400">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Az kalan
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-700">{stats.low}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">&lt; eşik, stokta var</CardContent>
        </Card>
        <Card className="overflow-hidden border-t-4 border-t-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tükenen
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-red-600">{stats.empty}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">0 adet</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-emerald-600" />
              Yeni MDF girişi
            </CardTitle>
            <CardDescription>Levha stokuna ekleme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kalınlık (mm) *</Label>
                <Input placeholder="Örn: 18" value={entryThickness} onChange={(e) => setEntryThickness(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-2">
                <Label>En (cm) *</Label>
                <Input placeholder="210" value={entryWidth} onChange={(e) => setEntryWidth(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-2">
                <Label>Boy (cm) *</Label>
                <Input placeholder="280" value={entryHeight} onChange={(e) => setEntryHeight(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-2">
                <Label>Adet *</Label>
                <Input type="number" min={0} value={entryQty} onChange={(e) => setEntryQty(e.target.value)} disabled={busy} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input placeholder="Opsiyonel" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} disabled={busy} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => void handleAddStock()} disabled={busy || loading}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}+ Stoka ekle
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-700">Yeni çıkış kaydı</CardTitle>
            <CardDescription>Stoktan düşüm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tarih *</Label>
              <Input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-2">
              <Label>MDF seçin *</Label>
              <Select value={exitMdfId || undefined} onValueChange={setExitMdfId} disabled={busy || rows.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={rows.length ? 'Levha seçin' : 'Önce stok girişi yapın'} />
                </SelectTrigger>
                <SelectContent>
                  {mdfOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kullanılan adet *</Label>
              <Input type="number" min={0} value={exitQty} onChange={(e) => setExitQty(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-2">
              <Label>Kullanım yeri</Label>
              <Input placeholder="Bölüm / sipariş" value={exitUsage} onChange={(e) => setExitUsage(e.target.value)} disabled={busy} />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void handleSaveExit()}
              disabled={busy || loading || rows.length === 0}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}+ Kaydet
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Toplu özet</CardTitle>
            <CardDescription>Mevcut stok ve minimum eşik</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Kalınlık</th>
                  <th className="pb-2 pr-2 font-medium">En × Boy</th>
                  <th className="pb-2 pr-2 text-right font-medium">Toplam mevcut</th>
                  <th className="pb-2 pr-2 text-right font-medium">Min. eşik</th>
                  <th className="pb-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ok = r.totalQty >= r.minThreshold
                  const zero = r.totalQty <= 0
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-2">{r.thicknessMm} mm</td>
                      <td className="py-2 pr-2">
                        {r.widthCm} × {r.heightCm}
                      </td>
                      <td className="py-2 pr-2 text-right font-semibold tabular-nums">{r.totalQty}</td>
                      <td className="py-2 pr-2 text-right">
                        <Input
                          className="h-8 w-16 text-right tabular-nums"
                          type="number"
                          min={0}
                          value={r.minThreshold}
                          onChange={(e) => updateThresholdLocal(r.id, e.target.value)}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            if (!Number.isNaN(v) && v >= 0) void persistThreshold(r.id, v)
                          }}
                          disabled={busy}
                        />
                      </td>
                      <td className="py-2">
                        {zero ? (
                          <Badge variant="destructive">Tükendi</Badge>
                        ) : ok ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Mevcut</Badge>
                        ) : (
                          <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-amber-900">
                            Az kaldı
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!loading && rows.length === 0 && (
              <p className="pt-3 text-sm text-muted-foreground">Henüz kayıtlı levha yok; soldan giriş ekleyin.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Kalınlığa göre tüketim</CardTitle>
            <CardDescription className="capitalize">
              {consumptionMonthLabel || '—'} — toplam: {consumptionTotal} levha (çıkışlara göre)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] min-h-[280px] min-w-0">
            {chartData.length === 0 ? (
              <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                Bu ay için çıkış kaydı yok.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <BarChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <ReTooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {chartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-muted-foreground">
                  {chartData.map((d) => (
                    <span key={d.key} className="tabular-nums">
                      <span className="font-medium" style={{ color: d.fill }}>
                        {d.label}
                      </span>
                      : {d.value} / {d.pct}%
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
