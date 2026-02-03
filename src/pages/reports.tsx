import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { DownloadCloud, Save } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export function ReportsPage() {
  const { data } = useAppStore()
  const { toast } = useToast()
  const [dataset, setDataset] = useState('invoices')
  const [groupBy, setGroupBy] = useState('status')
  const [filter, setFilter] = useState('all')
  const [name, setName] = useState('Demo raporu')

  const rows = dataset === 'invoices' ? data.invoices : data.leads
  const grouped = rows.reduce<Record<string, number>>((acc, row: any) => {
    const key = row[groupBy] ?? 'Unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const chartData = Object.entries(grouped).map(([key, value]) => ({ key, value }))

  const tasks = data.tasks || []
  const now = Date.now()
  const overdue = tasks.filter((t) => t.due && t.status !== 'done' && new Date(t.due).getTime() < now)
  const done = tasks.filter((t) => t.status === 'done')
  const avgCompletionDays =
    done.length > 0
      ? Math.round(
          done.reduce((sum, t) => {
            const start = t.start ? new Date(t.start).getTime() : now
            const end = t.end ? new Date(t.end).getTime() : now
            return sum + Math.max(0, end - start)
          }, 0) /
            done.length /
            (1000 * 60 * 60 * 24)
        )
      : 0
  const throughputByMonth = (() => {
    const map = new Map<string, number>()
    done.forEach((t) => {
      const end = t.end || t.due || t.start
      if (!end) return
      const key = (end as string).slice(0, 7)
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([month, value]) => ({ month, value }))
  })()

  const timeEntries = data.tasks.flatMap((t) =>
    ((t as any).time_entries || []).map((te: any) => ({ ...te, taskTitle: t.title }))
  )
  const timeByUser = timeEntries.reduce<Record<string, number>>((acc, te) => {
    const key = te.user_name || te.user || 'Bilinmiyor'
    const start = te.started_at ? new Date(te.started_at).getTime() : 0
    const end = te.ended_at ? new Date(te.ended_at).getTime() : Date.now()
    const hours = Math.max(0, end - start) / (1000 * 60 * 60)
    acc[key] = (acc[key] ?? 0) + hours
    return acc
  }, {})
  const timeByTask = timeEntries.reduce<Record<string, number>>((acc, te) => {
    const key = te.taskTitle || te.task
    const start = te.started_at ? new Date(te.started_at).getTime() : 0
    const end = te.ended_at ? new Date(te.ended_at).getTime() : Date.now()
    const hours = Math.max(0, end - start) / (1000 * 60 * 60)
    acc[key] = (acc[key] ?? 0) + hours
    return acc
  }, {})
  const budgetDelta = data.tasks.map((t) => {
    const planned = (t as any).plannedHours ? Number((t as any).plannedHours) : 0
    const actual = timeEntries
      .filter((te) => te.taskTitle === t.title)
      .reduce((sum, te) => {
        const s = te.started_at ? new Date(te.started_at).getTime() : 0
        const e = te.ended_at ? new Date(te.ended_at).getTime() : Date.now()
        return sum + Math.max(0, e - s) / (1000 * 60 * 60)
      }, 0)
    return { title: t.title, planned, actual, diff: actual - planned }
  })

  return (
    <div className="space-y-4">
      <PageHeader title="Rapor Oluşturucu" description="Veri seti, filtre, grupla, önizle" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Konfigürasyon</CardTitle>
            <CardDescription>Grafik veya tablo oluştur</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Veri seti</Label>
              <Select value={dataset} onValueChange={setDataset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoices">Faturalar</SelectItem>
                  <SelectItem value="leads">Leadler</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Grupla</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Durum</SelectItem>
                  <SelectItem value="owner">Sahip</SelectItem>
                  <SelectItem value="source">Kaynak/Aşama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filtre</Label>
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ör. status=Paid" />
            </div>
            <div>
              <Label>Rapor adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => toast({ title: 'Rapor kaydedildi', description: name })}>
                <Save className="mr-2 h-4 w-4" />
                Kaydet
              </Button>
              <Button variant="outline">
                <DownloadCloud className="mr-2 h-4 w-4" />
                Dışa aktar
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle>Önizleme</CardTitle>
            <CardDescription>Seçilen yapılandırmanın canlı önizlemesi</CardDescription>
          </CardHeader>
          <CardContent className="h-80 min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="key" />
                <YAxis allowDecimals={false} />
                <ReTooltip />
                <Area dataKey="value" stroke="#2563eb" fill="#2563eb40" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Geciken görevler</CardTitle>
            <CardDescription>Durumu tamamlanmamış ve vadesi geçmiş</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded border px-3 py-2">
              <div>
                <p className="text-sm text-muted-foreground">Adet</p>
                <p className="text-2xl font-semibold">{overdue.length}</p>
              </div>
              <Badge variant="outline">SLA riski</Badge>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {overdue.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="truncate">{t.title}</span>
                  <span>{formatDate(t.due)}</span>
                </div>
              ))}
              {overdue.length === 0 && <p>Geciken görev yok</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
            <CardDescription>Son 6 ay tamamlanan görev</CardDescription>
          </CardHeader>
          <CardContent className="h-56 min-h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={throughputByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <ReTooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-4 pb-4 text-xs text-muted-foreground">Tamamlanan görev trendi</div>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Tamamlanma süresi</CardTitle>
            <CardDescription>Ortalama gün</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-semibold">{avgCompletionDays}g</p>
              <p className="text-sm text-muted-foreground">Start → End farkı</p>
            </div>
            <Badge variant="secondary">{done.length} tamamlandı</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Zaman takibi — kullanıcı</CardTitle>
            <CardDescription>Toplam saat (tamamlanmış + açık kayıtlar)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(timeByUser).length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
            {Object.entries(timeByUser)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([user, hrs]) => (
                <div key={user} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <span className="font-medium">{user}</span>
                  <span className="text-muted-foreground">{hrs.toFixed(1)}s</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Zaman takibi — görev</CardTitle>
            <CardDescription>En çok süre harcanan 8 görev</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(timeByTask).length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
            {Object.entries(timeByTask)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([taskName, hrs]) => (
                <div key={taskName} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <span className="font-medium truncate">{taskName}</span>
                  <span className="text-muted-foreground">{hrs.toFixed(1)}s</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Planlanan vs Gerçekleşen</CardTitle>
            <CardDescription>Saat bazlı karşılaştırma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {budgetDelta.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
            {budgetDelta
              .filter((b) => b.planned || b.actual)
              .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
              .slice(0, 8)
              .map((b, idx) => (
                <div key={idx} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium truncate">{b.title}</span>
                    <span className="text-xs text-muted-foreground">
                      Planlanan {b.planned.toFixed(1)}s • Gerçekleşen {b.actual.toFixed(1)}s
                    </span>
                  </div>
                  <Badge variant={b.diff > 0.1 ? 'destructive' : 'secondary'}>
                    {b.diff >= 0 ? '+' : ''}
                    {b.diff.toFixed(1)}s
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

