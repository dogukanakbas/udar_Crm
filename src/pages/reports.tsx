import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { DownloadCloud, FileSpreadsheet, FileText, RefreshCw, Save } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'

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
import api from '@/lib/api'
import { taskPriorityLabelTR, taskStatusLabelTR } from '@/lib/task-labels'
import { DataTable } from '@/components/data-table'

type TaskReportTask = {
  id: number
  title: string
  status: string
  priority: string
  team_name: string
  assignee_username: string
  owner_username: string
  completed_at: string
  planned_hours: number
}

type TaskReportSummary = {
  year: number
  month: number | null
  period_start: string
  period_end: string
  monthly_timeline: { year_month: string; month_label: string; completed_count: number; created_count: number }[]
  by_team: { team_id: number; team_name: string; tasks_completed_in_period: number; tasks_active: number }[]
  by_user: { user_id: number; username: string; tasks_completed: number; tasks_active: number; hours_logged: number }[]
  tasks: TaskReportTask[]
}

export function ReportsPage() {
  const { data } = useAppStore()
  const { toast } = useToast()
  const role = data.settings.role
  const canReports = role === 'Admin' || role === 'Manager' || role === 'Finance'

  const [dataset, setDataset] = useState('invoices')
  const [groupBy, setGroupBy] = useState('status')
  const [filter, setFilter] = useState('all')
  const [name, setName] = useState('Yeni rapor')

  const currentYear = new Date().getFullYear()
  const [reportYear, setReportYear] = useState(currentYear)
  const [reportMonth, setReportMonth] = useState<string>('all')
  const [reportTeam, setReportTeam] = useState<string>('all')
  const [reportUser, setReportUser] = useState<string>('all')
  const [reportStatus, setReportStatus] = useState<string>('all')
  const [taskReport, setTaskReport] = useState<TaskReportSummary | null>(null)
  const [taskReportLoading, setTaskReportLoading] = useState(false)
  const [prodDay, setProdDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [prodReport, setProdReport] = useState<{
    date: string
    total_quantity: number
    by_team: Record<string, number>
    entries: { task_title: string; quantity: number; team_name?: string; user_name?: string }[]
  } | null>(null)

  const loadTaskReport = useCallback(async () => {
    if (!canReports) return
    setTaskReportLoading(true)
    try {
      const params: Record<string, string> = { year: String(reportYear) }
      if (reportMonth !== 'all') params.month = reportMonth
      if (reportTeam !== 'all') params.team_id = reportTeam
      if (reportUser !== 'all') params.assignee_id = reportUser
      if (reportStatus !== 'all') params.status = reportStatus
      const res = await api.get<TaskReportSummary>('/task-reports/summary/', { params })
      setTaskReport(res.data)
    } catch (e: any) {
      toast({
        title: 'Rapor yüklenemedi',
        description: e?.response?.data?.detail || 'Sunucu hatası',
        variant: 'destructive',
      })
      setTaskReport(null)
    } finally {
      setTaskReportLoading(false)
    }
  }, [canReports, reportYear, reportMonth, reportTeam, reportUser, reportStatus, toast])

  useEffect(() => {
    loadTaskReport()
  }, [loadTaskReport])

  const loadProdReport = useCallback(async () => {
    if (!canReports) return
    try {
      const res = await api.get('/tasks/production-report/', { params: { date: prodDay } })
      setProdReport(res.data)
    } catch {
      setProdReport(null)
    }
  }, [canReports, prodDay])

  useEffect(() => {
    loadProdReport()
  }, [loadProdReport])

  const downloadExport = async (format: 'xlsx' | 'docx') => {
    if (!canReports) return
    try {
      const params: Record<string, string> = { year: String(reportYear), format }
      if (reportMonth !== 'all') params.month = reportMonth
      if (reportTeam !== 'all') params.team_id = reportTeam
      if (reportUser !== 'all') params.assignee_id = reportUser
      if (reportStatus !== 'all') params.status = reportStatus
      const res = await api.get('/task-reports/export/', { params, responseType: 'blob' })
      const blob = new Blob([res.data], {
        type:
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gorev_raporu_${reportYear}_${reportMonth === 'all' ? 'yillik' : reportMonth}.${format === 'xlsx' ? 'xlsx' : 'docx'}`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({ title: 'İndirme başladı', description: format === 'xlsx' ? 'Excel dosyası' : 'Word dosyası' })
    } catch (e: any) {
      toast({
        title: 'İndirilemedi',
        description: e?.response?.data?.detail || 'Dosya oluşturulamadı',
        variant: 'destructive',
      })
    }
  }

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
  const throughputByMonthLocal = (() => {
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

  const taskReportColumns: ColumnDef<TaskReportTask>[] = useMemo(
    () => [
      { accessorKey: 'id', header: 'ID', size: 70 },
      { accessorKey: 'title', header: 'Başlık', size: 220 },
      {
        accessorKey: 'status',
        header: 'Durum',
        cell: ({ row }) => taskStatusLabelTR(row.original.status),
      },
      {
        accessorKey: 'priority',
        header: 'Öncelik',
        cell: ({ row }) => taskPriorityLabelTR(row.original.priority),
      },
      { accessorKey: 'team_name', header: 'Ekip' },
      { accessorKey: 'assignee_username', header: 'Atanan' },
      { accessorKey: 'owner_username', header: 'Sahip' },
      {
        accessorKey: 'completed_at',
        header: 'Tamamlanma',
        cell: ({ row }) =>
          row.original.completed_at ? formatDate(row.original.completed_at) : '—',
      },
      {
        accessorKey: 'planned_hours',
        header: 'Plan (saat)',
        cell: ({ row }) => Number(row.original.planned_hours ?? 0).toFixed(1),
      },
    ],
    []
  )

  const monthlyChartData =
    taskReport?.monthly_timeline.map((m) => ({
      label: m.month_label,
      Tamamlanan: m.completed_count,
      Olusturulan: m.created_count,
    })) ?? []

  if (!canReports) {
    return (
      <div className="space-y-4">
        <PageHeader title="Raporlar" description="Bu sayfaya yalnızca Yönetim ve Finans rolleri erişebilir." />
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">Yetkiniz yok.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Raporlar"
        description="Görev performansı: yıl/ay, ekip, çalışan; Excel ve Word dışa aktarma"
      />

      <Card>
        <CardHeader>
          <CardTitle>Günlük üretim</CardTitle>
          <CardDescription>Görevlerden girilen tamamlanan adetler (tarih seçip yenileyin)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Tarih</Label>
              <Input type="date" value={prodDay} onChange={(e) => setProdDay(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => loadProdReport()}>
              Yenile
            </Button>
          </div>
          {prodReport && (
            <>
              <p className="text-sm">
                Toplam: <strong>{prodReport.total_quantity}</strong> ad
              </p>
              {prodReport.by_team && Object.keys(prodReport.by_team).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(prodReport.by_team).map(([name, q]) => (
                    <Badge key={name} variant="secondary">
                      {name}: {q}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="max-h-56 overflow-y-auto text-xs space-y-1 border rounded p-2">
                {(prodReport.entries || []).map((e, i) => (
                  <div key={i}>
                    {prodReport.date} • {e.task_title} • {e.quantity} ad • {e.team_name || '—'} • {e.user_name || '—'}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Görev raporları</CardTitle>
              <CardDescription>
                Tamamlanan görevler yıl içinde aylık kırılım; ekip ve çalışan özetleri; görev satır detayı. Excel çok sayfalı,
                Word özet + liste.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => loadTaskReport()} disabled={taskReportLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${taskReportLoading ? 'animate-spin' : ''}`} />
                Yenile
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadExport('xlsx')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel (.xlsx)
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadExport('docx')}>
                <FileText className="mr-2 h-4 w-4" />
                Word (.docx)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label>Yıl</Label>
              <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ay (filtre)</Label>
              <Select value={reportMonth} onValueChange={setReportMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm yıl (özet grafik: yıl)</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m}. ay
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ekip</Label>
              <Select value={reportTeam} onValueChange={setReportTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {data.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Çalışan (atanan)</Label>
              <Select value={reportUser} onValueChange={setReportUser}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {data.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Durum</Label>
              <Select value={reportStatus} onValueChange={setReportStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="done">Tamamlandı</SelectItem>
                  <SelectItem value="in-progress">Devam ediyor</SelectItem>
                  <SelectItem value="todo">Yapılacak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {taskReport && (
            <p className="text-xs text-muted-foreground">
              Dönem: {formatDate(taskReport.period_start)} — {formatDate(taskReport.period_end)} · Görev satırları:{' '}
              {taskReport.tasks.length}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">Aylık tamamlanan / oluşturulan</CardTitle>
                <CardDescription>Seçilen yıl (ve isteğe bağlı ay filtresi için özet tablolar)</CardDescription>
              </CardHeader>
              <CardContent className="h-72 min-h-[280px] min-w-0">
                {monthlyChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} />
                      <ReTooltip />
                      <Bar dataKey="Tamamlanan" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Olusturulan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ekip bazlı (seçilen dönem)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-48 overflow-y-auto text-sm">
                  {(taskReport?.by_team ?? []).map((r) => (
                    <div key={r.team_id} className="flex justify-between border-b border-border/60 py-1">
                      <span>{r.team_name}</span>
                      <span className="text-muted-foreground">
                        Tamam: {r.tasks_completed_in_period} · Aktif: {r.tasks_active}
                      </span>
                    </div>
                  ))}
                  {taskReport?.by_team?.length === 0 && <p className="text-muted-foreground">Kayıt yok</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Çalışan bazlı</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-48 overflow-y-auto text-sm">
                  {(taskReport?.by_user ?? []).map((r) => (
                    <div key={r.user_id} className="flex justify-between border-b border-border/60 py-1">
                      <span>{r.username}</span>
                      <span className="text-muted-foreground">
                        Tamam: {r.tasks_completed} · Saat: {r.hours_logged}
                      </span>
                    </div>
                  ))}
                  {taskReport?.by_user?.length === 0 && <p className="text-muted-foreground">Kayıt yok</p>}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Görev detay listesi</CardTitle>
              <CardDescription>Dönemde oluşan / güncellenen / tamamlanan görevler (sunucu verisi)</CardDescription>
            </CardHeader>
            <CardContent>
              {(taskReport?.tasks?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Bu filtrelere uygun görev yok.</p>
              ) : (
                <DataTable columns={taskReportColumns} data={taskReport?.tasks ?? []} searchKey="title" />
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Rapor oluşturucu (CRM)</CardTitle>
            <CardDescription>Fatura ve aday müşteri — grupla, önizle</CardDescription>
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
                  <SelectItem value="leads">Aday müşteriler</SelectItem>
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
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="örn. durum=Ödendi" />
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
              <Button variant="outline" onClick={() => toast({ title: 'Dışa aktarma', description: 'Görev raporu için Excel/Word kullanın' })}>
                <DownloadCloud className="mr-2 h-4 w-4" />
                Dışa aktar
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle>Önizleme (CRM)</CardTitle>
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
            <CardTitle>Geciken görevler (panel özeti)</CardTitle>
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
                  <span>{formatDate(t.due || '')}</span>
                </div>
              ))}
              {overdue.length === 0 && <p>Geciken görev yok</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Throughput (panel)</CardTitle>
            <CardDescription>Son 6 ay tamamlanan görev</CardDescription>
          </CardHeader>
          <CardContent className="h-56 min-h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={throughputByMonthLocal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <ReTooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-4 pb-4 text-xs text-muted-foreground">Önbellekteki görev verisi</div>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Tamamlanma süresi (panel)</CardTitle>
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
            <CardDescription>Toplam saat (panel verisi)</CardDescription>
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
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Planlanan vs Gerçekleşen</CardTitle>
            <CardDescription>Saat bazlı karşılaştırma (panel)</CardDescription>
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
