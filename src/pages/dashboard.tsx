import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, CalendarClock, CheckCircle, Clock3, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/app-shell'
import { useAppStore } from '@/state/use-app-store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export function DashboardPage() {
  const { data } = useAppStore()
  const [pendingApprovals, setPendingApprovals] = useState<
    { id: string; quote_id: string; quote_number: string; role: string; status: string }[]
  >([])
  const [todayTasks, setTodayTasks] = useState(data.today.tasks)
  const [todayMeetings, setTodayMeetings] = useState(data.today.meetings)
  const [todayOverdueInvoices, setTodayOverdueInvoices] = useState(data.today.overdueInvoices)
  const [todayLowStock, setTodayLowStock] = useState(data.today.lowStockSkus)
  const [kpiDate, setKpiDate] = useState<string>(() => formatDate(new Date()))
  const [kpiTotals, setKpiTotals] = useState({
    revenue: 0,
    pipeline: 0,
    ar: 0,
    inventory: 0,
    tickets: 0,
  })
  const defaultWidgets = {
    kpi: true,
    inventory: true,
    tickets: true,
    cashflow: true,
    products: true,
    service: true,
    today: true,
  }
  const [widgets, setWidgets] = useState<Record<string, boolean>>(() => {
    const raw = localStorage.getItem('dashboard-widgets')
    return raw ? JSON.parse(raw) : defaultWidgets
  })
  const [health, setHealth] = useState<{ backend: string; db: string; redis: string } | null>(null)

  useEffect(() => {
    localStorage.setItem('dashboard-widgets', JSON.stringify(widgets))
  }, [widgets])

  useEffect(() => {
    api.get('/dashboard/kpis/').then((res) => {
      const d = res.data || {}
      setKpiTotals({
        revenue: d.revenue ?? 0,
        pipeline: d.pipeline ?? 0,
        ar: d.ar ?? 0,
        inventory: d.inventory_value ?? 0,
        tickets: d.tickets_open ?? 0,
      })
      setTodayTasks(d.today_tasks || todayTasks)
      setTodayOverdueInvoices(d.overdue_invoices || todayOverdueInvoices)
      setTodayLowStock(d.low_stock || todayLowStock)
      setTodayMeetings(d.meetings || todayMeetings)
      setKpiDate(formatDate(new Date()))
    })
    api.get('/approvals/pending/').then((res) => setPendingApprovals(res.data || [])).catch(() => setPendingApprovals([]))

    // health endpoint backend kökünde (/health/), baseURL /api ise 404 olmaması için tam URL hesapla
    const apiBase = (api.defaults.baseURL || '').replace(/\/$/, '')
    const rootBase = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase
    const healthUrl = `${rootBase}/health/`
    api
      .get(healthUrl, { baseURL: '' })
      .then((res) => setHealth(res.data || null))
      .catch(() => setHealth(null))
  }, [])

  useEffect(() => {
    // meetings still mock
    setTodayMeetings(data.today.meetings)
  }, [data.today])

  const totals = {
    revenue: data.invoices.reduce((sum, inv) => sum + inv.amount, 0),
    pipeline: data.opportunities.reduce((sum, opp) => sum + opp.value, 0),
    ar: data.invoices.filter((i) => i.status !== 'Paid').reduce((sum, inv) => sum + inv.amount, 0),
    inventory: data.products.reduce((sum, p) => sum + p.stock * p.price, 0),
    tickets: data.tickets.length,
    onTime: `${78 + (data.salesOrders.length % 7)}%`,
  }

  const revenueTrend = data.invoices.slice(0, 12).map((inv, idx) => ({
    month: `M${idx + 1}`,
    value: inv.amount,
  }))

  const pipelineByStage = data.opportunities.reduce<Record<string, number>>((acc, opp) => {
    acc[opp.stage] = (acc[opp.stage] ?? 0) + opp.value
    return acc
  }, {})

  const topProducts = data.products.slice(0, 8).map((p) => ({ name: p.name, value: p.stock + p.reserved }))

  const cashflow = data.invoices.slice(0, 8).map((inv, idx) => ({
    month: `W${idx + 1}`,
    inflow: inv.amount * 0.6,
    outflow: inv.amount * 0.35,
  }))

  return (
    <div>
      <PageHeader
        title="Kontrol Paneli"
        description="CRM + ERP genel görünüm"
        actions={<Badge variant="outline">Güncellendi {kpiDate}</Badge>}
      />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Widget kitaplığı</CardTitle>
          <CardDescription>Görünümü kişiselleştir</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.keys(defaultWidgets).map((key) => (
            <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{key}</span>
              <Switch checked={widgets[key]} onCheckedChange={(v) => setWidgets({ ...widgets, [key]: v })} />
            </div>
          ))}
          <Button size="sm" variant="outline" className="col-span-full justify-self-start" onClick={() => setWidgets(defaultWidgets)}>
            Kişisel görünümü kaydet / sıfırla
          </Button>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Sistem Sağlığı</CardTitle>
            <CardDescription>Backend, DB, Redis durumu</CardDescription>
          </div>
          <Badge variant={health ? 'secondary' : 'destructive'}>{health ? 'Online' : 'Bilinmiyor'}</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {['backend', 'db', 'redis'].map((k) => (
            <div key={k} className="rounded border p-3">
              <p className="text-xs uppercase text-muted-foreground">{k}</p>
              <p className="text-sm font-semibold">
                {health ? (health as any)[k] ?? 'bilinmiyor' : 'erişilemedi'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      {widgets.kpi && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricCard title="Gelir" value={formatCurrency(kpiTotals.revenue || totals.revenue)} delta="+12% geçen aya göre" />
            <MetricCard title="Satış Pipelinesı" value={formatCurrency(kpiTotals.pipeline || totals.pipeline)} delta="+6% hedefe göre" icon={TrendingUp} />
            <MetricCard title="Alacaklar" value={formatCurrency(kpiTotals.ar || totals.ar)} delta="Açık fatura" icon={Clock3} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <MetricCard title="Stok Değeri" value={formatCurrency(kpiTotals.inventory || totals.inventory)} delta="Rezerve dahil" icon={ArrowUpRight} />
            <MetricCard title="Destek Biletleri" value={(kpiTotals.tickets || totals.tickets).toString()} delta="Aktif kuyruk" icon={CalendarClock} />
            <MetricCard title="Zamanında Teslim" value={totals.onTime} delta="Lojistik KPI" icon={CheckCircle} />
          </div>
        </>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {widgets.kpi && (
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Gelir trendi</CardTitle>
              <CardDescription>Son 12 dönem</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-72 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" />
                <YAxis />
                <ReTooltip />
                <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}

        {widgets.kpi && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Aşama bazlı pipeline</CardTitle>
              <CardDescription>Segment toplamları</CardDescription>
            </CardHeader>
            <CardContent className="h-72 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(pipelineByStage).map(([stage, value]) => ({ stage, value }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <ReTooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {widgets.today && (
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle>Bugün</CardTitle>
            <CardDescription>Görevler, toplantılar, faturalar, düşük stok</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Görevler</h4>
              {todayTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border/80 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{task.title}</span>
                    <Badge variant="outline">{task.owner}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Tarih {formatDate(task.due || task.end || '')}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Toplantılar & Uyarılar</h4>
              {todayMeetings.map((meet) => (
                <div key={meet.id} className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-sm">
                  <div>
                    <p className="font-semibold">{meet.subject}</p>
                    <p className="text-xs text-muted-foreground">{meet.owner}</p>
                  </div>
                  <Badge variant="secondary">{meet.time}</Badge>
                </div>
              ))}
              <Separator />
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Geciken faturalar</p>
                <div className="flex flex-wrap gap-2">
                  {todayOverdueInvoices.map((code) => (
                    <Badge key={code} variant="destructive">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Düşük stok</p>
                <div className="flex flex-wrap gap-2">
                  {todayLowStock.map((sku) => (
                    <Badge key={sku} variant="warning">
                      {sku}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
        {widgets.cashflow && (
        <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Nakit akışı</CardTitle>
              <CardDescription>Planlanan giriş / çıkış</CardDescription>
            </CardHeader>
          <CardContent className="h-72 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ReTooltip />
                  <Line type="monotone" dataKey="inflow" stroke="#16a34a" />
                  <Line type="monotone" dataKey="outflow" stroke="#ef4444" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {widgets.products && (
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle>En çok dönen ürünler</CardTitle>
            <CardDescription>Depolara göre hız</CardDescription>
          </CardHeader>
          <CardContent className="h-72 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}
        {widgets.service && (
          <Card>
            <CardHeader>
              <CardTitle>Servis Sağlığı</CardTitle>
              <CardDescription>Ticket ve SLA trendleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                <div>
                  <p className="text-sm font-semibold">Açık ticket</p>
                  <p className="text-xs text-muted-foreground">Yanıt bekliyor</p>
                </div>
                <Badge variant="secondary">{data.tickets.filter((t) => t.status !== 'Closed').length}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                <div>
                  <p className="text-sm font-semibold">Ort. cevap</p>
                  <p className="text-xs text-muted-foreground">SLA performansı</p>
                </div>
                <Badge variant="success">27m</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                <div>
                  <p className="text-sm font-semibold">CSAT</p>
                  <p className="text-xs text-muted-foreground">Son 30 gün</p>
                </div>
                <Badge variant="outline">4.6 / 5</Badge>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Bekleyen Onaylar</CardTitle>
            <CardDescription>Onay kuyruğu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
              <div>
                <p className="text-sm font-semibold">Toplam bekleyen</p>
                <p className="text-xs text-muted-foreground">Rol bazlı kuyruk</p>
              </div>
              <Badge variant="secondary">{pendingApprovals.length}</Badge>
            </div>
            {pendingApprovals.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-sm">
                <div>
                  <p className="font-semibold">{p.quote_number || p.quote_id}</p>
                  <p className="text-xs text-muted-foreground">{p.role}</p>
                </div>
                <Badge variant="outline">{p.status}</Badge>
              </div>
            ))}
            {pendingApprovals.length === 0 && <p className="text-xs text-muted-foreground">Bekleyen onay yok</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, delta, icon: Icon }: { title: string; value: string; delta: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : <BarSpark />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-success mt-1">{delta}</p>
      </CardContent>
    </Card>
  )
}

function BarSpark() {
  return (
    <div className="flex items-end gap-0.5">
      {[8, 12, 10, 16, 14].map((h, idx) => (
        <span key={idx} className="inline-block w-1.5 rounded-full bg-primary/50" style={{ height: `${h}px` }} />
      ))}
    </div>
  )
}

