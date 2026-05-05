import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { fetchMdfHistory, formatApiError, type ApiMovement } from '@/lib/mdf-api'

type EntryRow = {
  id: number
  date: string
  thicknessMm: number
  widthCm: number
  heightCm: number
  qty: number
  description: string
}

type ExitRow = {
  id: number
  date: string
  thicknessMm: number
  widthCm: number
  heightCm: number
  qty: number
  usage: string
}

function mapEntry(m: ApiMovement): EntryRow {
  return {
    id: m.id,
    date: m.movement_date,
    thicknessMm: m.thickness_mm,
    widthCm: m.width_cm,
    heightCm: m.height_cm,
    qty: m.quantity,
    description: m.note || '—',
  }
}

function mapExit(m: ApiMovement): ExitRow {
  return {
    id: m.id,
    date: m.movement_date,
    thicknessMm: m.thickness_mm,
    widthCm: m.width_cm,
    heightCm: m.height_cm,
    qty: m.quantity,
    usage: m.note || '—',
  }
}

export function MdfHistoryPage() {
  const { toast } = useToast()
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [exits, setExits] = useState<ExitRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMdfHistory(rangeStart || undefined, rangeEnd || undefined)
      setEntries((data.entries || []).map(mapEntry))
      setExits((data.exits || []).map(mapExit))
    } catch (e) {
      toast({ title: 'Geçmiş yüklenemedi', description: formatApiError(e), variant: 'destructive' })
      setEntries([])
      setExits([])
    } finally {
      setLoading(false)
    }
  }, [rangeStart, rangeEnd, toast])

  useEffect(() => {
    void load()
  }, [load])

  const clearRange = () => {
    setRangeStart('')
    setRangeEnd('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MDF Giriş / Çıkış Geçmişi"
        description="Ne zaman — ne kadar — neden"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/mdf">
              <ArrowLeft className="mr-2 h-4 w-4" />
              MDF yönetimi
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Başlangıç</Label>
            <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bitiş</Label>
            <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-[160px]" />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={clearRange}>
            Tümü
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yenile'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {rangeStart || rangeEnd ? 'Seçilen aralık (sunucu filtresi)' : 'Tüm zamanlar'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-emerald-500/20 bg-emerald-500/5">
            <CardTitle className="text-lg text-emerald-700">Giriş geçmişi</CardTitle>
            <CardDescription>Stoka eklenen levhalar</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Tarih</th>
                    <th className="px-3 py-2 font-medium">Kalınlık</th>
                    <th className="px-3 py-2 font-medium">En × Boy</th>
                    <th className="px-3 py-2 text-right font-medium">Adet</th>
                    <th className="px-3 py-2 font-medium">Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.date}</td>
                      <td className="px-3 py-2">{row.thicknessMm} mm</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.widthCm} × {row.heightCm}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600 tabular-nums">+{row.qty}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground" title={row.description}>
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && entries.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Bu aralıkta giriş kaydı yok.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-red-500/20 bg-red-500/5">
            <CardTitle className="text-lg text-red-700">Çıkış geçmişi</CardTitle>
            <CardDescription>Stoktan çıkan levhalar</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Tarih</th>
                    <th className="px-3 py-2 font-medium">Kalınlık</th>
                    <th className="px-3 py-2 font-medium">En × Boy</th>
                    <th className="px-3 py-2 text-right font-medium">Adet</th>
                    <th className="px-3 py-2 font-medium">Kullanım yeri</th>
                  </tr>
                </thead>
                <tbody>
                  {exits.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.date}</td>
                      <td className="px-3 py-2">{row.thicknessMm} mm</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.widthCm} × {row.heightCm}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600 tabular-nums">-{row.qty}</td>
                      <td className="max-w-[220px] px-3 py-2 text-muted-foreground">
                        <span className="line-clamp-2" title={row.usage}>
                          {row.usage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && exits.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Bu aralıkta çıkış kaydı yok.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
