import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCircle2, Copy, Download, LogOut, Monitor, Pause, Play, Plus, RefreshCw, Route, Save, Send, TimerReset, Trash2, Upload, UserPlus, Volume2 } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'
import { formatNumber } from '@/lib/utils'

type Department = { id: number; code: string; name: string; color?: string; order: number; is_active: boolean }
type Station = { id: number; department: number; department_name?: string; code: string; name: string; order: number; max_workers: number; is_handover: boolean; is_final: boolean; is_active: boolean }
type UserLite = { id: number; username?: string; email?: string; first_name?: string; last_name?: string; full_name?: string; role?: string }
type StationAssignment = { id: number; station: number; station_code?: string; user: number; user_name?: string; role: string; is_active: boolean }
type Device = { id: number; station: number; station_code?: string; name: string; token?: string; is_active: boolean; last_seen_at?: string }
type Tablet = { id: number; station: number; station_code?: string; station_name?: string; name: string; token?: string; is_active: boolean; last_seen_at?: string }
type StationTarget = { id: number; station: number; station_code?: string; station_name?: string; target_date: string; target_quantity: string | number; note?: string }
type OperatorProfile = { id: number; user: number; user_name?: string; has_pin?: boolean; is_active: boolean; last_pin_change_at?: string }
type StationAlert = { id: number; target_type: string; station?: number | null; station_code?: string; department?: number | null; department_name?: string; work_order?: number | null; work_order_number?: string; title: string; message: string; severity: string; created_at?: string; acks?: any[] }
type DeviceMap = { id: number; device: number; device_name?: string; station?: number; station_code?: string; source_path: string; target_key: string; target_type: string; is_required: boolean; is_active: boolean; order: number }
type DataField = { id: number; station?: number | null; station_code?: string; key: string; label: string; field_type: string; source: string; is_visible: boolean; order: number }
type RuleSet = { id: number; name: string; scope: string; station?: number | null; route?: number | null; trigger_event: string; is_active: boolean; order: number; blocks?: RuleBlock[] }
type RuleBlock = { id: number; rule_set: number; block_type: string; config: Record<string, any>; is_active: boolean; order: number }
type TemplatePreset = { id: number; key: string; name: string; description?: string; is_active: boolean }
type RouteStep = { id: number; station: number; station_code?: string; station_name?: string; department_name?: string; order: number; is_required: boolean; start_policy?: string }
type RouteTemplate = { id: number; name: string; product_group_key?: string; is_default: boolean; steps?: RouteStep[] }
type WarehouseLocation = { id: number; code: string; name?: string; warehouse: number; warehouse_name?: string }
type ProductionSettings = { default_completion_location?: number | null; default_completion_warehouse?: number | null; auto_stock_in_enabled?: boolean }
type WorkOrder = {
  id: number
  number: string
  source_number?: string
  customer_name?: string
  status: string
  due_date?: string
  route_name?: string
  lines?: WorkOrderLine[]
}
type WorkOrderLine = {
  id: number
  product_sku: string
  product_name: string
  detail_1?: string
  detail_2?: string
  quantity: string | number
  completed_quantity: string | number
  stock_in_done?: boolean
  steps?: StepProgress[]
}
type StepProgress = {
  id: number
  station?: number
  station_code: string
  station_name: string
  department_name: string
  department_color?: string
  target_quantity: string | number
  completed_quantity: string | number
  machine_quantity?: string | number
  status: string
  start_policy?: string
  assigned_tablets?: { id: number; tablet: number; tablet_name: string; priority: number; is_pinned: boolean; note?: string }[]
}
type WorkSession = {
  id: number
  status: string
  user_name?: string
  started_at?: string
  ended_at?: string
  machine_quantity: string | number
  declared_good_quantity: string | number
  discrepancy_quantity: string | number
  discrepancy_status: string
}
type PreviousSummary = {
  station_code?: string
  station_name?: string
  completed_quantity?: string | number
  machine_quantity?: string | number
  last_user?: string
  last_closed_at?: string
  has_discrepancy?: boolean
}
type ConsoleItem = {
  line_id: number
  work_order_number: string
  customer_name?: string
  product_sku: string
  product_name: string
  detail_1?: string
  detail_2?: string
  station_code: string
  station_name: string
  department_name: string
  target_quantity: string | number
  completed_quantity: string | number
  machine_quantity: string | number
  remaining_quantity?: string | number
  status: string
  active_session?: WorkSession | null
  current_user_session?: WorkSession | null
  can_start?: boolean
  can_take_over?: boolean
  previous_summary?: PreviousSummary | null
}
type TabletOperator = { id: number; name: string; role: string; has_pin: boolean; today_total: string | number }
type TabletSlot = {
  id: number
  user_id: number
  user_name: string
  line_id: number
  work_order_number: string
  product_sku: string
  product_name: string
  status: string
  slot_index: number
  started_at?: string
  machine_quantity: string | number
  declared_good_quantity: string | number
  break_seconds?: number
  active_break_id?: number | null
}
type TabletDailyTarget = { id?: number; date?: string; target_quantity: string | number; actual_quantity: string | number; remaining_quantity: string | number; note?: string }
type TabletCountingWindow = {
  id: number
  line_id: number
  step_id: number
  status: string
  start_total: string | number
  machine_delta: string | number
  participants?: { id: number; session_id: number; user_id: number; user_name: string; start_total: string | number; declared_total: string | number; credited_quantity: string | number; discrepancy_status: string }[]
}
type TabletWorkItem = ConsoleItem & { work_order_id: number; visibility?: string; is_pinned?: boolean; priority?: number; start_policy?: string; assigned_tablet_ids?: number[] }
type TabletContext = {
  tablet?: { id: number; name: string; token: string }
  station?: { id: number; code: string; name: string; department_name: string; max_workers: number }
  daily_target?: TabletDailyTarget
  operators?: TabletOperator[]
  work_items?: TabletWorkItem[]
  slots?: TabletSlot[]
  active_window?: TabletCountingWindow | null
  alerts?: { id: number; title: string; message: string; severity: string; requires_ack: boolean; created_at?: string }[]
}

const statusLabel: Record<string, string> = {
  draft: 'Taslak',
  waiting: 'Bekliyor',
  in_progress: 'Üretimde',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  locked: 'Kilitli',
  ready: 'Hazır',
  waiting_handover: 'Devir bekliyor',
  skipped: 'Atlandı',
}

const n = (value: unknown) => Number(value || 0)
const todayIso = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function pct(done: unknown, target: unknown) {
  const total = n(target)
  if (!total) return 0
  return Math.min(100, Math.round((n(done) / total) * 100))
}

function ProgressBar({ done, target }: { done: unknown; target: unknown }) {
  const value = pct(done, target)
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  )
}

async function fetchAll<T = any>(url: string): Promise<T[]> {
  const res = await api.get(url)
  return Array.isArray(res.data) ? res.data : res.data?.results || []
}

function downloadJson(data: BlobPart, filename: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function userLabel(user?: UserLite) {
  if (!user) return ''
  return user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || `#${user.id}`
}

function assignmentRoleLabel(role: string) {
  if (role === 'lead') return 'Usta başı'
  if (role === 'observer') return 'Gözlemci'
  return 'Operatör'
}

function StationCard({ station, assignments = [], onDelete }: { station: Station; assignments?: StationAssignment[]; onDelete?: () => void }) {
  return (
    <div className="rounded-lg border bg-card/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{station.code}</p>
          <p className="text-xs text-muted-foreground">{station.department_name || station.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={station.is_active ? 'secondary' : 'outline'}>{station.is_active ? 'Aktif' : 'Pasif'}</Badge>
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} title="İstasyonu sil">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {assignments.length ? assignments.map((assignment) => (
          <Badge key={assignment.id} variant="outline" className="max-w-full truncate">
            {assignment.user_name || `Kullanıcı #${assignment.user}`} · {assignmentRoleLabel(assignment.role)}
          </Badge>
        )) : <span>Atanmış operatör yok</span>}
        {station.is_handover && <span>Devir istasyonu</span>}
        {station.is_final && <span>Ürün tamamlandı</span>}
      </div>
    </div>
  )
}

export function ProductionManagementPage() {
  const { toast } = useToast()
  const configImportRef = useRef<HTMLInputElement | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [stationAssignments, setStationAssignments] = useState<StationAssignment[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [tablets, setTablets] = useState<Tablet[]>([])
  const [stationTargets, setStationTargets] = useState<StationTarget[]>([])
  const [operatorProfiles, setOperatorProfiles] = useState<OperatorProfile[]>([])
  const [alerts, setAlerts] = useState<StationAlert[]>([])
  const [deviceMaps, setDeviceMaps] = useState<DeviceMap[]>([])
  const [dataFields, setDataFields] = useState<DataField[]>([])
  const [routes, setRoutes] = useState<RouteTemplate[]>([])
  const [rules, setRules] = useState<RuleSet[]>([])
  const [presets, setPresets] = useState<TemplatePreset[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [settings, setSettings] = useState<ProductionSettings>({})
  const [summary, setSummary] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [departmentDraft, setDepartmentDraft] = useState({ code: '', name: '', color: '#2563eb' })
  const [stationDraft, setStationDraft] = useState({ department: '', code: '', name: '', max_workers: '2', is_handover: false, is_final: false })
  const [assignmentDraft, setAssignmentDraft] = useState({ station: '', user: '', role: 'operator' })
  const [routeDraft, setRouteDraft] = useState({ name: '', product_group_key: '', station_ids: [] as string[], parallel_station_ids: [] as string[] })
  const [deviceDraft, setDeviceDraft] = useState({ station: '', name: '' })
  const [tabletDraft, setTabletDraft] = useState({ station: '', name: '' })
  const [targetDraft, setTargetDraft] = useState({ station: '', target_date: todayIso(), target_quantity: '', note: '' })
  const [pinDraft, setPinDraft] = useState({ user: '', pin: '' })
  const [alertDraft, setAlertDraft] = useState({ target_type: 'station', station: '', department: '', work_order: '', title: '', message: '', severity: 'warning' })
  const [mapDraft, setMapDraft] = useState({ device: '', source_path: '$.', target_key: '', target_type: 'text', is_required: false })
  const [fieldDraft, setFieldDraft] = useState({ station: 'global', key: '', label: '', field_type: 'text', source: 'manual' })
  const [ruleDraft, setRuleDraft] = useState({ name: '', scope: 'station', station: 'none', route: 'none', trigger_event: 'pi_event' })

  const load = async () => {
    const [d, s, assignmentRows, userRows, dev, tabletRows, profileRows, alertRows, maps, fields, r, ruleRows, presetRows, l, cfg, dash] = await Promise.all([
      fetchAll<Department>('/production/departments/'),
      fetchAll<Station>('/production/stations/'),
      fetchAll<StationAssignment>('/production/station-users/'),
      api.get('/auth/users/').then((res) => (Array.isArray(res.data) ? res.data : res.data?.results || [])).catch(() => []),
      fetchAll<Device>('/production/devices/'),
      fetchAll<Tablet>('/production/tablets/').catch(() => []),
      fetchAll<OperatorProfile>('/production/operator-profiles/').catch(() => []),
      fetchAll<StationAlert>('/production/station-alerts/').catch(() => []),
      fetchAll<DeviceMap>('/production/device-maps/'),
      fetchAll<DataField>('/production/data-fields/'),
      fetchAll<RouteTemplate>('/production/routes/'),
      fetchAll<RuleSet>('/production/rules/'),
      fetchAll<TemplatePreset>('/production/template-presets/'),
      fetchAll<WarehouseLocation>('/inventory-locations/'),
      api.get('/production/settings/').then((res) => res.data),
      api.get('/production/reports/summary/').then((res) => res.data).catch(() => ({})),
    ])
    setDepartments(d)
    setStations(s)
    setStationAssignments(assignmentRows)
    setUsers(userRows)
    setDevices(dev)
    setTablets(tabletRows)
    setOperatorProfiles(profileRows)
    setAlerts(alertRows)
    setDeviceMaps(maps)
    setDataFields(fields)
    setRoutes(r)
    setRules(ruleRows)
    setPresets(presetRows)
    setLocations(l)
    setSettings(cfg || {})
    setSummary(dash || {})
  }

  const fetchTargets = async (date: string) => {
    try {
      const targets = await fetchAll<StationTarget>(`/production/station-targets/?target_date=${date}`)
      setStationTargets(targets)
    } catch {}
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (targetDraft.target_date) {
      void fetchTargets(targetDraft.target_date)
    }
  }, [targetDraft.target_date])

  const saveSettings = async () => {
    await api.patch('/production/settings/', settings)
    toast({ title: 'İmalat ayarları kaydedildi' })
    await load()
  }

  const createDepartment = async () => {
    await api.post('/production/departments/', { ...departmentDraft, order: departments.length })
    setDepartmentDraft({ code: '', name: '', color: '#2563eb' })
    toast({ title: 'Bölüm oluşturuldu' })
    await load()
  }

  const createStation = async () => {
    await api.post('/production/stations/', {
      ...stationDraft,
      department: Number(stationDraft.department),
      max_workers: Number(stationDraft.max_workers || 1),
      order: stations.filter((item) => String(item.department) === stationDraft.department).length,
    })
    setStationDraft({ department: '', code: '', name: '', max_workers: '2', is_handover: false, is_final: false })
    toast({ title: 'İstasyon oluşturuldu' })
    await load()
  }

  const assignStationUser = async () => {
    await api.post('/production/station-users/', {
      station: Number(assignmentDraft.station),
      user: Number(assignmentDraft.user),
      role: assignmentDraft.role,
      is_active: true,
    })
    setAssignmentDraft({ station: '', user: '', role: 'operator' })
    toast({ title: 'İstasyon kullanıcısı atandı' })
    await load()
  }

  const createRoute = async () => {
    await api.post('/production/routes/', {
      name: routeDraft.name,
      product_group_key: routeDraft.product_group_key,
      step_inputs: routeDraft.station_ids.map((stationId, order) => ({
        station: Number(stationId),
        order,
        is_required: true,
        start_policy: routeDraft.parallel_station_ids.includes(stationId) ? 'parallel' : 'after_previous',
      })),
    })
    setRouteDraft({ name: '', product_group_key: '', station_ids: [], parallel_station_ids: [] })
    toast({ title: 'Rota oluşturuldu' })
    await load()
  }

  const createDevice = async () => {
    await api.post('/production/devices/', { station: Number(deviceDraft.station), name: deviceDraft.name })
    setDeviceDraft({ station: '', name: '' })
    toast({ title: 'Cihaz oluşturuldu' })
    await load()
  }

  const createTablet = async () => {
    await api.post('/production/tablets/', { station: Number(tabletDraft.station), name: tabletDraft.name })
    setTabletDraft({ station: '', name: '' })
    toast({ title: 'İstasyon tableti oluşturuldu' })
    await load()
  }

  const saveStationTarget = async () => {
    const existing = stationTargets.find((item) => String(item.station) === targetDraft.station && item.target_date === targetDraft.target_date)
    const payload = {
      station: Number(targetDraft.station),
      target_date: targetDraft.target_date,
      target_quantity: targetDraft.target_quantity || 0,
      note: targetDraft.note,
    }
    if (existing) await api.patch(`/production/station-targets/${existing.id}/`, payload)
    else await api.post('/production/station-targets/', payload)
    toast({ title: 'Günlük istasyon hedefi kaydedildi' })
    await fetchTargets(targetDraft.target_date)
    setTargetDraft({ station: '', target_date: targetDraft.target_date, target_quantity: '', note: '' })
    await load()
  }

  const saveOperatorPin = async () => {
    const existing = operatorProfiles.find((item) => String(item.user) === pinDraft.user)
    const payload = { user: Number(pinDraft.user), pin: pinDraft.pin, is_active: true }
    if (existing) await api.patch(`/production/operator-profiles/${existing.id}/`, payload)
    else await api.post('/production/operator-profiles/', payload)
    setPinDraft({ user: '', pin: '' })
    toast({ title: 'Üretim PIN’i kaydedildi' })
    await load()
  }

  const sendAlert = async () => {
    await api.post('/production/station-alerts/', {
      target_type: alertDraft.target_type,
      station: alertDraft.target_type === 'station' ? Number(alertDraft.station) : null,
      department: alertDraft.target_type === 'department' ? Number(alertDraft.department) : null,
      work_order: alertDraft.target_type === 'work_order' ? Number(alertDraft.work_order) : null,
      title: alertDraft.title,
      message: alertDraft.message,
      severity: alertDraft.severity,
    })
    setAlertDraft({ target_type: 'station', station: '', department: '', work_order: '', title: '', message: '', severity: 'warning' })
    toast({ title: 'İstasyon bildirimi gönderildi' })
    await load()
  }

  const createMap = async () => {
    const device = devices.find((item) => String(item.id) === mapDraft.device)
    await api.post('/production/device-maps/', {
      ...mapDraft,
      device: Number(mapDraft.device),
      station: device?.station || null,
      order: deviceMaps.length,
    })
    setMapDraft({ device: '', source_path: '$.', target_key: '', target_type: 'text', is_required: false })
    toast({ title: 'Veri eşlemesi oluşturuldu' })
    await load()
  }

  const createField = async () => {
    await api.post('/production/data-fields/', {
      ...fieldDraft,
      station: fieldDraft.station === 'global' ? null : Number(fieldDraft.station),
      order: dataFields.length,
    })
    setFieldDraft({ station: 'global', key: '', label: '', field_type: 'text', source: 'manual' })
    toast({ title: 'Veri alanı oluşturuldu' })
    await load()
  }

  const createRule = async () => {
    await api.post('/production/rules/', {
      name: ruleDraft.name,
      scope: ruleDraft.scope,
      station: ruleDraft.station === 'none' ? null : Number(ruleDraft.station),
      route: ruleDraft.route === 'none' ? null : Number(ruleDraft.route),
      trigger_event: ruleDraft.trigger_event,
      order: rules.length,
    })
    setRuleDraft({ name: '', scope: 'station', station: 'none', route: 'none', trigger_event: 'pi_event' })
    toast({ title: 'Kural seti oluşturuldu' })
    await load()
  }

  const deleteItem = async (url: string, label: string) => {
    if (!window.confirm(`${label} silinsin mi? Bu işlem geri alınamaz.`)) return
    try {
      await api.delete(url)
      toast({ title: `${label} silindi` })
      await load()
    } catch (error: any) {
      toast({
        title: `${label} silinemedi`,
        description: error?.response?.data?.detail || 'Bağlı kayıtları kontrol edin.',
        variant: 'destructive',
      })
    }
  }

  const clonePreset = async (preset: TemplatePreset) => {
    setBusy(true)
    try {
      await api.post(`/production/template-presets/${preset.id}/clone/`)
      toast({ title: `${preset.name} şablonu kopyalandı` })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const exportConfig = async () => {
    const response = await api.get('/production/departments/export-config/', { responseType: 'blob' })
    downloadJson(response.data, 'production_config.json')
    toast({ title: 'İmalat yönetimi dışa aktarıldı' })
  }

  const importConfig = async (file?: File) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    await api.post('/production/departments/import-config/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    toast({ title: 'İmalat yönetimi içe aktarıldı' })
    await load()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="İmalat Yönetimi"
        description="Bölüm, istasyon, rota, cihaz verisi, akış kuralları ve şablonları fabrika yapısına göre düzenleyin."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={configImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void importConfig(file)
              }}
            />
            <Button variant="outline" onClick={exportConfig}><Download className="mr-2 h-4 w-4" /> Dışa aktar</Button>
            <Button variant="outline" onClick={() => configImportRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> İçe aktar</Button>
            <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardTitle>Aktif bölüm</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.departments ?? departments.length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Aktif istasyon</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.stations ?? stations.length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Açık iş emri</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.active_orders ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle>Bugün tamamlanan</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatNumber(summary.completed_today || 0)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Depo giriş ayarı</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label>Tamamlanan mamulün gireceği depo / raf</Label>
            <Select
              value={settings.default_completion_location ? String(settings.default_completion_location) : 'none'}
              onValueChange={(value) => {
                const location = locations.find((item) => String(item.id) === value)
                setSettings((current) => ({
                  ...current,
                  default_completion_location: value === 'none' ? null : Number(value),
                  default_completion_warehouse: location?.warehouse || current.default_completion_warehouse || null,
                }))
              }}
            >
              <SelectTrigger><SelectValue placeholder="Depo / raf seç" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Depo girişi yapma</SelectItem>
                {locations.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.warehouse_name || 'Depo'} / {item.code} {item.name ? `- ${item.name}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveSettings}>Kaydet</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Günlük istasyon hedefleri</CardTitle></CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Select value={targetDraft.station} onValueChange={(value) => setTargetDraft((current) => {
              const existing = stationTargets.find((item) => String(item.station) === value && item.target_date === current.target_date)
              return { ...current, station: value, target_quantity: existing ? String(existing.target_quantity) : '', note: existing?.note || '' }
            })}>
              <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
              <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={targetDraft.target_date} onChange={(e) => setTargetDraft((current) => ({ ...current, target_date: e.target.value }))} />
            <Input placeholder="Günlük hedef adet" inputMode="decimal" value={targetDraft.target_quantity} onChange={(e) => setTargetDraft((current) => ({ ...current, target_quantity: e.target.value }))} />
            <Input placeholder="Not" value={targetDraft.note} onChange={(e) => setTargetDraft((current) => ({ ...current, note: e.target.value }))} />
            <Button onClick={saveStationTarget} disabled={!targetDraft.station || !targetDraft.target_date}>
              <Save className="mr-2 h-4 w-4" /> Hedefi kaydet
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {stations.map((station) => {
              const target = stationTargets.find((item) => item.station === station.id)
              return (
                <button
                  key={station.id}
                  className="rounded-lg border bg-muted/10 p-3 text-left hover:bg-muted/30"
                  onClick={() => setTargetDraft({
                    station: String(station.id),
                    target_date: target?.target_date || targetDraft.target_date,
                    target_quantity: target ? String(target.target_quantity) : '',
                    note: target?.note || '',
                  })}
                >
                  <p className="font-semibold">{station.code}</p>
                  <p className="text-xs text-muted-foreground">{station.name}</p>
                  <p className="mt-2 text-2xl font-bold">{formatNumber(n(target?.target_quantity))}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="departments" className="space-y-3">
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="departments">Bölümler</TabsTrigger>
          <TabsTrigger value="stations">İstasyonlar</TabsTrigger>
          <TabsTrigger value="tablets">Tablet & PIN</TabsTrigger>
          <TabsTrigger value="alerts">Bildirimler</TabsTrigger>
          <TabsTrigger value="devices">Cihaz & Veri</TabsTrigger>
          <TabsTrigger value="flow">Akış Tasarımcısı</TabsTrigger>
          <TabsTrigger value="presets">Şablonlar</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <Card>
              <CardHeader><CardTitle>Bölüm oluştur</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Kod" value={departmentDraft.code} onChange={(e) => setDepartmentDraft((v) => ({ ...v, code: e.target.value }))} />
                <Input placeholder="Bölüm adı" value={departmentDraft.name} onChange={(e) => setDepartmentDraft((v) => ({ ...v, name: e.target.value }))} />
                <Input type="color" value={departmentDraft.color} onChange={(e) => setDepartmentDraft((v) => ({ ...v, color: e.target.value }))} />
                <Button onClick={createDepartment} disabled={!departmentDraft.code || !departmentDraft.name}><Plus className="mr-2 h-4 w-4" /> Ekle</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Bölüm ve istasyon diyagramı</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {departments.map((dep) => (
                  <div key={dep.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: dep.color || '#21406d' }} />
                        <h3 className="font-semibold">{dep.name}</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteItem(`/production/departments/${dep.id}/`, dep.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Sil
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {stations.filter((station) => station.department === dep.id).map((station) => (
                        <StationCard
                          key={station.id}
                          station={station}
                          assignments={stationAssignments.filter((item) => item.station === station.id && item.is_active)}
                          onDelete={() => deleteItem(`/production/stations/${station.id}/`, station.code)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stations">
          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>İstasyon oluştur</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={stationDraft.department} onValueChange={(value) => setStationDraft((v) => ({ ...v, department: value }))}>
                    <SelectTrigger><SelectValue placeholder="Bölüm seç" /></SelectTrigger>
                    <SelectContent>{departments.map((dep) => <SelectItem key={dep.id} value={String(dep.id)}>{dep.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Kod" value={stationDraft.code} onChange={(e) => setStationDraft((v) => ({ ...v, code: e.target.value }))} />
                  <Input placeholder="İstasyon adı" value={stationDraft.name} onChange={(e) => setStationDraft((v) => ({ ...v, name: e.target.value }))} />
                  <Input placeholder="Eşzamanlı çalışan sınırı" inputMode="numeric" value={stationDraft.max_workers} onChange={(e) => setStationDraft((v) => ({ ...v, max_workers: e.target.value }))} />
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Devir istasyonu</span><Switch checked={stationDraft.is_handover} onCheckedChange={(checked) => setStationDraft((v) => ({ ...v, is_handover: checked }))} /></label>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Final istasyon</span><Switch checked={stationDraft.is_final} onCheckedChange={(checked) => setStationDraft((v) => ({ ...v, is_final: checked }))} /></label>
                  <Button onClick={createStation} disabled={!stationDraft.department || !stationDraft.code || !stationDraft.name}><Plus className="mr-2 h-4 w-4" /> Ekle</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>İstasyona kişi ata</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={assignmentDraft.station} onValueChange={(value) => setAssignmentDraft((current) => ({ ...current, station: value }))}>
                    <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
                    <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={assignmentDraft.user} onValueChange={(value) => setAssignmentDraft((current) => ({ ...current, user: value }))}>
                    <SelectTrigger><SelectValue placeholder="Kullanıcı seç" /></SelectTrigger>
                    <SelectContent>
                      {users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{userLabel(user)}{user.role ? ` · ${user.role}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={assignmentDraft.role} onValueChange={(value) => setAssignmentDraft((current) => ({ ...current, role: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operatör</SelectItem>
                      <SelectItem value="lead">Usta başı</SelectItem>
                      <SelectItem value="observer">Gözlemci</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={assignStationUser} disabled={!assignmentDraft.station || !assignmentDraft.user}>
                    <UserPlus className="mr-2 h-4 w-4" /> Ata
                  </Button>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>İstasyonlar</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {stations.map((station) => (
                  <StationCard
                    key={station.id}
                    station={station}
                    assignments={stationAssignments.filter((item) => item.station === station.id && item.is_active)}
                    onDelete={() => deleteItem(`/production/stations/${station.id}/`, station.code)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tablets">
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>İstasyon tableti oluştur</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={tabletDraft.station} onValueChange={(value) => setTabletDraft((v) => ({ ...v, station: value }))}>
                    <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
                    <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Tablet adı" value={tabletDraft.name} onChange={(e) => setTabletDraft((v) => ({ ...v, name: e.target.value }))} />
                  <Button onClick={createTablet} disabled={!tabletDraft.station || !tabletDraft.name}>
                    <Monitor className="mr-2 h-4 w-4" /> Tablet ekle
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Üretim PIN’i</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={pinDraft.user} onValueChange={(value) => setPinDraft((current) => ({ ...current, user: value }))}>
                    <SelectTrigger><SelectValue placeholder="Kullanıcı seç" /></SelectTrigger>
                    <SelectContent>{users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{userLabel(user)}{user.role ? ` · ${user.role}` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="password" placeholder="Tablet PIN" value={pinDraft.pin} onChange={(e) => setPinDraft((current) => ({ ...current, pin: e.target.value }))} />
                  <Button onClick={saveOperatorPin} disabled={!pinDraft.user || !pinDraft.pin}>PIN kaydet</Button>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Tabletler ve operatör PIN durumu</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {tablets.map((tablet) => (
                    <div key={tablet.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{tablet.name}</p>
                          <p className="text-xs text-muted-foreground">{tablet.station_code} · {tablet.station_name}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/tablets/${tablet.id}/`, tablet.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs">
                        <code className="min-w-0 flex-1 truncate">{tablet.token}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            navigator.clipboard?.writeText(`${window.location.origin}/erp/production/tablet?token=${tablet.token}`)
                            toast({ title: 'Tablet linki kopyalandı' })
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {users.filter((user) => stationAssignments.some((assignment) => assignment.user === user.id && assignment.is_active)).map((user) => {
                    const profile = operatorProfiles.find((item) => item.user === user.id)
                    return (
                      <div key={user.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <span>{userLabel(user)}</span>
                        <Badge variant={profile?.has_pin ? 'secondary' : 'outline'}>{profile?.has_pin ? 'PIN var' : 'PIN yok'}</Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader><CardTitle>Yönetici bildirimi gönder</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={alertDraft.target_type} onValueChange={(value) => setAlertDraft((current) => ({ ...current, target_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="station">İstasyon</SelectItem>
                    <SelectItem value="department">Bölüm</SelectItem>
                    <SelectItem value="work_order">İş emri</SelectItem>
                  </SelectContent>
                </Select>
                {alertDraft.target_type === 'station' && (
                  <Select value={alertDraft.station} onValueChange={(value) => setAlertDraft((current) => ({ ...current, station: value }))}>
                    <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
                    <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {alertDraft.target_type === 'department' && (
                  <Select value={alertDraft.department} onValueChange={(value) => setAlertDraft((current) => ({ ...current, department: value }))}>
                    <SelectTrigger><SelectValue placeholder="Bölüm seç" /></SelectTrigger>
                    <SelectContent>{departments.map((dep) => <SelectItem key={dep.id} value={String(dep.id)}>{dep.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {alertDraft.target_type === 'work_order' && (
                  <Input placeholder="İş emri ID" value={alertDraft.work_order} onChange={(e) => setAlertDraft((current) => ({ ...current, work_order: e.target.value }))} />
                )}
                <Input placeholder="Başlık" value={alertDraft.title} onChange={(e) => setAlertDraft((current) => ({ ...current, title: e.target.value }))} />
                <Textarea placeholder="Mesaj" value={alertDraft.message} onChange={(e) => setAlertDraft((current) => ({ ...current, message: e.target.value }))} />
                <Select value={alertDraft.severity} onValueChange={(value) => setAlertDraft((current) => ({ ...current, severity: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Bilgi</SelectItem>
                    <SelectItem value="warning">Uyarı</SelectItem>
                    <SelectItem value="critical">Kritik</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={sendAlert} disabled={!alertDraft.title || !alertDraft.message}>
                  <Bell className="mr-2 h-4 w-4" /> Gönder
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Son bildirimler</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>{alert.severity}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Hedef: {alert.station_code || alert.department_name || alert.work_order_number || alert.target_type} · Okundu: {alert.acks?.length || 0}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Cihaz oluştur</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={deviceDraft.station} onValueChange={(value) => setDeviceDraft((v) => ({ ...v, station: value }))}>
                  <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
                  <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Cihaz adı" value={deviceDraft.name} onChange={(e) => setDeviceDraft((v) => ({ ...v, name: e.target.value }))} />
                <Button onClick={createDevice} disabled={!deviceDraft.station || !deviceDraft.name}><Plus className="mr-2 h-4 w-4" /> Cihaz ekle</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Veri alanı</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Anahtar" value={fieldDraft.key} onChange={(e) => setFieldDraft((v) => ({ ...v, key: e.target.value }))} />
                <Input placeholder="Etiket" value={fieldDraft.label} onChange={(e) => setFieldDraft((v) => ({ ...v, label: e.target.value }))} />
                <Select value={fieldDraft.station} onValueChange={(value) => setFieldDraft((v) => ({ ...v, station: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="global">Genel</SelectItem>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={createField} disabled={!fieldDraft.key || !fieldDraft.label}><Save className="mr-2 h-4 w-4" /> Alan ekle</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>JSON path eşleme</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={mapDraft.device} onValueChange={(value) => setMapDraft((v) => ({ ...v, device: value }))}>
                  <SelectTrigger><SelectValue placeholder="Cihaz seç" /></SelectTrigger>
                  <SelectContent>{devices.map((dev) => <SelectItem key={dev.id} value={String(dev.id)}>{dev.name} · {dev.station_code}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="$.counter.total" value={mapDraft.source_path} onChange={(e) => setMapDraft((v) => ({ ...v, source_path: e.target.value }))} />
                <Input placeholder="target_key" value={mapDraft.target_key} onChange={(e) => setMapDraft((v) => ({ ...v, target_key: e.target.value }))} />
                <Select value={mapDraft.target_type} onValueChange={(value) => setMapDraft((v) => ({ ...v, target_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['text', 'number', 'boolean', 'datetime', 'json'].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
                <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Zorunlu path</span><Switch checked={mapDraft.is_required} onCheckedChange={(checked) => setMapDraft((v) => ({ ...v, is_required: checked }))} /></label>
                <Button onClick={createMap} disabled={!mapDraft.device || !mapDraft.source_path || !mapDraft.target_key}><Plus className="mr-2 h-4 w-4" /> Eşle</Button>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {devices.map((device) => (
              <Card key={`device-${device.id}`}>
                <CardContent className="flex items-center justify-between gap-3 pt-6 text-sm">
                  <span>{device.name} · {device.station_code}</span>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/devices/${device.id}/`, device.name)} title="Cihazı sil">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {dataFields.map((field) => (
              <Card key={`field-${field.id}`}>
                <CardContent className="flex items-center justify-between gap-3 pt-6 text-sm">
                  <span>{field.label} · {field.station_code || 'Genel'}</span>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/data-fields/${field.id}/`, field.label)} title="Veri alanını sil">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {deviceMaps.map((map) => (
              <Card key={`map-${map.id}`}>
                <CardContent className="flex items-center justify-between gap-3 pt-6 text-sm">
                  <span>{map.device_name} · {map.source_path}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{map.target_key}</Badge>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/device-maps/${map.id}/`, map.target_key)} title="Eşlemeyi sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flow">
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader><CardTitle>Rota oluştur</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Rota adı" value={routeDraft.name} onChange={(e) => setRouteDraft((v) => ({ ...v, name: e.target.value }))} />
                <Input placeholder="Ürün grubu anahtarı" value={routeDraft.product_group_key} onChange={(e) => setRouteDraft((v) => ({ ...v, product_group_key: e.target.value }))} />
                <div className="grid gap-2">
                  {stations.map((st) => (
                    <div key={st.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{st.code} · {st.name}</span>
                        <Switch
                          checked={routeDraft.station_ids.includes(String(st.id))}
                          onCheckedChange={(checked) => setRouteDraft((v) => ({
                            ...v,
                            station_ids: checked ? [...v.station_ids, String(st.id)] : v.station_ids.filter((id) => id !== String(st.id)),
                            parallel_station_ids: checked ? v.parallel_station_ids : v.parallel_station_ids.filter((id) => id !== String(st.id)),
                          }))}
                        />
                      </div>
                      {routeDraft.station_ids.includes(String(st.id)) && (
                        <label className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                          <span>Paralel başlayabilir</span>
                          <Switch
                            checked={routeDraft.parallel_station_ids.includes(String(st.id))}
                            onCheckedChange={(checked) => setRouteDraft((v) => ({
                              ...v,
                              parallel_station_ids: checked ? [...v.parallel_station_ids, String(st.id)] : v.parallel_station_ids.filter((id) => id !== String(st.id)),
                            }))}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                <Button onClick={createRoute} disabled={!routeDraft.name || !routeDraft.product_group_key || routeDraft.station_ids.length === 0}><Route className="mr-2 h-4 w-4" /> Rota kaydet</Button>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Kural seti oluştur</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Input placeholder="Kural adı" value={ruleDraft.name} onChange={(e) => setRuleDraft((v) => ({ ...v, name: e.target.value }))} />
                  <Select value={ruleDraft.scope} onValueChange={(value) => setRuleDraft((v) => ({ ...v, scope: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['global', 'station', 'route'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                  <Select value={ruleDraft.station} onValueChange={(value) => setRuleDraft((v) => ({ ...v, station: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">İstasyon yok</SelectItem>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code}</SelectItem>)}</SelectContent></Select>
                  <Select value={ruleDraft.route} onValueChange={(value) => setRuleDraft((v) => ({ ...v, route: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Rota yok</SelectItem>{routes.map((route) => <SelectItem key={route.id} value={String(route.id)}>{route.name}</SelectItem>)}</SelectContent></Select>
                  <Button onClick={createRule} disabled={!ruleDraft.name}><Plus className="mr-2 h-4 w-4" /> Kural ekle</Button>
                </CardContent>
              </Card>
              <div className="grid gap-3 xl:grid-cols-2">
                {routes.map((route) => (
                  <Card key={route.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{route.name}</p>
                            {route.is_default && <Badge>Varsayılan</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{route.product_group_key || 'ürün grubu yok'} · {route.steps?.length || 0} istasyon</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/routes/${route.id}/`, route.name)} title="Rotayı sil">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {(route.steps || []).map((step, idx) => (
                          <div key={step.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-2 text-xs">
                            <span className="font-medium">{idx + 1}. {step.station_code} · {step.station_name}</span>
                            <div className="flex flex-wrap justify-end gap-1">
                              {step.start_policy === 'parallel' ? <Badge variant="secondary">Paralel başlayabilir</Badge> : <Badge variant="outline">Sırayla</Badge>}
                              {step.department_name && <Badge variant="outline">{step.department_name}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {rules.map((rule) => (
                  <Card key={rule.id}>
                    <CardContent className="flex items-center justify-between gap-3 pt-6">
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{rule.scope} · {rule.trigger_event} · {rule.blocks?.length || 0} blok</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/rules/${rule.id}/`, rule.name)} title="Kural setini sil">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="presets">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset) => (
              <Card key={preset.id}>
                <CardHeader><CardTitle>{preset.name}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{preset.description || preset.key}</p>
                  <Button onClick={() => clonePreset(preset)} disabled={busy}><Copy className="mr-2 h-4 w-4" /> Şablondan kopyala</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function ProductionWorkOrdersPage() {
  const { toast } = useToast()
  const workOrderImportRef = useRef<HTMLInputElement | null>(null)
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [tablets, setTablets] = useState<Tablet[]>([])
  const [stepTargetDraft, setStepTargetDraft] = useState<Record<number, string>>({})
  const [contractId, setContractId] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    const [wo, qs, tabletRows] = await Promise.all([
      fetchAll<WorkOrder>('/production/work-orders/'),
      fetchAll<any>('/quotes/?document_type=Contract&summary=1'),
      fetchAll<Tablet>('/production/tablets/'),
    ])
    setOrders(wo)
    setContracts(qs.filter((item) => item.status === 'Approved' || item.status === 'Onaylandı'))
    setTablets(tabletRows)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((item) => `${item.number} ${item.source_number} ${item.customer_name}`.toLowerCase().includes(q))
  }, [orders, query])

  const createFromContract = async () => {
    if (!contractId) return
    await api.post('/production/work-orders/from-contract/', { quote_id: contractId })
    toast({ title: 'Sözleşme üretim iş emrine aktarıldı' })
    setContractId('')
    await load()
  }

  const exportWorkOrders = async () => {
    const response = await api.get('/production/work-orders/export/', { responseType: 'blob' })
    downloadJson(response.data, 'production_work_orders.json')
    toast({ title: 'İş emirleri dışa aktarıldı' })
  }

  const importWorkOrders = async (file?: File) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    await api.post('/production/work-orders/import/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    toast({ title: 'İş emirleri içe aktarıldı' })
    await load()
  }

  const tabletsForStep = (step: StepProgress) => tablets.filter((tablet) => tablet.station_code === step.station_code)

  const assignStepToTablet = async (step: StepProgress) => {
    const tabletId = stepTargetDraft[step.id]
    if (!tabletId) return
    await api.post('/production/step-tablet-assignments/', {
      step: step.id,
      tablet: Number(tabletId),
      priority: 0,
      is_pinned: true,
    })
    setStepTargetDraft((current) => ({ ...current, [step.id]: '' }))
    toast({ title: 'İş bu tablete özel olarak atandı' })
    await load()
  }

  const clearStepTabletAssignments = async (step: StepProgress) => {
    const assignments = step.assigned_tablets || []
    await Promise.all(assignments.map((item) => api.delete(`/production/step-tablet-assignments/${item.id}/`)))
    toast({ title: 'İş tüm istasyon tabletlerine açıldı' })
    await load()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Üretim İş Emirleri"
        description="Sözleşmeden otomatik gelen veya manuel açılacak üretim işleri."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={workOrderImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void importWorkOrders(file)
              }}
            />
            <Button variant="outline" onClick={exportWorkOrders}><Download className="mr-2 h-4 w-4" /> Dışa aktar</Button>
            <Button variant="outline" onClick={() => workOrderImportRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> İçe aktar</Button>
            <Dialog>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Sözleşmeden aktar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Onaylı sözleşmeden iş emri oluştur</DialogTitle></DialogHeader>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger><SelectValue placeholder="Onaylı sözleşme seç" /></SelectTrigger>
                  <SelectContent>
                    {contracts.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.number} - {item.customer_name || item.customerName || 'Cari'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter><Button onClick={createFromContract} disabled={!contractId}>Aktar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İş emri, sözleşme veya müşteri ara" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        {filtered.map((order) => (
          <Card key={order.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{order.number}</CardTitle>
                <p className="text-sm text-muted-foreground">{order.customer_name || 'Cari yok'} · {order.source_number || 'Manuel'} · {order.route_name || 'Rota'}</p>
              </div>
              <Badge>{statusLabel[order.status] || order.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {(order.lines || []).map((line) => (
                <div key={line.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{line.product_sku} · {line.product_name}</p>
                      <p className="text-xs text-muted-foreground">{line.detail_1 || '-'} / {line.detail_2 || '-'}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{formatNumber(n(line.completed_quantity))} / {formatNumber(n(line.quantity))}</p>
                      {line.stock_in_done && <Badge variant="secondary">Depoya işlendi</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-6">
                    {(line.steps || []).map((step) => (
                      <div key={step.id} className="rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium">{step.station_code}</span>
                          <Badge variant="outline">{statusLabel[step.status] || step.status}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 text-xs">
                          {step.start_policy === 'parallel' ? <Badge variant="secondary">Paralel</Badge> : <Badge variant="outline">Sırayla</Badge>}
                          {(step.assigned_tablets || []).length ? <Badge>Tablete özel</Badge> : <Badge variant="outline">Tüm tabletler</Badge>}
                        </div>
                        <div className="mt-2"><ProgressBar done={step.completed_quantity} target={step.target_quantity} /></div>
                        <div className="mt-3 space-y-2 border-t pt-2">
                          {(step.assigned_tablets || []).length > 0 && (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {(step.assigned_tablets || []).map((assignment) => (
                                <div key={assignment.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
                                  <span>{assignment.tablet_name}</span>
                                  {assignment.is_pinned && <Badge variant="secondary">Öne çıkar</Badge>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <Select value={stepTargetDraft[step.id] || ''} onValueChange={(value) => setStepTargetDraft((current) => ({ ...current, [step.id]: value }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Belirli tablete ata" /></SelectTrigger>
                              <SelectContent>
                                {tabletsForStep(step).map((tablet) => (
                                  <SelectItem key={tablet.id} value={String(tablet.id)}>{tablet.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" disabled={!stepTargetDraft[step.id]} onClick={() => assignStepToTablet(step)}>
                                Tablete ata
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 flex-1 text-xs" disabled={!(step.assigned_tablets || []).length} onClick={() => clearStepTabletAssignments(step)}>
                                Tüm tabletler
                              </Button>
                            </div>
                            {!tabletsForStep(step).length && <p className="text-[11px] text-muted-foreground">Bu istasyona bağlı tablet yok.</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ProductionConsolePage() {
  const { toast } = useToast()
  const [items, setItems] = useState<ConsoleItem[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [station, setStation] = useState('all')
  const [closing, setClosing] = useState<ConsoleItem | null>(null)
  const [goodQuantity, setGoodQuantity] = useState('0')
  const [note, setNote] = useState('')

  const load = async () => {
    const [ctx, st] = await Promise.all([
      api.get('/production/station-console/context/', { params: station === 'all' ? {} : { station_code: station } }).then((res) => res.data?.items || []),
      fetchAll<Station>('/production/stations/'),
    ])
    setItems(ctx)
    setStations(st)
  }

  useEffect(() => {
    void load()
  }, [station])

  const startSession = async (item: ConsoleItem) => {
    await api.post('/production/station-sessions/start/', {
      line_id: item.line_id,
      station_code: item.station_code,
    })
    toast({ title: item.can_take_over ? 'İş devralındı' : 'İş başlatıldı' })
    await load()
  }

  const sendSessionAction = async (endpoint: string, sessionId?: number, title = 'Oturum güncellendi') => {
    if (!sessionId) return
    await api.post(`/production/station-sessions/${endpoint}/`, {
      session_id: sessionId,
    })
    toast({ title })
    await load()
  }

  const openClose = (item: ConsoleItem) => {
    setClosing(item)
    setGoodQuantity(String(item.remaining_quantity ?? Math.max(n(item.target_quantity) - n(item.completed_quantity), 0)))
    setNote('')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="İstasyon Konsolu" description="Kullanıcı oturumu başlatın, vardiya devredin ve iş bitiminde sağlam adedi kapatın." />
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_auto]">
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm açık istasyonlar</SelectItem>
              {stations.map((item) => <SelectItem key={item.id} value={item.code}>{item.code} - {item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <Card key={`${item.line_id}-${item.station_code}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{item.station_code} · {item.product_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.work_order_number} · {item.customer_name || '-'} · {item.detail_1 || '-'} / {item.detail_2 || '-'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge>{statusLabel[item.status] || item.status}</Badge>
                  {item.previous_summary?.has_discrepancy && <Badge variant="outline" className="border-amber-400 text-amber-600">Fark incelemede</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressBar done={item.completed_quantity} target={item.target_quantity} />
              <div className="grid gap-2 text-sm sm:grid-cols-4">
                <span>Hedef: {formatNumber(n(item.target_quantity))}</span>
                <span>Sağlam: {formatNumber(n(item.completed_quantity))}</span>
                <span>Makine: {formatNumber(n(item.machine_quantity))}</span>
                <span>Kalan: {formatNumber(n(item.remaining_quantity))}</span>
              </div>
              {item.previous_summary && (
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Önceki: {item.previous_summary.station_code || '-'} · Sağlam {formatNumber(n(item.previous_summary.completed_quantity))} · {item.previous_summary.last_user || 'Kullanıcı yok'}
                </div>
              )}
              {item.current_user_session ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  {item.current_user_session.status === 'paused' ? (
                    <Button variant="outline" onClick={() => sendSessionAction('resume', item.current_user_session?.id, 'İşe devam edildi')}>Devam</Button>
                  ) : (
                    <Button variant="outline" onClick={() => sendSessionAction('pause', item.current_user_session?.id, 'Mola başlatıldı')}>Mola</Button>
                  )}
                  <Button variant="outline" onClick={() => sendSessionAction('handover', item.current_user_session?.id, 'İş devredildi')}>Devret</Button>
                  <Button className="sm:col-span-2" onClick={() => openClose(item)}><Send className="mr-2 h-4 w-4" /> İşi / vardiyayı kapat</Button>
                </div>
              ) : item.active_session ? (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  Aktif oturum: {item.active_session.user_name || 'Başka kullanıcı'} · Makine {formatNumber(n(item.active_session.machine_quantity))}
                </div>
              ) : (
                <Button className="w-full" onClick={() => startSession(item)}>
                  <Play className="mr-2 h-4 w-4" /> {item.can_take_over ? 'Devral ve başlat' : 'Başlat'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!closing} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{closing?.station_code} işi / vardiyası kapat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Sağlam adet</Label>
              <Input value={goodQuantity} onChange={(event) => setGoodQuantity(event.target.value)} inputMode="decimal" />
            </div>
            <div className="grid gap-2">
              <Label>Not</Label>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            {closing?.current_user_session && n(closing.current_user_session.machine_quantity) !== n(goodQuantity) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Makine adedi {formatNumber(n(closing.current_user_session.machine_quantity))}; beyan farkı yönetici incelemesine düşecek.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!closing?.current_user_session) return
                await api.post('/production/station-sessions/close/', {
                  session_id: closing.current_user_session.id,
                  declared_good_quantity: goodQuantity,
                  note,
                })
                toast({ title: 'Oturum kapatıldı' })
                setClosing(null)
                await load()
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function playTabletAlarm() {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContextCtor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.75)
    window.setTimeout(() => ctx.close(), 900)
  } catch {
    // Browser may block audio until the first user interaction.
  }
}

export function ProductionTabletPage() {
  const { toast } = useToast()
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const initialToken = params.get('token') || localStorage.getItem('production-tablet-token') || ''
  const [token, setToken] = useState(initialToken)
  const [ctx, setCtx] = useState<TabletContext>({})
  const [selectedLineId, setSelectedLineId] = useState('')
  const [loginSlot, setLoginSlot] = useState<number | null>(null)
  const [loginUser, setLoginUser] = useState('')
  const [pin, setPin] = useState('')
  const [closingSlot, setClosingSlot] = useState<TabletSlot | null>(null)
  const [closingQty, setClosingQty] = useState('')
  const [closingPin, setClosingPin] = useState('')
  const [note, setNote] = useState('')
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkpointTitle, setCheckpointTitle] = useState('')
  const [checkpointTotal, setCheckpointTotal] = useState('')
  const [checkpointNote, setCheckpointNote] = useState('')
  const [activeAlert, setActiveAlert] = useState<any | null>(null)
  const seenAlerts = useRef<Set<number>>(new Set())
  const checkpointActionRef = useRef<((total: string, note: string) => Promise<void>) | null>(null)

  const load = async () => {
    if (!token) return
    localStorage.setItem('production-tablet-token', token)
    const response = await api.get('/production/tablet/context/', { params: { token } })
    const data = response.data || {}
    setCtx(data)
    if (!selectedLineId && data.work_items?.[0]) setSelectedLineId(String(data.work_items[0].line_id))
    const alert = (data.alerts || []).find((item: any) => !seenAlerts.current.has(item.id))
    if (alert) {
      seenAlerts.current.add(alert.id)
      setActiveAlert(alert)
      playTabletAlarm()
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [token])

  const slots = Array.from({ length: ctx.station?.max_workers || 1 }, (_, index) => ctx.slots?.find((slot) => Number(slot.slot_index) === index) || null)
  const selectedWork = ctx.work_items?.find((item) => String(item.line_id) === selectedLineId) || ctx.work_items?.[0]
  const activeSlots = slots.filter(Boolean) as TabletSlot[]
  const startedSlots = activeSlots.filter((slot) => slot.status === 'started')
  const suggestedCheckpoint = String(n(ctx.active_window?.start_total) + n(ctx.active_window?.machine_delta) || n(selectedWork?.machine_quantity) || 0)

  const requestCheckpoint = (title: string, action: (total: string, note: string) => Promise<void>) => {
    setCheckpointTitle(title)
    setCheckpointTotal(suggestedCheckpoint)
    setCheckpointNote('')
    checkpointActionRef.current = action
    setCheckpointOpen(true)
  }

  const submitCheckpoint = async () => {
    if (!checkpointActionRef.current || checkpointTotal === '') return
    setSubmitting(true)
    try {
      await checkpointActionRef.current(checkpointTotal, checkpointNote)
      checkpointActionRef.current = null
      setCheckpointOpen(false)
      setCheckpointTotal('')
      setCheckpointNote('')
      await load()
    } catch (error: any) {
      toast({
        title: 'Hata',
        description: error?.response?.data?.detail || error.message || 'Bir hata oluştu.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const login = async () => {
    if (loginSlot === null) return
    const perform = async (total?: string, checkpointNoteValue?: string) => {
      await api.post('/production/tablet/login-slot/', {
        token,
        user_id: Number(loginUser),
        pin,
        line_id: selectedWork?.line_id || null,
        slot_index: loginSlot,
        checkpoint_total: total || undefined,
        note: checkpointNoteValue || '',
      })
      setLoginSlot(null)
      setLoginUser('')
      setPin('')
      toast({ title: 'Oturum açıldı' })
    }
    setSubmitting(true)
    try {
      if (activeSlots.length) {
        const names = activeSlots.map((s) => s.user_name).join(', ')
        const operatorName = ctx.operators?.find((op) => String(op.id) === String(loginUser))?.name || 'Yeni çalışan'
        requestCheckpoint(`${operatorName} işe başlamadan önce; içerideki çalışanların (${names}) ortak sayaç (üretim) değerini yazın.`, perform)
        return
      }
      await perform()
      await load()
    } catch (error: any) {
      toast({
        title: 'Giriş yapılamadı',
        description: error?.response?.data?.detail || 'Hatalı PIN veya geçersiz değer.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const tabletAction = async (endpoint: string, session: TabletSlot) => {
    const perform = async (total?: string, checkpointNoteValue?: string) => {
      await api.post(`/production/tablet/${endpoint}/`, {
        token,
        session_id: session.id,
        checkpoint_total: total || undefined,
        note: checkpointNoteValue || '',
      })
      toast({ title: endpoint.includes('start') ? 'Mola başladı' : 'İşe devam edildi' })
      await load()
    }
    const needsCheckpoint = endpoint.includes('break/start') || (endpoint.includes('break/end') && startedSlots.length > 0)
    setSubmitting(true)
    try {
      if (needsCheckpoint) {
        const actionText = endpoint.includes('start')
          ? `${session.user_name} molaya çıkıyor. Gitmeden önce makinenin üzerindeki güncel sayaç (toplam üretim) değerini buraya yazın.`
          : `${session.user_name} moladan dönüyor. İşe katılmadan önce makinenin üzerindeki güncel sayaç (toplam üretim) değerini buraya yazın.`
        requestCheckpoint(actionText, perform)
        return
      }
      await perform()
    } catch (error: any) {
      toast({
        title: 'İşlem başarısız oldu',
        description: error?.response?.data?.detail || 'Lütfen girdiğiniz değeri kontrol edin.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const logout = async () => {
    if (!closingSlot) return
    setSubmitting(true)
    try {
      await api.post('/production/tablet/logout-slot/', {
        token,
        session_id: closingSlot.id,
        user_id: closingSlot.user_id,
        pin: closingPin,
        declared_good_quantity: closingQty,
        note,
      })
      setClosingSlot(null)
      setClosingQty('')
      setClosingPin('')
      setNote('')
      toast({ title: 'Çıkış yapıldı' })
      await load()
    } catch (error: any) {
      toast({
        title: 'Çıkış yapılamadı',
        description: error?.response?.data?.detail || 'Hatalı PIN veya geçersiz değer.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const completeWorkItem = async () => {
    if (!selectedWork) return
    const perform = async (total?: string, checkpointNoteValue?: string) => {
      await api.post('/production/tablet/complete-work-item/', {
        token,
        line_id: selectedWork.line_id,
        checkpoint_total: total || undefined,
        note: checkpointNoteValue || 'Tablet üzerinden iş emri tamamlandı.',
      })
      toast({ title: 'İş emri tamamlandı, sıradaki iş kuyruğa alınacak' })
      await load()
    }
    setSubmitting(true)
    try {
      if (activeSlots.length) {
        const names = activeSlots.map((s) => s.user_name).join(', ')
        requestCheckpoint(`Aktif çalışanlar (${names}) için iş emrini tamamlamadan önce, makinenin üzerindeki güncel sayaç (toplam üretim) değerini yazın.`, perform)
        return
      }
      await perform()
    } catch (error: any) {
      toast({
        title: 'Hata',
        description: error?.response?.data?.detail || 'İşlem tamamlanamadı.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const ackAlert = async () => {
    if (!activeAlert) return
    await api.post(`/production/station-alerts/${activeAlert.id}/ack/`, { token })
    setActiveAlert(null)
    await load()
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <Card className="w-full">
          <CardHeader><CardTitle>İstasyon tableti</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Tablet tokeni" value={token} onChange={(e) => setToken(e.target.value)} />
            <Button onClick={load} className="w-full">Tableti aç</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen space-y-4 bg-background p-4">
      <div className="rounded-xl border bg-card p-5 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{ctx.station?.department_name || 'İmalat'}</p>
        <h1 className="mt-2 text-4xl font-black tracking-wide md:text-6xl">{ctx.station?.code} · {ctx.station?.name}</h1>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <MetricBlock label="Günlük hedef" value={formatNumber(n(ctx.daily_target?.target_quantity))} />
          <MetricBlock label="Bugün yapılan" value={formatNumber(n(ctx.daily_target?.actual_quantity))} />
          <MetricBlock label="Kalan" value={formatNumber(n(ctx.daily_target?.remaining_quantity))} />
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 lg:grid-cols-[1fr_280px] lg:items-end">
          <div className="space-y-2">
            <Label>Aktif iş emri</Label>
            <Select value={selectedLineId} onValueChange={setSelectedLineId}>
              <SelectTrigger className="h-14 text-lg"><SelectValue placeholder="İş emri seç" /></SelectTrigger>
              <SelectContent>
                {(ctx.work_items || []).map((item) => (
                  <SelectItem key={item.line_id} value={String(item.line_id)}>
                    {item.work_order_number} · {item.product_sku} · {item.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Button variant="outline" onClick={load} className="h-14" disabled={submitting}><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
            <Button onClick={completeWorkItem} disabled={!selectedWork || submitting} className="h-14"><CheckCircle2 className="mr-2 h-4 w-4" /> İşi tamamla</Button>
          </div>
        </CardContent>
      </Card>

      {selectedWork && (
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-5">
            <div className="md:col-span-2">
              <p className="text-2xl font-bold">{selectedWork.product_name}</p>
              <p className="text-muted-foreground">{selectedWork.detail_1 || '-'} / {selectedWork.detail_2 || '-'}</p>
            </div>
            <MetricBlock label="Hedef" value={formatNumber(n(selectedWork.target_quantity))} />
            <MetricBlock label="Resmi sağlam" value={formatNumber(n(selectedWork.completed_quantity))} />
            <MetricBlock label="Makine" value={formatNumber(n(selectedWork.machine_quantity))} />
            <MetricBlock label="Pencere" value={formatNumber(n(ctx.active_window?.machine_delta))} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot, index) => (
          <Card key={index} className="min-h-72">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Slot {index + 1}</span>
                {slot?.status === 'paused' && <Badge variant="outline">Molada</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {slot ? (
                <>
                  <div>
                    <p className="text-2xl font-bold">{slot.user_name}</p>
                    <p className="text-sm text-muted-foreground">{slot.work_order_number} · {slot.product_sku}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricBlock label="Oturum makine" value={formatNumber(n(slot.machine_quantity))} />
                    <MetricBlock label="Bugün kişi" value={formatNumber(n(ctx.operators?.find((item) => item.id === slot.user_id)?.today_total))} />
                  </div>
                  <MetricBlock label="Mola sn" value={formatNumber(slot.break_seconds || 0)} />
                  <div className="grid gap-2">
                    {slot.status === 'paused' ? (
                      <Button variant="outline" onClick={() => tabletAction('break/end', slot)} disabled={submitting}>Molayı bitir</Button>
                    ) : (
                      <Button variant="outline" onClick={() => window.confirm('Molaya çıkılsın mı?') && tabletAction('break/start', slot)} disabled={submitting}>
                        <Pause className="mr-2 h-4 w-4" /> Mola
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      disabled={submitting}
                      onClick={() => {
                        setClosingSlot(slot)
                        setClosingQty(String(slot.machine_quantity || 0))
                        setClosingPin('')
                        setNote('')
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Çıkış yap
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted/40"
                  onClick={() => setLoginSlot(index)}
                  disabled={submitting}
                >
                  <Plus className="h-12 w-12" />
                  <span className="mt-2 text-lg font-semibold">Çalışan ekle</span>
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Bugünkü kişi toplamları</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {(ctx.operators || []).map((operator) => (
            <div key={operator.id} className="rounded-md border p-3">
              <p className="font-medium">{operator.name}</p>
              <p className="text-2xl font-bold">{formatNumber(n(operator.today_total))}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={loginSlot !== null} onOpenChange={(open) => !open && setLoginSlot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Slot {loginSlot !== null ? loginSlot + 1 : ''} çalışan girişi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={loginUser} onValueChange={setLoginUser}>
              <SelectTrigger><SelectValue placeholder="Çalışan seç" /></SelectTrigger>
              <SelectContent>{(ctx.operators || []).map((operator) => <SelectItem key={operator.id} value={String(operator.id)}>{operator.name}{operator.has_pin ? '' : ' · PIN yok'}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="password" placeholder="Üretim PIN’i" value={pin} onChange={(e) => setPin(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter><Button onClick={login} disabled={!loginUser || !pin || submitting}>Başlat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closingSlot} onOpenChange={(open) => !open && setClosingSlot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{closingSlot?.user_name} - Çıkış Yap</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Makinenin üzerindeki güncel sayaç (toplam üretim) değerini yazın. Sistem, ürettiğiniz miktarı otomatik olarak hesaplayıp kaydeder.
            </div>
            <div className="grid gap-2">
              <Label>Makinedeki Güncel Sayaç (Toplam Üretim)</Label>
              <Input value={closingQty} onChange={(e) => setClosingQty(e.target.value)} inputMode="decimal" disabled={submitting} />
            </div>
            <Input type="password" placeholder="Üretim PIN’i" value={closingPin} onChange={(e) => setClosingPin(e.target.value)} disabled={submitting} />
            <Textarea placeholder="Varsa notunuz" value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter><Button onClick={logout} disabled={!closingQty || !closingPin || submitting}>Çıkışı tamamla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkpointOpen} onOpenChange={(open) => {
        if (!open) {
          checkpointActionRef.current = null
          setCheckpointOpen(false)
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sayaç Kaydı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {checkpointTitle || 'Makinenin üzerindeki sayacı (toplam üretimi) aynen yazın. Sistem, çalışanların payına düşen miktarı otomatik hesaplayacaktır.'}
            </div>
            <div className="grid gap-2">
              <Label>Makinedeki Güncel Sayaç (Toplam Üretim)</Label>
              <Input value={checkpointTotal} onChange={(e) => setCheckpointTotal(e.target.value)} inputMode="decimal" autoFocus disabled={submitting} />
            </div>
            <Textarea placeholder="Varsa notunuz" value={checkpointNote} onChange={(e) => setCheckpointNote(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckpointOpen(false)} disabled={submitting}>Vazgeç</Button>
            <Button onClick={submitCheckpoint} disabled={checkpointTotal === '' || submitting}>Sayaç Değerini Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeAlert}>
        <DialogContent className="border-amber-400">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl"><Volume2 className="h-6 w-6 text-amber-500" /> {activeAlert?.title}</DialogTitle></DialogHeader>
          <p className="text-lg">{activeAlert?.message}</p>
          <DialogFooter><Button onClick={ackAlert}><CheckCircle2 className="mr-2 h-4 w-4" /> Okudum</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

export function ProductionReportsPage() {
  const [summary, setSummary] = useState<any>({})

  const load = async () => {
    setSummary(await api.get('/production/reports/summary/').then((res) => res.data))
  }

  useEffect(() => {
    void load()
  }, [])

  const downloadCsv = async () => {
    const res = await api.get('/production/reports/export/', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'imalat_raporu.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="İmalat Raporları"
        description="Bölüm, istasyon ve çalışan bazlı üretim performansı."
        actions={
          <>
            <Button variant="outline" onClick={load}><TimerReset className="mr-2 h-4 w-4" /> Yenile</Button>
            <Button variant="outline" onClick={downloadCsv}><Download className="mr-2 h-4 w-4" /> CSV indir</Button>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardTitle>Bölüm</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.departments || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle>İstasyon</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.stations || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle>Açık iş</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.active_orders || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle>Bugün adet</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatNumber(summary.completed_today || 0)}</CardContent></Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>İstasyon verimliliği</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(summary.by_station || []).map((row: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between rounded border p-3 text-sm">
                <span>{row.station__code} · {row.station__department__name}</span>
                <strong>{formatNumber(row.total || 0)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Çalışan üretimi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(summary.by_worker || []).map((row: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between rounded border p-3 text-sm">
                <span>{row.user__username || 'Cihaz / sistem'}</span>
                <strong>{formatNumber(row.total || 0)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
