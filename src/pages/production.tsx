import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, Play, Plus, RefreshCw, Route, Save, Send, TimerReset, Trash2, UserPlus } from 'lucide-react'

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
type DeviceMap = { id: number; device: number; device_name?: string; station?: number; station_code?: string; source_path: string; target_key: string; target_type: string; is_required: boolean; is_active: boolean; order: number }
type DataField = { id: number; station?: number | null; station_code?: string; key: string; label: string; field_type: string; source: string; is_visible: boolean; order: number }
type RuleSet = { id: number; name: string; scope: string; station?: number | null; route?: number | null; trigger_event: string; is_active: boolean; order: number; blocks?: RuleBlock[] }
type RuleBlock = { id: number; rule_set: number; block_type: string; config: Record<string, any>; is_active: boolean; order: number }
type TemplatePreset = { id: number; key: string; name: string; description?: string; is_active: boolean }
type RouteTemplate = { id: number; name: string; product_group_key?: string; is_default: boolean; steps?: any[] }
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
  station_code: string
  station_name: string
  department_name: string
  department_color?: string
  target_quantity: string | number
  completed_quantity: string | number
  machine_quantity?: string | number
  status: string
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [stationAssignments, setStationAssignments] = useState<StationAssignment[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [devices, setDevices] = useState<Device[]>([])
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
  const [routeDraft, setRouteDraft] = useState({ name: '', product_group_key: '', station_ids: [] as string[] })
  const [deviceDraft, setDeviceDraft] = useState({ station: '', name: '' })
  const [mapDraft, setMapDraft] = useState({ device: '', source_path: '$.', target_key: '', target_type: 'text', is_required: false })
  const [fieldDraft, setFieldDraft] = useState({ station: 'global', key: '', label: '', field_type: 'text', source: 'manual' })
  const [ruleDraft, setRuleDraft] = useState({ name: '', scope: 'station', station: 'none', route: 'none', trigger_event: 'pi_event' })

  const load = async () => {
    const [d, s, assignmentRows, userRows, dev, maps, fields, r, ruleRows, presetRows, l, cfg, dash] = await Promise.all([
      fetchAll<Department>('/production/departments/'),
      fetchAll<Station>('/production/stations/'),
      fetchAll<StationAssignment>('/production/station-users/'),
      api.get('/auth/users/').then((res) => (Array.isArray(res.data) ? res.data : res.data?.results || [])).catch(() => []),
      fetchAll<Device>('/production/devices/'),
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
    setDeviceMaps(maps)
    setDataFields(fields)
    setRoutes(r)
    setRules(ruleRows)
    setPresets(presetRows)
    setLocations(l)
    setSettings(cfg || {})
    setSummary(dash || {})
  }

  useEffect(() => {
    void load()
  }, [])

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
      step_inputs: routeDraft.station_ids.map((stationId, order) => ({ station: Number(stationId), order, is_required: true })),
    })
    setRouteDraft({ name: '', product_group_key: '', station_ids: [] })
    toast({ title: 'Rota oluşturuldu' })
    await load()
  }

  const createDevice = async () => {
    await api.post('/production/devices/', { station: Number(deviceDraft.station), name: deviceDraft.name })
    setDeviceDraft({ station: '', name: '' })
    toast({ title: 'Cihaz oluşturuldu' })
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="İmalat Yönetimi"
        description="Bölüm, istasyon, rota, cihaz verisi, akış kuralları ve şablonları fabrika yapısına göre düzenleyin."
        actions={
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
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

      <Tabs defaultValue="departments" className="space-y-3">
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="departments">Bölümler</TabsTrigger>
          <TabsTrigger value="stations">İstasyonlar</TabsTrigger>
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
                    <label key={st.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>{st.code} · {st.name}</span>
                      <Switch
                        checked={routeDraft.station_ids.includes(String(st.id))}
                        onCheckedChange={(checked) => setRouteDraft((v) => ({ ...v, station_ids: checked ? [...v.station_ids, String(st.id)] : v.station_ids.filter((id) => id !== String(st.id)) }))}
                      />
                    </label>
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
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [contractId, setContractId] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    const [wo, qs] = await Promise.all([
      fetchAll<WorkOrder>('/production/work-orders/'),
      fetchAll<any>('/quotes/?document_type=Contract&summary=1'),
    ])
    setOrders(wo)
    setContracts(qs.filter((item) => item.status === 'Approved' || item.status === 'Onaylandı'))
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Üretim İş Emirleri"
        description="Sözleşmeden otomatik gelen veya manuel açılacak üretim işleri."
        actions={
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
                        <div className="mt-2"><ProgressBar done={step.completed_quantity} target={step.target_quantity} /></div>
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
