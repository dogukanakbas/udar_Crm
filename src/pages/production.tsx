import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Bell, Calendar, CheckCircle2, Copy, Cpu, Download, Edit3, FileImage, Layers, LogOut, Monitor, Pause, Play, Plus, RefreshCw, Route, Save, Send, TimerReset, Trash2, Upload, UserPlus, Volume2, X, Building2, Workflow, Clock, Tablet, AlertTriangle, ChefHat, Image, FileSpreadsheet, HardDrive, LayoutTemplate } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, PieChart, Pie } from 'recharts'

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
import { PageSubSidebar, type SubSidebarTab, type SubSidebarGroup } from '@/components/page-sub-sidebar'
import { useRouterState, useNavigate } from '@tanstack/react-router'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import api, { apiOrigin } from '@/lib/api'
import { formatNumber } from '@/lib/utils'

type Department = { id: number; code: string; name: string; color?: string; notification_group?: number | null; order: number; is_active: boolean }
type UserGroup = { id: number; group_id: string; title: string; description?: string }
type Station = { id: number; department: number; department_name?: string; code: string; name: string; order: number; max_workers: number; default_daily_target?: string | number; is_handover: boolean; is_final: boolean; is_active: boolean }
type UserLite = { id: number; username?: string; email?: string; first_name?: string; last_name?: string; full_name?: string; role?: string; permissions?: string[] }
type StationAssignment = { id: number; station: number; station_code?: string; user: number; user_name?: string; role: string; is_active: boolean }
type Device = { id: number; station: number; station_code?: string; name: string; token?: string; is_active: boolean; last_seen_at?: string }
type Tablet = { id: number; station: number; station_code?: string; station_name?: string; name: string; token?: string; is_active: boolean; last_seen_at?: string }
type StationTarget = { id?: number; station: number; station_code?: string; station_name?: string; target_date: string; target_quantity: string | number; note?: string; is_override?: boolean }
type ShiftSchedule = { id: number; department: number; department_name?: string; name: string; weekdays: number[]; start_time: string; end_time: string; crosses_midnight: boolean; order: number; is_active: boolean; note?: string }
type ShiftBreak = { id: number; department: number; department_name?: string; schedule?: number | null; schedule_name?: string; name: string; start_time: string; end_time: string; requires_checkpoint: boolean; lock_type: string; order: number; is_active: boolean; note?: string }
type OperatorProfile = { id: number; user: number; user_name?: string; has_pin?: boolean; is_active: boolean; last_pin_change_at?: string }
type StationAlert = { id: number; target_type: string; station?: number | null; station_code?: string; department?: number | null; department_name?: string; work_order?: number | null; work_order_number?: string; title: string; message: string; severity: string; requires_ack?: boolean; created_at?: string; acks?: any[] }
type DeviceMap = { id: number; device: number; device_name?: string; station?: number; station_code?: string; source_path: string; target_key: string; target_type: string; is_required: boolean; is_active: boolean; order: number }
type DataField = { id: number; station?: number | null; station_code?: string; key: string; label: string; field_type: string; source: string; is_visible: boolean; order: number }
type RuleSet = { id: number; name: string; scope: string; station?: number | null; route?: number | null; trigger_event: string; is_active: boolean; order: number; blocks?: RuleBlock[] }
type RuleBlock = { id: number; rule_set: number; block_type: string; config: Record<string, any>; is_active: boolean; order: number }
type TemplatePreset = { id: number; key: string; name: string; description?: string; is_active: boolean }
type ProductionReportTemplate = { id: number; name: string; key: string; default_format: 'xlsx' | 'pdf'; description?: string; is_active: boolean; file?: string; file_url?: string; created_at?: string; updated_at?: string }
type RouteStep = { id: number; station: number; station_code?: string; station_name?: string; department_name?: string; order: number; is_required: boolean; start_policy?: string }
type RouteTemplate = { id: number; name: string; product_group_key?: string; is_default: boolean; steps?: RouteStep[] }
type WarehouseLocation = { id: number; code: string; name?: string; warehouse: number; warehouse_name?: string }
type ProductionSettings = { default_completion_location?: number | null; default_completion_warehouse?: number | null; auto_stock_in_enabled?: boolean }
type MaterialRequirement = { id: number; material_product?: number; material_sku: string; material_name: string; station_code?: string; station_name?: string; unit?: string; planned_quantity: string | number; consumed_quantity: string | number; remaining_quantity?: string | number; location_label?: string; note?: string; total_stock?: string | number; location_stock?: string | number; matching_stock?: string | number }
type ProductRecipeMaterial = { id: number; operation: number; material_product: number; material_sku?: string; material_name?: string; unit: string; quantity_type: 'fixed' | 'formula'; quantity_per_unit: string | number; formula?: string; scrap_percent?: string | number; conditions?: Record<string, any>; default_location?: number | null; default_location_label?: string; note?: string; is_active: boolean; order: number; total_stock?: string | number; location_stock?: string | number }
type ProductRecipeOperation = { id: number; recipe: number; station: number; station_code?: string; station_name?: string; department_name?: string; order: number; name?: string; description?: string; materials?: ProductRecipeMaterial[] }
type ProductRecipe = { id: number; product: number; product_sku?: string; product_name?: string; version: string; status: 'draft' | 'published' | 'archived'; description?: string; valid_from?: string | null; valid_to?: string | null; operations?: ProductRecipeOperation[] }
type DepartmentDraft = { code: string; name: string; color: string; notification_group: string; is_active: boolean }
type StationDraft = { department: string; code: string; name: string; max_workers: string; default_daily_target: string; is_handover: boolean; is_final: boolean; is_active: boolean }
type DeviceDraft = { station: string; name: string; is_active: boolean }
type TabletDraft = { station: string; name: string; is_active: boolean }
type ShiftDraft = { department: string; name: string; weekdays: number[]; start_time: string; end_time: string; crosses_midnight: boolean; is_active: boolean; note: string }
type BreakDraft = { department: string; schedule: string; name: string; start_time: string; end_time: string; requires_checkpoint: boolean; lock_type: string; is_active: boolean; note: string }
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
type TechnicalDrawing = {
  id: number
  product?: number | string | { id?: number | string; name?: string; sku?: string }
  product_sku?: string | { id?: number | string; name?: string; sku?: string }
  product_name?: string | { id?: number | string; name?: string }
  folder?: number | string | { id?: number | string; name?: string } | null
  title: string
  version?: string
  file?: string
  file_url?: string
  file_type?: string
  folder_name?: string | { id?: number | string; name?: string }
  description?: string
  tags?: string[]
  is_active?: boolean
  uploaded_at?: string
}
type ProductLite = { id: number | string; sku?: string; name?: string; category_name?: string; categoryName?: string; technical_drawing_count?: number; technicalDrawingCount?: number; product_type?: string; stock?: string | number; inventory_mode?: string; attribute_values?: Record<string, any>; template_defaults?: Record<string, any> }
type DrawingFolder = { id: number; name: string; description?: string; order?: number; drawing_count?: number }
type WorkOrderLine = {
  id: number
  product_sku: string
  product_name: string
  detail_1?: string
  detail_2?: string
  quantity: string | number
  completed_quantity: string | number
  technical_notes?: string
  details?: Record<string, any>
  technical_drawings?: TechnicalDrawing[]
  material_requirements?: MaterialRequirement[]
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
  technical_notes?: string
  details?: Record<string, any>
  technical_drawings?: TechnicalDrawing[]
  material_requirements?: MaterialRequirement[]
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
  active_break_started_at?: string | null
}
type TabletDailyTarget = { id?: number; date?: string; target_quantity: string | number; actual_quantity: string | number; remaining_quantity: string | number; completion_percent?: string | number; note?: string }
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
type TabletShiftState = {
  state: 'active' | 'break_locked' | 'off_shift' | 'checkpoint_required'
  label: string
  message?: string
  has_schedule?: boolean
  requires_checkpoint?: boolean
  locked?: boolean
  checkpoint_names?: string[]
  active_window_id?: number | null
  line_id?: number | null
  active_shift?: { id: number; name: string; report_date: string; starts_at: string; ends_at: string } | null
  active_break?: { id: number; name: string; starts_at: string; ends_at: string; requires_checkpoint: boolean; lock_type: string } | null
  next_shift?: { id: number; name: string; starts_at: string; ends_at: string } | null
  next_break?: { id: number; name: string; starts_at: string; ends_at: string; requires_checkpoint: boolean } | null
  seconds_until_change?: number | null
}
type TabletContext = {
  tablet?: { id: number; name: string; token: string }
  station?: { id: number; code: string; name: string; department_name: string; max_workers: number }
  daily_target?: TabletDailyTarget
  shift_state?: TabletShiftState
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
const asText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join(', ') || fallback
  if (typeof value === 'object') {
    const data = value as Record<string, unknown>
    return asText(data.name || data.title || data.sku || data.code || data.label || data.id, fallback)
  }
  return fallback
}
const todayIso = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const shortTime = (value?: string | null) => {
  if (!value) return ''
  const text = String(value)
  if (text.includes('T')) {
    return new Date(text).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }
  return text.slice(0, 5)
}
const formatSeconds = (seconds?: number | null) => {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

const emptyDepartmentDraft = (): DepartmentDraft => ({ code: '', name: '', color: '#2563eb', notification_group: '', is_active: true })
const emptyStationDraft = (): StationDraft => ({ department: '', code: '', name: '', max_workers: '2', default_daily_target: '', is_handover: false, is_final: false, is_active: true })
const emptyDeviceDraft = (): DeviceDraft => ({ station: '', name: '', is_active: true })
const emptyTabletDraft = (): TabletDraft => ({ station: '', name: '', is_active: true })
const emptyShiftDraft = (department = ''): ShiftDraft => ({ department, name: '', weekdays: [0, 1, 2, 3, 4], start_time: '08:00', end_time: '18:00', crosses_midnight: false, is_active: true, note: '' })
const emptyBreakDraft = (department = ''): BreakDraft => ({ department, schedule: 'none', name: '', start_time: '12:00', end_time: '13:00', requires_checkpoint: true, lock_type: 'break_locked', is_active: true, note: '' })
const emptyDrawingDraft = () => ({ product: '', folder: 'none', title: '', version: '', tags: '', description: '', is_active: true })

function pct(done: unknown, target: unknown) {
  const total = n(target)
  if (!total) return 0
  return Math.min(100, Math.round((n(done) / total) * 100))
}

function ProgressBar({ done, target }: { done: unknown; target: unknown }) {
  const value = pct(done, target)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  )
}

function drawingUrl(drawing?: TechnicalDrawing | null) {
  const raw = drawing?.file_url || drawing?.file || ''
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `${apiOrigin}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function TechnicalDrawingButton({ drawings, compact = false }: { drawings?: TechnicalDrawing[]; compact?: boolean }) {
  const activeDrawings = (drawings || []).filter((item) => drawingUrl(item))
  const [selected, setSelected] = useState<TechnicalDrawing | null>(null)
  if (!activeDrawings.length) {
    return (
      <Button size={compact ? 'sm' : 'default'} variant="outline" disabled className={compact ? 'h-8 px-2 text-xs' : ''}>
        <FileImage className="mr-2 h-4 w-4" /> Teknik resim yok
      </Button>
    )
  }
  const current = selected || activeDrawings[0]
  return (
    <>
      <Button size={compact ? 'sm' : 'default'} variant="outline" onClick={() => setSelected(activeDrawings[0])} className={compact ? 'h-8 px-2 text-xs' : ''}>
        <FileImage className="mr-2 h-4 w-4" /> Teknik resim {activeDrawings.length > 1 ? `(${activeDrawings.length})` : ''}
      </Button>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[94vh] max-w-6xl">
          <DialogHeader>
            <DialogTitle>{asText(current?.title, 'Teknik resim')}{current?.version ? ` · ${asText(current.version)}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2 overflow-y-auto lg:max-h-[74vh]">
              {activeDrawings.map((drawing) => (
                <button
                  key={drawing.id}
                  type="button"
                  onClick={() => setSelected(drawing)}
                  className={`w-full rounded-md border p-2 text-left text-sm ${current?.id === drawing.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/40'}`}
                >
                  <p className="font-medium">{asText(drawing.title, 'Teknik resim')}</p>
                  <p className="text-xs text-muted-foreground">{asText(drawing.folder_name, 'Genel')}{drawing.version ? ` · ${asText(drawing.version)}` : ''}</p>
                </button>
              ))}
            </div>
            <div className="flex min-h-[58vh] items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
              <img src={drawingUrl(current)} alt={asText(current?.title, 'Teknik resim')} className="max-h-[74vh] max-w-full object-contain" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MaterialRequirementList({ rows, compact = false }: { rows?: MaterialRequirement[]; compact?: boolean }) {
  const items = (rows || []).filter(Boolean)
  if (!items.length) return null
  return (
    <div className={`rounded-md border bg-muted/10 ${compact ? 'p-2' : 'p-3'}`}>
      <p className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold uppercase tracking-wide text-muted-foreground`}>Bu istasyonda kullanılacak hammaddeler</p>
      <div className={`mt-2 grid gap-1.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {items.slice(0, compact ? 4 : 12).map((row) => {
          const reqQty = n(row.remaining_quantity ?? row.planned_quantity);
          const availableStock = row.location_label ? n(row.matching_stock) : n(row.total_stock);
          const isShortage = availableStock < reqQty;
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 border-b border-dashed border-muted/50 pb-1 last:border-0 last:pb-0">
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium text-foreground">{asText(row.material_sku, 'Kodsuz')} · {asText(row.material_name, 'Ham madde')}</span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {row.location_label ? `${row.location_label} (Raf Stok: ` : 'Toplam Stok: '}
                  <span className={isShortage ? "text-destructive font-semibold" : "text-emerald-600 font-semibold"}>
                    {formatNumber(availableStock)}
                  </span>
                  {row.location_label && ` / Toplam: ${formatNumber(n(row.total_stock))}`}
                  {`)`}
                </span>
              </div>
              <span className="shrink-0 font-semibold text-right text-foreground">{formatNumber(reqQty)} {row.unit || ''}</span>
            </div>
          );
        })}
      </div>
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

function downloadBlobResponse(response: any, fallbackFilename: string) {
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
  const header = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'] || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header)
  const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallbackFilename
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

function canUseProductionTablet(user?: UserLite) {
  if (!user) return false
  if (user.role === 'Admin' || user.permissions?.includes('*')) return true
  const permissions = user.permissions || []
  return permissions.some((code) => ['production.view', 'production.tablet.operate', 'production.station.operate'].includes(code))
}

function assignmentRoleLabel(role: string) {
  if (role === 'lead') return 'Usta başı'
  if (role === 'observer') return 'Gözlemci'
  return 'Operatör'
}

function StationCard({ station, assignments = [], onEdit, onDelete }: { station: Station; assignments?: StationAssignment[]; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="rounded-lg border bg-card/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{station.code}</p>
          <p className="text-xs text-muted-foreground">{station.department_name || station.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={station.is_active ? 'secondary' : 'outline'}>{station.is_active ? 'Aktif' : 'Pasif'}</Badge>
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
      {(onEdit || onDelete) && (
        <div className="mt-3 flex gap-2">
          {onEdit && <Button variant="outline" size="sm" className="h-8 flex-1" onClick={onEdit}><Edit3 className="mr-2 h-3.5 w-3.5" /> Düzenle</Button>}
          {onDelete && <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-3.5 w-3.5" /> Sil</Button>}
        </div>
      )}
    </div>
  )
}

export function ProductionManagementPage() {
  const { toast } = useToast()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const activeTab = (routerState.location.search as { tab?: string }).tab || 'departments'
  const setActiveTab = useCallback((tab: string) => {
    navigate({ search: (prev: any) => ({ ...prev, tab }) } as any)
  }, [navigate])

  const prodGroups: SubSidebarGroup[] = [
    { id: 'factory', label: 'Fabrika Yapısı' },
    { id: 'operational', label: 'Operasyonel' },
    { id: 'product', label: 'Ürün & Malzeme' },
    { id: 'system', label: 'Sistem & Entegrasyon' },
  ]
  const prodTabs: SubSidebarTab[] = [
    { id: 'departments', label: 'Bölümler', icon: Building2, group: 'factory' },
    { id: 'stations', label: 'İstasyonlar', icon: Monitor, group: 'factory' },
    { id: 'flow', label: 'Akış Tasarımcısı', icon: Workflow, group: 'factory' },
    { id: 'shifts', label: 'Vardiyalar', icon: Clock, group: 'operational' },
    { id: 'tablets', label: 'Tablet & PIN', icon: Tablet, group: 'operational' },
    { id: 'alerts', label: 'Bildirimler', icon: AlertTriangle, group: 'operational' },
    { id: 'recipes', label: 'Ürün Reçeteleri', icon: ChefHat, group: 'product' },
    { id: 'drawings', label: 'Teknik Resimler', icon: Image, group: 'product' },
    { id: 'report-templates', label: 'Rapor Şablonları', icon: FileSpreadsheet, group: 'product' },
    { id: 'devices', label: 'Cihaz & Veri', icon: HardDrive, group: 'system' },
    { id: 'presets', label: 'Şablonlar', icon: LayoutTemplate, group: 'system' },
  ]

  const configImportRef = useRef<HTMLInputElement | null>(null)
  const drawingFileRef = useRef<HTMLInputElement | null>(null)
  const reportTemplateFileRef = useRef<HTMLInputElement | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [stationAssignments, setStationAssignments] = useState<StationAssignment[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [tablets, setTablets] = useState<Tablet[]>([])
  const [stationTargets, setStationTargets] = useState<StationTarget[]>([])
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([])
  const [shiftBreaks, setShiftBreaks] = useState<ShiftBreak[]>([])
  const [operatorProfiles, setOperatorProfiles] = useState<OperatorProfile[]>([])
  const [alerts, setAlerts] = useState<StationAlert[]>([])
  const [deviceMaps, setDeviceMaps] = useState<DeviceMap[]>([])
  const [dataFields, setDataFields] = useState<DataField[]>([])
  const [routes, setRoutes] = useState<RouteTemplate[]>([])
  const [rules, setRules] = useState<RuleSet[]>([])
  const [presets, setPresets] = useState<TemplatePreset[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [drawingFolders, setDrawingFolders] = useState<DrawingFolder[]>([])
  const [drawings, setDrawings] = useState<TechnicalDrawing[]>([])
  const [reportTemplates, setReportTemplates] = useState<ProductionReportTemplate[]>([])
  const [recipes, setRecipes] = useState<ProductRecipe[]>([])
  const [settings, setSettings] = useState<ProductionSettings>({})
  const [summary, setSummary] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [userGroups, setUserGroups] = useState<UserGroup[]>([])
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null)
  const [editingStationId, setEditingStationId] = useState<number | null>(null)
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null)
  const [editingTabletId, setEditingTabletId] = useState<number | null>(null)
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null)
  const [editingBreakId, setEditingBreakId] = useState<number | null>(null)
  const [editingMapId, setEditingMapId] = useState<number | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null)
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null)
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentDraft>(emptyDepartmentDraft)
  const [stationDraft, setStationDraft] = useState<StationDraft>(emptyStationDraft)
  const [assignmentDraft, setAssignmentDraft] = useState({ station: '', user: '', role: 'operator' })
  const [routeDraft, setRouteDraft] = useState({ name: '', product_group_key: '', station_ids: [] as string[], parallel_station_ids: [] as string[] })
  const [deviceDraft, setDeviceDraft] = useState<DeviceDraft>(emptyDeviceDraft)
  const [tabletDraft, setTabletDraft] = useState<TabletDraft>(emptyTabletDraft)
  const [targetDraft, setTargetDraft] = useState({ station: '', target_date: todayIso(), target_quantity: '', note: '' })
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft>(emptyShiftDraft)
  const [breakDraft, setBreakDraft] = useState<BreakDraft>(emptyBreakDraft)
  const [pinDraft, setPinDraft] = useState({ user: '', pin: '' })
  const [alertDraft, setAlertDraft] = useState({ target_type: 'station', station: '', department: '', work_order: '', title: '', message: '', severity: 'warning' })
  const [mapDraft, setMapDraft] = useState({ device: '', source_path: '$.', target_key: '', target_type: 'text', is_required: false })
  const [fieldDraft, setFieldDraft] = useState({ station: 'global', key: '', label: '', field_type: 'text', source: 'manual' })
  const [ruleDraft, setRuleDraft] = useState({ name: '', scope: 'station', station: 'none', route: 'none', trigger_event: 'pi_event' })
  const [drawingDraft, setDrawingDraft] = useState(emptyDrawingDraft)
  const [drawingFolderDraft, setDrawingFolderDraft] = useState('')
  const [drawingSearch, setDrawingSearch] = useState('')
  const [reportTemplateDraft, setReportTemplateDraft] = useState({ name: '', key: '', default_format: 'pdf', description: '', is_active: true })
  const [editingReportTemplateId, setEditingReportTemplateId] = useState<number | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [operationDraft, setOperationDraft] = useState({ station: '', order: '0', name: '', description: '' })
  const [materialDraft, setMaterialDraft] = useState({ operation: '', material_product: '', quantity_type: 'fixed', quantity_per_unit: '1', formula: '', unit: 'Adet', scrap_percent: '0', default_location: 'none', conditions: '', note: '' })
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockInForm, setStockInForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '',
    detail_1_override: '',
    detail_2_override: '',
    reference: 'ÜRETİM GİRİŞİ',
    note: 'Hammadde hızlı girişi',
  })
  const [targetProductStocks, setTargetProductStocks] = useState<any[]>([])
  const [isLoadingStocks, setIsLoadingStocks] = useState(false)
  const productionUsers = useMemo(() => users.filter(canUseProductionTablet), [users])

  const load = async () => {
    const [d, s, assignmentRows, userRows, dev, tabletRows, shiftRows, breakRows, profileRows, alertRows, maps, fields, r, ruleRows, presetRows, reportTemplateRows, recipeRows, l, productRows, folderRows, drawingRows, cfg, dash, groups] = await Promise.all([
      fetchAll<Department>('/production/departments/'),
      fetchAll<Station>('/production/stations/'),
      fetchAll<StationAssignment>('/production/station-users/'),
      api.get('/auth/users/').then((res) => (Array.isArray(res.data) ? res.data : res.data?.results || [])).catch(() => []),
      fetchAll<Device>('/production/devices/'),
      fetchAll<Tablet>('/production/tablets/').catch(() => []),
      fetchAll<ShiftSchedule>('/production/shift-schedules/').catch(() => []),
      fetchAll<ShiftBreak>('/production/shift-breaks/').catch(() => []),
      fetchAll<OperatorProfile>('/production/operator-profiles/').catch(() => []),
      fetchAll<StationAlert>('/production/station-alerts/').catch(() => []),
      fetchAll<DeviceMap>('/production/device-maps/'),
      fetchAll<DataField>('/production/data-fields/'),
      fetchAll<RouteTemplate>('/production/routes/'),
      fetchAll<RuleSet>('/production/rules/'),
      fetchAll<TemplatePreset>('/production/template-presets/'),
      fetchAll<ProductionReportTemplate>('/production/report-templates/').catch(() => []),
      fetchAll<ProductRecipe>('/product-recipes/').catch(() => []),
      fetchAll<WarehouseLocation>('/inventory-locations/'),
      fetchAll<ProductLite>('/products/').catch(() => []),
      fetchAll<DrawingFolder>('/technical-drawing-folders/').catch(() => []),
      fetchAll<TechnicalDrawing>('/product-technical-drawings/?active=true').catch(() => []),
      api.get('/production/settings/').then((res) => res.data),
      api.get('/production/reports/summary/').then((res) => res.data).catch(() => ({})),
      fetchAll<UserGroup>('/user-groups/').catch(() => []),
    ])
    setDepartments(d)
    setStations(s)
    setStationAssignments(assignmentRows)
    setUsers(userRows)
    setDevices(dev)
    setTablets(tabletRows)
    setShiftSchedules(shiftRows)
    setShiftBreaks(breakRows)
    setOperatorProfiles(profileRows)
    setAlerts(alertRows)
    setDeviceMaps(maps)
    setDataFields(fields)
    setUserGroups(groups)
    setRoutes(r)
    setRules(ruleRows)
    setPresets(presetRows)
    setReportTemplates(reportTemplateRows)
    setRecipes(recipeRows)
    setLocations(l)
    setProducts(productRows)
    setDrawingFolders(folderRows)
    setDrawings(drawingRows)
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

  const filteredDrawings = useMemo(() => {
    const q = drawingSearch.trim().toLowerCase()
    if (!q) return drawings
    return drawings.filter((drawing) => [
      asText(drawing.product_sku),
      asText(drawing.product_name),
      asText(drawing.title),
      asText(drawing.folder_name),
      asText(drawing.description),
      asText(drawing.tags),
    ].join(' ').toLowerCase().includes(q))
  }, [drawings, drawingSearch])

  const recipeProducts = useMemo(() => {
    return products.filter((p) => !p.product_type || p.product_type === 'finished' || p.product_type === 'semi_finished')
  }, [products])

  const selectedRecipe = useMemo(() => {
    if (!selectedProductId) return undefined
    return recipes.find((recipe) => String(recipe.product) === String(selectedProductId))
  }, [recipes, selectedProductId])


  const saveSettings = async () => {
    await api.patch('/production/settings/', settings)
    toast({ title: 'İmalat ayarları kaydedildi' })
    await load()
  }

  const createDrawingFolder = async () => {
    const name = drawingFolderDraft.trim()
    if (!name) return
    await api.post('/technical-drawing-folders/', { name, order: drawingFolders.length })
    setDrawingFolderDraft('')
    toast({ title: 'Teknik resim klasörü oluşturuldu' })
    await load()
  }

  const uploadTechnicalDrawing = async () => {
    const file = drawingFileRef.current?.files?.[0]
    if (!drawingDraft.product || !file) {
      toast({ title: 'Ürün ve PNG/JPG dosyası seçin', variant: 'destructive' })
      return
    }
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    if (!['png', 'jpg', 'jpeg'].includes(extension)) {
      toast({ title: 'Teknik resim yalnız PNG veya JPG olabilir', variant: 'destructive' })
      return
    }
    const form = new FormData()
    form.append('product', drawingDraft.product)
    if (drawingDraft.folder !== 'none') form.append('folder', drawingDraft.folder)
    form.append('title', drawingDraft.title || file.name)
    form.append('version', drawingDraft.version)
    form.append('tags', drawingDraft.tags)
    form.append('description', drawingDraft.description)
    form.append('is_active', String(drawingDraft.is_active))
    form.append('file', file)
    await api.post('/product-technical-drawings/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (drawingFileRef.current) drawingFileRef.current.value = ''
    setDrawingDraft(emptyDrawingDraft())
    toast({ title: 'Teknik resim yüklendi' })
    await load()
  }

  const deleteDrawing = async (drawing: TechnicalDrawing) => {
    await deleteItem(`/product-technical-drawings/${drawing.id}/`, asText(drawing.title, 'Teknik resim'))
  }

  const resetReportTemplateForm = () => {
    setEditingReportTemplateId(null)
    setReportTemplateDraft({ name: '', key: '', default_format: 'pdf', description: '', is_active: true })
    if (reportTemplateFileRef.current) reportTemplateFileRef.current.value = ''
  }

  const editReportTemplate = (template: ProductionReportTemplate) => {
    setEditingReportTemplateId(template.id)
    setReportTemplateDraft({
      name: template.name || '',
      key: template.key || '',
      default_format: template.default_format || 'pdf',
      description: template.description || '',
      is_active: template.is_active,
    })
    if (reportTemplateFileRef.current) reportTemplateFileRef.current.value = ''
  }

  const saveReportTemplate = async () => {
    const file = reportTemplateFileRef.current?.files?.[0]
    if (!editingReportTemplateId && !file) {
      toast({ title: 'Excel şablonu seçin', variant: 'destructive' })
      return
    }
    if (file && !/\.(xlsx|xltx)$/i.test(file.name)) {
      toast({ title: 'Yalnızca .xlsx veya .xltx yükleyebilirsiniz', variant: 'destructive' })
      return
    }
    const form = new FormData()
    form.append('name', reportTemplateDraft.name)
    form.append('key', reportTemplateDraft.key || reportTemplateDraft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    form.append('default_format', reportTemplateDraft.default_format)
    form.append('description', reportTemplateDraft.description)
    form.append('is_active', String(reportTemplateDraft.is_active))
    if (file) form.append('file', file)
    if (editingReportTemplateId) await api.patch(`/production/report-templates/${editingReportTemplateId}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    else await api.post('/production/report-templates/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    toast({ title: editingReportTemplateId ? 'Rapor şablonu güncellendi' : 'Rapor şablonu yüklendi' })
    resetReportTemplateForm()
    await load()
  }

  const initializeRecipeForProduct = async (productId: string | number) => {
    if (!productId) return
    const payload = {
      product: Number(productId),
      version: 'v1',
      description: 'Ürün reçetesi',
      status: 'published',
    }
    const response = await api.post('/product-recipes/', payload)
    const newRecipeId = response.data.id
    await api.post(`/product-recipes/${newRecipeId}/publish/`)
    toast({ title: 'Ürün reçetesi oluşturuldu' })
    setSelectedProductId(String(productId))
    await load()
  }

  const openStockInForProduct = async (productId: string | number, initialLocationId?: number | null) => {
    const product = products.find((p) => String(p.id) === String(productId))
    if (!product) return

    const details = Object.values(product.attribute_values || {}).filter((value) => value != null && String(value).trim())
    const defaultD1 = String(product.template_defaults?.primary || details[0] || '')
    const defaultD2 = String(product.template_defaults?.secondary || details[1] || '')

    setStockInForm({
      product_id: String(productId),
      location_id: initialLocationId ? String(initialLocationId) : '',
      quantity: '',
      detail_1_override: defaultD1,
      detail_2_override: defaultD2,
      reference: 'ÜRETİM GİRİŞİ',
      note: 'Hammadde hızlı girişi',
    })

    setStockInOpen(true)
    setIsLoadingStocks(true)
    try {
      const response = await api.get('/warehouse-stocks/', { params: { product: productId } })
      setTargetProductStocks(response.data || [])
      if (!initialLocationId && response.data && response.data.length > 0) {
        setStockInForm((prev) => ({
          ...prev,
          location_id: String(response.data[0].location),
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingStocks(false)
    }
  }

  const submitStockIn = async () => {
    if (!stockInForm.product_id || !stockInForm.location_id || !stockInForm.quantity) {
      toast({ title: 'Lütfen ürün, raf ve miktar alanlarını doldurun', variant: 'destructive' })
      return
    }
    try {
      await api.post('/warehouse-stocks/stock-in/', {
        product_id: Number(stockInForm.product_id),
        location_id: Number(stockInForm.location_id),
        quantity: stockInForm.quantity,
        detail_1_override: stockInForm.detail_1_override,
        detail_2_override: stockInForm.detail_2_override,
        reference: stockInForm.reference,
        note: stockInForm.note,
      })
      setStockInOpen(false)
      toast({ title: 'Hammadde girişi başarıyla yapıldı' })
      await load()
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Hammadde girişi tamamlanamadı'
      toast({ title: 'Hammadde girişi başarısız', description: msg, variant: 'destructive' })
    }
  }

  const saveRecipeOperation = async () => {
    const recipeId = selectedRecipe?.id
    if (!recipeId || !operationDraft.station) return
    await api.post('/product-recipe-operations/', {
      recipe: recipeId,
      station: Number(operationDraft.station),
      order: Number(operationDraft.order || 0),
      name: operationDraft.name,
      description: operationDraft.description,
    })
    setOperationDraft({ station: '', order: '0', name: '', description: '' })
    toast({ title: 'Reçete operasyonu eklendi' })
    await load()
  }

  const saveRecipeMaterial = async () => {
    if (!materialDraft.operation || !materialDraft.material_product) return
    let conditions: Record<string, any> = {}
    if (materialDraft.conditions.trim()) {
      try {
        conditions = JSON.parse(materialDraft.conditions)
      } catch {
        toast({ title: 'Koşul JSON formatında olmalı', variant: 'destructive' })
        return
      }
    }
    await api.post('/product-recipe-materials/', {
      operation: Number(materialDraft.operation),
      material_product: Number(materialDraft.material_product),
      unit: materialDraft.unit || 'Adet',
      quantity_type: materialDraft.quantity_type,
      quantity_per_unit: materialDraft.quantity_per_unit || 0,
      formula: materialDraft.formula,
      scrap_percent: materialDraft.scrap_percent || 0,
      conditions,
      default_location: materialDraft.default_location === 'none' ? null : Number(materialDraft.default_location),
      note: materialDraft.note,
      is_active: true,
      order: 0,
    })
    setMaterialDraft({ operation: materialDraft.operation, material_product: '', quantity_type: 'fixed', quantity_per_unit: '1', formula: '', unit: 'Adet', scrap_percent: '0', default_location: 'none', conditions: '', note: '' })
    toast({ title: 'Reçete ham maddesi eklendi' })
    await load()
  }

  const resetDepartmentForm = () => {
    setEditingDepartmentId(null)
    setDepartmentDraft(emptyDepartmentDraft())
  }

  const resetStationForm = () => {
    setEditingStationId(null)
    setStationDraft(emptyStationDraft())
  }

  const resetDeviceForm = () => {
    setEditingDeviceId(null)
    setDeviceDraft(emptyDeviceDraft())
  }

  const resetTabletForm = () => {
    setEditingTabletId(null)
    setTabletDraft(emptyTabletDraft())
  }

  const resetShiftForm = (department = shiftDraft.department) => {
    setEditingShiftId(null)
    setShiftDraft(emptyShiftDraft(department))
  }

  const resetBreakForm = (department = breakDraft.department) => {
    setEditingBreakId(null)
    setBreakDraft(emptyBreakDraft(department))
  }

  const resetMapForm = () => {
    setEditingMapId(null)
    setMapDraft({ device: '', source_path: '$.', target_key: '', target_type: 'text', is_required: false })
  }

  const resetFieldForm = () => {
    setEditingFieldId(null)
    setFieldDraft({ station: 'global', key: '', label: '', field_type: 'text', source: 'manual' })
  }

  const resetRouteForm = () => {
    setEditingRouteId(null)
    setRouteDraft({ name: '', product_group_key: '', station_ids: [], parallel_station_ids: [] })
  }

  const resetRuleForm = () => {
    setEditingRuleId(null)
    setRuleDraft({ name: '', scope: 'station', station: 'none', route: 'none', trigger_event: 'pi_event' })
  }

  const saveDepartment = async () => {
    const payload = { 
      ...departmentDraft, 
      notification_group: departmentDraft.notification_group ? Number(departmentDraft.notification_group) : null,
      order: editingDepartmentId ? departments.find((item) => item.id === editingDepartmentId)?.order ?? departments.length : departments.length 
    }
    if (editingDepartmentId) await api.patch(`/production/departments/${editingDepartmentId}/`, payload)
    else await api.post('/production/departments/', payload)
    resetDepartmentForm()
    toast({ title: editingDepartmentId ? 'Bölüm güncellendi' : 'Bölüm oluşturuldu' })
    await load()
  }

  const saveStation = async () => {
    const payload = {
      ...stationDraft,
      department: Number(stationDraft.department),
      max_workers: Number(stationDraft.max_workers || 1),
      default_daily_target: stationDraft.default_daily_target || 0,
      order: editingStationId ? stations.find((item) => item.id === editingStationId)?.order ?? 0 : stations.filter((item) => String(item.department) === stationDraft.department).length,
    }
    if (editingStationId) await api.patch(`/production/stations/${editingStationId}/`, payload)
    else await api.post('/production/stations/', payload)
    resetStationForm()
    toast({ title: editingStationId ? 'İstasyon güncellendi' : 'İstasyon oluşturuldu' })
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
    const payload = {
      name: routeDraft.name,
      product_group_key: routeDraft.product_group_key,
      step_inputs: routeDraft.station_ids.map((stationId, order) => ({
        station: Number(stationId),
        order,
        is_required: true,
        start_policy: routeDraft.parallel_station_ids.includes(stationId) ? 'parallel' : 'after_previous',
      })),
    }
    if (editingRouteId) await api.patch(`/production/routes/${editingRouteId}/`, payload)
    else await api.post('/production/routes/', payload)
    resetRouteForm()
    toast({ title: editingRouteId ? 'Rota güncellendi' : 'Rota oluşturuldu' })
    await load()
  }

  const saveDevice = async () => {
    const payload = { station: Number(deviceDraft.station), name: deviceDraft.name, is_active: deviceDraft.is_active }
    if (editingDeviceId) await api.patch(`/production/devices/${editingDeviceId}/`, payload)
    else await api.post('/production/devices/', payload)
    resetDeviceForm()
    toast({ title: editingDeviceId ? 'Cihaz güncellendi' : 'Cihaz oluşturuldu' })
    await load()
  }

  const saveTablet = async () => {
    const payload = { station: Number(tabletDraft.station), name: tabletDraft.name, is_active: tabletDraft.is_active }
    if (editingTabletId) await api.patch(`/production/tablets/${editingTabletId}/`, payload)
    else await api.post('/production/tablets/', payload)
    resetTabletForm()
    toast({ title: editingTabletId ? 'İstasyon tableti güncellendi' : 'İstasyon tableti oluşturuldu' })
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

  const saveShiftSchedule = async () => {
    const payload = {
      ...shiftDraft,
      department: Number(shiftDraft.department),
      order: editingShiftId ? shiftSchedules.find((item) => item.id === editingShiftId)?.order ?? 0 : shiftSchedules.filter((item) => String(item.department) === shiftDraft.department).length,
    }
    if (editingShiftId) await api.patch(`/production/shift-schedules/${editingShiftId}/`, payload)
    else await api.post('/production/shift-schedules/', payload)
    resetShiftForm(shiftDraft.department)
    toast({ title: editingShiftId ? 'Vardiya güncellendi' : 'Vardiya kaydedildi' })
    await load()
  }

  const saveShiftBreak = async () => {
    const payload = {
      ...breakDraft,
      department: Number(breakDraft.department),
      schedule: breakDraft.schedule === 'none' ? null : Number(breakDraft.schedule),
      order: editingBreakId ? shiftBreaks.find((item) => item.id === editingBreakId)?.order ?? 0 : shiftBreaks.filter((item) => String(item.department) === breakDraft.department).length,
    }
    if (editingBreakId) await api.patch(`/production/shift-breaks/${editingBreakId}/`, payload)
    else await api.post('/production/shift-breaks/', payload)
    resetBreakForm(breakDraft.department)
    toast({ title: editingBreakId ? 'Özel mola güncellendi' : 'Özel mola kaydedildi' })
    await load()
  }

  const editDepartment = (department: Department) => {
    setEditingDepartmentId(department.id)
    setDepartmentDraft({
      code: department.code,
      name: department.name,
      color: department.color || '#2563eb',
      notification_group: department.notification_group ? String(department.notification_group) : '',
      is_active: department.is_active,
    })
  }

  const editStation = (station: Station) => {
    setEditingStationId(station.id)
    setStationDraft({
      department: String(station.department),
      code: station.code,
      name: station.name,
      max_workers: String(station.max_workers || 1),
      default_daily_target: station.default_daily_target ? String(station.default_daily_target) : '',
      is_handover: station.is_handover,
      is_final: station.is_final,
      is_active: station.is_active,
    })
  }

  const editDevice = (device: Device) => {
    setEditingDeviceId(device.id)
    setDeviceDraft({
      station: String(device.station),
      name: device.name,
      is_active: device.is_active,
    })
  }

  const editTablet = (tablet: Tablet) => {
    setEditingTabletId(tablet.id)
    setTabletDraft({
      station: String(tablet.station),
      name: tablet.name,
      is_active: tablet.is_active,
    })
  }

  const editShiftSchedule = (shift: ShiftSchedule) => {
    setEditingShiftId(shift.id)
    setShiftDraft({
      department: String(shift.department),
      name: shift.name,
      weekdays: shift.weekdays || [],
      start_time: shortTime(shift.start_time) || '08:00',
      end_time: shortTime(shift.end_time) || '18:00',
      crosses_midnight: shift.crosses_midnight,
      is_active: shift.is_active,
      note: shift.note || '',
    })
  }

  const editShiftBreak = (item: ShiftBreak) => {
    setEditingBreakId(item.id)
    setBreakDraft({
      department: String(item.department),
      schedule: item.schedule ? String(item.schedule) : 'none',
      name: item.name,
      start_time: shortTime(item.start_time) || '12:00',
      end_time: shortTime(item.end_time) || '13:00',
      requires_checkpoint: item.requires_checkpoint,
      lock_type: item.lock_type || 'break_locked',
      is_active: item.is_active,
      note: item.note || '',
    })
  }

  const editDeviceMap = (item: DeviceMap) => {
    setEditingMapId(item.id)
    setMapDraft({
      device: String(item.device),
      source_path: item.source_path,
      target_key: item.target_key,
      target_type: item.target_type,
      is_required: item.is_required,
    })
  }

  const editDataField = (field: DataField) => {
    setEditingFieldId(field.id)
    setFieldDraft({
      station: field.station ? String(field.station) : 'global',
      key: field.key,
      label: field.label,
      field_type: field.field_type,
      source: field.source,
    })
  }

  const editRoute = (route: RouteTemplate) => {
    const steps = route.steps || []
    setEditingRouteId(route.id)
    setRouteDraft({
      name: route.name,
      product_group_key: route.product_group_key || '',
      station_ids: steps.map((step) => String(step.station)),
      parallel_station_ids: steps.filter((step) => step.start_policy === 'parallel').map((step) => String(step.station)),
    })
  }

  const editRule = (rule: RuleSet) => {
    setEditingRuleId(rule.id)
    setRuleDraft({
      name: rule.name,
      scope: rule.scope,
      station: rule.station ? String(rule.station) : 'none',
      route: rule.route ? String(rule.route) : 'none',
      trigger_event: rule.trigger_event,
    })
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

  const handleManagerAck = async (alertId: number) => {
    try {
      await api.post(`/production/station-alerts/${alertId}/ack/`, {})
      toast({ title: 'Bildirim onaylandı' })
      await load()
    } catch (err: any) {
      toast({
        title: 'Onaylama başarısız',
        description: err.response?.data?.detail || 'Bilinmeyen bir hata oluştu.',
        variant: 'destructive',
      })
    }
  }

  const createMap = async () => {
    const device = devices.find((item) => String(item.id) === mapDraft.device)
    const payload = {
      ...mapDraft,
      device: Number(mapDraft.device),
      station: device?.station || null,
      order: editingMapId ? deviceMaps.find((item) => item.id === editingMapId)?.order ?? 0 : deviceMaps.length,
    }
    if (editingMapId) await api.patch(`/production/device-maps/${editingMapId}/`, payload)
    else await api.post('/production/device-maps/', payload)
    resetMapForm()
    toast({ title: editingMapId ? 'Veri eşlemesi güncellendi' : 'Veri eşlemesi oluşturuldu' })
    await load()
  }

  const createField = async () => {
    const payload = {
      ...fieldDraft,
      station: fieldDraft.station === 'global' ? null : Number(fieldDraft.station),
      order: editingFieldId ? dataFields.find((item) => item.id === editingFieldId)?.order ?? 0 : dataFields.length,
    }
    if (editingFieldId) await api.patch(`/production/data-fields/${editingFieldId}/`, payload)
    else await api.post('/production/data-fields/', payload)
    resetFieldForm()
    toast({ title: editingFieldId ? 'Veri alanı güncellendi' : 'Veri alanı oluşturuldu' })
    await load()
  }

  const createRule = async () => {
    const payload = {
      name: ruleDraft.name,
      scope: ruleDraft.scope,
      station: ruleDraft.station === 'none' ? null : Number(ruleDraft.station),
      route: ruleDraft.route === 'none' ? null : Number(ruleDraft.route),
      trigger_event: ruleDraft.trigger_event,
      order: editingRuleId ? rules.find((item) => item.id === editingRuleId)?.order ?? 0 : rules.length,
    }
    if (editingRuleId) await api.patch(`/production/rules/${editingRuleId}/`, payload)
    else await api.post('/production/rules/', payload)
    resetRuleForm()
    toast({ title: editingRuleId ? 'Kural seti güncellendi' : 'Kural seti oluşturuldu' })
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
        <CardHeader>
          <CardTitle>İstasyon hedefleri</CardTitle>
          <p className="text-sm text-muted-foreground">
            Varsayılan hedef istasyon kartından belirlenir. Buradan seçilen güne özel hedef girerseniz yalnız o gün varsayılanın yerine geçer.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Select value={targetDraft.station} onValueChange={(value) => setTargetDraft((current) => {
              const existing = stationTargets.find((item) => String(item.station) === value && item.target_date === current.target_date)
              const station = stations.find((item) => String(item.id) === value)
              return { ...current, station: value, target_quantity: existing ? String(existing.target_quantity) : station?.default_daily_target ? String(station.default_daily_target) : '', note: existing?.note || '' }
            })}>
              <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
              <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={targetDraft.target_date} onChange={(e) => setTargetDraft((current) => ({ ...current, target_date: e.target.value }))} />
            <Input placeholder="O güne özel hedef adet" inputMode="decimal" value={targetDraft.target_quantity} onChange={(e) => setTargetDraft((current) => ({ ...current, target_quantity: e.target.value }))} />
            <Input placeholder="Not" value={targetDraft.note} onChange={(e) => setTargetDraft((current) => ({ ...current, note: e.target.value }))} />
            <Button onClick={saveStationTarget} disabled={!targetDraft.station || !targetDraft.target_date}>
              <Save className="mr-2 h-4 w-4" /> Hedefi kaydet
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {stations.map((station) => {
              const target = stationTargets.find((item) => item.station === station.id)
              const effectiveTarget = target?.target_quantity ?? station.default_daily_target ?? 0
              return (
                <button
                  key={station.id}
                  className="rounded-lg border bg-muted/10 p-3 text-left hover:bg-muted/30"
                  onClick={() => setTargetDraft({
                    station: String(station.id),
                    target_date: target?.target_date || targetDraft.target_date,
                    target_quantity: target ? String(target.target_quantity) : station.default_daily_target ? String(station.default_daily_target) : '',
                    note: target?.note || '',
                  })}
                >
                  <p className="font-semibold">{station.code}</p>
                  <p className="text-xs text-muted-foreground">{station.name}</p>
                  <p className="mt-2 text-2xl font-bold">{formatNumber(n(effectiveTarget))}</p>
                  <p className="text-xs text-muted-foreground">{target ? 'Bu güne özel hedef' : 'Varsayılan hedef'}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <PageSubSidebar
        tabs={prodTabs}
        groups={prodGroups}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >

        {activeTab === 'departments' && (
          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <Card>
              <CardHeader><CardTitle>{editingDepartmentId ? 'Bölümü düzenle' : 'Bölüm oluştur'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Kod" value={departmentDraft.code} onChange={(e) => setDepartmentDraft((v) => ({ ...v, code: e.target.value }))} />
                <Input placeholder="Bölüm adı" value={departmentDraft.name} onChange={(e) => setDepartmentDraft((v) => ({ ...v, name: e.target.value }))} />
                <Input type="color" value={departmentDraft.color} onChange={(e) => setDepartmentDraft((v) => ({ ...v, color: e.target.value }))} />
                <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Aktif</span><Switch checked={departmentDraft.is_active} onCheckedChange={(checked) => setDepartmentDraft((v) => ({ ...v, is_active: checked }))} /></label>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Bildirim Grubu (Yöneticiyi Çağır Alıcıları)</label>
                  <Select value={departmentDraft.notification_group} onValueChange={(val) => setDepartmentDraft((v) => ({ ...v, notification_group: val }))}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Grup Seçin (Tüm yöneticilere gitsin)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none_clear">Tüm yöneticilere gitsin (Genel)</SelectItem>
                      {userGroups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveDepartment} disabled={!departmentDraft.code || !departmentDraft.name}>
                    {editingDepartmentId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {editingDepartmentId ? 'Güncelle' : 'Ekle'}
                  </Button>
                  {editingDepartmentId && <Button variant="outline" onClick={resetDepartmentForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                </div>
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
                        {dep.notification_group && (
                          <Badge variant="outline" className="text-[10px]">
                            Alıcı: {userGroups.find((g) => g.id === dep.notification_group)?.title || dep.notification_group}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => editDepartment(dep)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Düzenle
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteItem(`/production/departments/${dep.id}/`, dep.name)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Sil
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {stations.filter((station) => station.department === dep.id).map((station) => (
                        <StationCard
                          key={station.id}
                          station={station}
                          assignments={stationAssignments.filter((item) => item.station === station.id && item.is_active)}
                          onEdit={() => editStation(station)}
                          onDelete={() => deleteItem(`/production/stations/${station.id}/`, station.code)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'stations' && (
          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>{editingStationId ? 'İstasyonu düzenle' : 'İstasyon oluştur'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={stationDraft.department} onValueChange={(value) => setStationDraft((v) => ({ ...v, department: value }))}>
                    <SelectTrigger><SelectValue placeholder="Bölüm seç" /></SelectTrigger>
                    <SelectContent>{departments.map((dep) => <SelectItem key={dep.id} value={String(dep.id)}>{dep.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Kod" value={stationDraft.code} onChange={(e) => setStationDraft((v) => ({ ...v, code: e.target.value }))} />
                  <Input placeholder="İstasyon adı" value={stationDraft.name} onChange={(e) => setStationDraft((v) => ({ ...v, name: e.target.value }))} />
                  <Input placeholder="Eşzamanlı çalışan sınırı" inputMode="numeric" value={stationDraft.max_workers} onChange={(e) => setStationDraft((v) => ({ ...v, max_workers: e.target.value }))} />
                  <Input placeholder="Varsayılan günlük hedef adet" inputMode="decimal" value={stationDraft.default_daily_target} onChange={(e) => setStationDraft((v) => ({ ...v, default_daily_target: e.target.value }))} />
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Devir istasyonu</span><Switch checked={stationDraft.is_handover} onCheckedChange={(checked) => setStationDraft((v) => ({ ...v, is_handover: checked }))} /></label>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Final istasyon</span><Switch checked={stationDraft.is_final} onCheckedChange={(checked) => setStationDraft((v) => ({ ...v, is_final: checked }))} /></label>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Aktif</span><Switch checked={stationDraft.is_active} onCheckedChange={(checked) => setStationDraft((v) => ({ ...v, is_active: checked }))} /></label>
                  <div className="flex gap-2">
                    <Button onClick={saveStation} disabled={!stationDraft.department || !stationDraft.code || !stationDraft.name}>
                      {editingStationId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                      {editingStationId ? 'Güncelle' : 'Ekle'}
                    </Button>
                    {editingStationId && <Button variant="outline" onClick={resetStationForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                  </div>
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
                      {productionUsers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{userLabel(user)}{user.role ? ` · ${user.role}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!productionUsers.length && <p className="text-xs text-muted-foreground">Üretim görüntüleme veya tablet kullanma izni olan kullanıcı yok.</p>}
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
                    onEdit={() => editStation(station)}
                    onDelete={() => deleteItem(`/production/stations/${station.id}/`, station.code)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'tablets' && (
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>{editingTabletId ? 'İstasyon tabletini düzenle' : 'İstasyon tableti oluştur'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={tabletDraft.station} onValueChange={(value) => setTabletDraft((v) => ({ ...v, station: value }))}>
                    <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
                    <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Tablet adı" value={tabletDraft.name} onChange={(e) => setTabletDraft((v) => ({ ...v, name: e.target.value }))} />
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Aktif</span><Switch checked={tabletDraft.is_active} onCheckedChange={(checked) => setTabletDraft((v) => ({ ...v, is_active: checked }))} /></label>
                  <div className="flex gap-2">
                    <Button onClick={saveTablet} disabled={!tabletDraft.station || !tabletDraft.name}>
                      {editingTabletId ? <Save className="mr-2 h-4 w-4" /> : <Monitor className="mr-2 h-4 w-4" />}
                      {editingTabletId ? 'Güncelle' : 'Tablet ekle'}
                    </Button>
                    {editingTabletId && <Button variant="outline" onClick={resetTabletForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Üretim PIN’i</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={pinDraft.user} onValueChange={(value) => setPinDraft((current) => ({ ...current, user: value }))}>
                    <SelectTrigger><SelectValue placeholder="Kullanıcı seç" /></SelectTrigger>
                    <SelectContent>{productionUsers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{userLabel(user)}{user.role ? ` · ${user.role}` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                  {!productionUsers.length && <p className="text-xs text-muted-foreground">PIN verilecek kullanıcı önce üretim yetkisi almalı.</p>}
                  <Input type="text" inputMode="numeric" pattern="[0-9]*" style={{ WebkitTextSecurity: 'disc' } as any} placeholder="Tablet PIN" maxLength={4} value={pinDraft.pin} onChange={(e) => setPinDraft((current) => ({ ...current, pin: e.target.value.replace(/\D/g, '') }))} />
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
                        <div className="flex items-center gap-1">
                          <Badge variant={tablet.is_active ? 'secondary' : 'outline'}>{tablet.is_active ? 'Aktif' : 'Pasif'}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => editTablet(tablet)} title="Tableti düzenle">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/tablets/${tablet.id}/`, tablet.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                  {productionUsers.filter((user) => stationAssignments.some((assignment) => assignment.user === user.id && assignment.is_active)).map((user) => {
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
        )}

        {activeTab === 'shifts' && (
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Vardiya oluştur</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={shiftDraft.department} onValueChange={(value) => setShiftDraft((current) => ({ ...current, department: value }))}>
                    <SelectTrigger><SelectValue placeholder="Bölüm seç" /></SelectTrigger>
                    <SelectContent>{departments.map((dep) => <SelectItem key={dep.id} value={String(dep.id)}>{dep.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Vardiya adı" value={shiftDraft.name} onChange={(e) => setShiftDraft((current) => ({ ...current, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label>Başlangıç</Label>
                      <Input type="time" value={shiftDraft.start_time} onChange={(e) => setShiftDraft((current) => ({ ...current, start_time: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Bitiş</Label>
                      <Input type="time" value={shiftDraft.end_time} onChange={(e) => setShiftDraft((current) => ({ ...current, end_time: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map((label, day) => (
                      <Button
                        key={label}
                        type="button"
                        variant={shiftDraft.weekdays.includes(day) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShiftDraft((current) => ({
                          ...current,
                          weekdays: current.weekdays.includes(day) ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day].sort(),
                        }))}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>Geceye taşar</span>
                    <Switch checked={shiftDraft.crosses_midnight} onCheckedChange={(checked) => setShiftDraft((current) => ({ ...current, crosses_midnight: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>Aktif</span>
                    <Switch checked={shiftDraft.is_active} onCheckedChange={(checked) => setShiftDraft((current) => ({ ...current, is_active: checked }))} />
                  </label>
                  <Textarea placeholder="Not" value={shiftDraft.note} onChange={(e) => setShiftDraft((current) => ({ ...current, note: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button onClick={saveShiftSchedule} disabled={!shiftDraft.department || !shiftDraft.name || !shiftDraft.weekdays.length}>
                      <Save className="mr-2 h-4 w-4" /> {editingShiftId ? 'Vardiyayı güncelle' : 'Vardiyayı kaydet'}
                    </Button>
                    {editingShiftId && <Button variant="outline" onClick={() => resetShiftForm()}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Özel mola oluştur</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={breakDraft.department} onValueChange={(value) => setBreakDraft((current) => ({ ...current, department: value, schedule: 'none' }))}>
                    <SelectTrigger><SelectValue placeholder="Bölüm seç" /></SelectTrigger>
                    <SelectContent>{departments.map((dep) => <SelectItem key={dep.id} value={String(dep.id)}>{dep.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={breakDraft.schedule} onValueChange={(value) => setBreakDraft((current) => ({ ...current, schedule: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bölümdeki tüm vardiyalar</SelectItem>
                      {shiftSchedules.filter((item) => String(item.department) === breakDraft.department).map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Mola adı" value={breakDraft.name} onChange={(e) => setBreakDraft((current) => ({ ...current, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label>Başlangıç</Label>
                      <Input type="time" value={breakDraft.start_time} onChange={(e) => setBreakDraft((current) => ({ ...current, start_time: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Bitiş</Label>
                      <Input type="time" value={breakDraft.end_time} onChange={(e) => setBreakDraft((current) => ({ ...current, end_time: e.target.value }))} />
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>Mola başında üretim miktarı sor</span>
                    <Switch checked={breakDraft.requires_checkpoint} onCheckedChange={(checked) => setBreakDraft((current) => ({ ...current, requires_checkpoint: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>Aktif</span>
                    <Switch checked={breakDraft.is_active} onCheckedChange={(checked) => setBreakDraft((current) => ({ ...current, is_active: checked }))} />
                  </label>
                  <Textarea placeholder="Not" value={breakDraft.note} onChange={(e) => setBreakDraft((current) => ({ ...current, note: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button onClick={saveShiftBreak} disabled={!breakDraft.department || !breakDraft.name}>
                      <TimerReset className="mr-2 h-4 w-4" /> {editingBreakId ? 'Molayı güncelle' : 'Molayı kaydet'}
                    </Button>
                    {editingBreakId && <Button variant="outline" onClick={() => resetBreakForm()}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Departman vardiya planı</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {departments.map((department) => (
                  <div key={department.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: department.color || '#21406d' }} />
                      <h3 className="font-semibold">{department.name}</h3>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {shiftSchedules.filter((item) => item.department === department.id).map((shift) => (
                        <div key={shift.id} className="rounded-md border bg-muted/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{shift.name}</p>
                              <p className="text-sm text-muted-foreground">{shortTime(shift.start_time)} - {shortTime(shift.end_time)}{shift.crosses_midnight ? ' · gece vardiyası' : ''}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{(shift.weekdays || []).map((day) => weekdays[day]).join(', ') || 'Her gün'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={shift.is_active ? 'secondary' : 'outline'}>{shift.is_active ? 'Aktif' : 'Pasif'}</Badge>
                              <Button variant="ghost" size="icon" onClick={() => editShiftSchedule(shift)} title="Vardiyayı düzenle">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/shift-schedules/${shift.id}/`, shift.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {shiftBreaks.filter((item) => item.department === department.id && (!item.schedule || item.schedule === shift.id)).map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
                                <span>{item.name} · {shortTime(item.start_time)}-{shortTime(item.end_time)}{!item.is_active ? ' · pasif' : ''}</span>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editShiftBreak(item)} title="Molayı düzenle">
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem(`/production/shift-breaks/${item.id}/`, item.name)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!shiftSchedules.some((item) => item.department === department.id) && <p className="text-sm text-muted-foreground">Bu bölümde vardiya tanımı yok; tabletler kilitlenmez.</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'alerts' && (
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
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>{alert.severity}</Badge>
                        {alert.requires_ack && (
                          alert.acks && alert.acks.length > 0 ? (
                            <span className="inline-flex items-center text-[10px] text-emerald-600 font-bold dark:text-emerald-400 gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="h-3 w-3" /> Onaylandı ({alert.acks[0].user_name || alert.acks[0].tablet_name})
                            </span>
                          ) : (
                            <Button 
                              size="sm"
                              variant="outline" 
                              onClick={() => handleManagerAck(alert.id)}
                              className="h-7 border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs px-2 py-0 font-semibold gap-1"
                            >
                              <Volume2 className="h-3.5 w-3.5" /> Okudum / Onayla
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Hedef: {alert.station_code || alert.department_name || alert.work_order_number || alert.target_type} · Okundu: {alert.acks?.length || 0}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'recipes' && (
          <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ürün Reçetesi Seçimi</CardTitle>
                  <p className="text-sm text-muted-foreground">Reçetesini düzenlemek veya oluşturmak istediğiniz mamülü seçin.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedProductId} onValueChange={(value) => setSelectedProductId(value)}>
                    <SelectTrigger><SelectValue placeholder="Mamül / yarı mamül seçin" /></SelectTrigger>
                    <SelectContent>
                      {recipeProducts.map((product) => (
                        <SelectItem key={String(product.id)} value={String(product.id)}>{asText(product.sku, 'Kodsuz')} - {asText(product.name, 'Ürün')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mevcut Reçeteler</CardTitle>
                  <p className="text-sm text-muted-foreground">Sistemde tanımlı reçetesi bulunan mamüller.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      className={`w-full rounded-lg border p-3 text-left hover:bg-muted/30 ${selectedProductId === String(recipe.product) ? 'bg-muted/30 border-primary' : ''}`}
                      onClick={() => setSelectedProductId(String(recipe.product))}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{asText(recipe.product_sku, 'Kodsuz')} · {asText(recipe.product_name, 'Ürün')}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!recipes.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Henüz tanımlı ürün reçetesi yok.</p>}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Reçete İçeriği (Operasyonlar ve Hammaddeler)</CardTitle>
                    {selectedRecipe && (
                      <p className="text-sm text-muted-foreground font-semibold text-primary mt-1">
                        {asText(selectedRecipe.product_sku, 'Kodsuz')} · {asText(selectedRecipe.product_name, 'Ürün')}
                      </p>
                    )}
                  </div>
                  {selectedRecipe && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openStockInForProduct(selectedRecipe.product)}>
                        <Plus className="mr-2 h-4 w-4" /> Hammadde Girişi Yap
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={async () => {
                        await deleteItem(`/product-recipes/${selectedRecipe.id}/`, `${selectedRecipe.product_sku} reçetesi`);
                        setSelectedProductId('');
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" /> Reçeteyi Sil
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedProductId && !selectedRecipe ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-muted/5">
                    <div className="p-3 mb-3 rounded-full bg-primary/10 text-primary">
                      <Plus className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-lg">Bu ürünün henüz bir reçetesi bulunmuyor</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                      Bu mamül için operasyonları ve kullanılacak malzemeleri tanımlamaya başlamak için hemen bir reçete oluşturun.
                    </p>
                    <Button onClick={() => initializeRecipeForProduct(selectedProductId)}>
                      Reçete Tanımla
                    </Button>
                  </div>
                ) : selectedRecipe ? (
                  <>
                    <div className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1fr_110px_1fr_auto]">
                      <Select value={operationDraft.station} onValueChange={(value) => setOperationDraft((current) => ({ ...current, station: value }))}>
                        <SelectTrigger><SelectValue placeholder="İstasyon / operasyon seç" /></SelectTrigger>
                        <SelectContent>
                          {stations.map((station) => (
                            <SelectItem key={station.id} value={String(station.id)}>{station.code} - {station.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Sıra" value={operationDraft.order} onChange={(event) => setOperationDraft((current) => ({ ...current, order: event.target.value }))} />
                      <Input placeholder="Operasyon adı (opsiyonel)" value={operationDraft.name} onChange={(event) => setOperationDraft((current) => ({ ...current, name: event.target.value }))} />
                      <Button onClick={saveRecipeOperation} disabled={!operationDraft.station}>
                        <Plus className="mr-2 h-4 w-4" /> Operasyon
                      </Button>
                    </div>

                    <div className="grid gap-2 rounded-lg border p-3 xl:grid-cols-[1fr_1fr_100px_120px_100px_1fr]">
                      <Select value={materialDraft.operation} onValueChange={(value) => setMaterialDraft((current) => ({ ...current, operation: value }))}>
                        <SelectTrigger><SelectValue placeholder="Operasyon" /></SelectTrigger>
                        <SelectContent>
                          {(selectedRecipe.operations || []).map((operation) => (
                            <SelectItem key={operation.id} value={String(operation.id)}>{operation.station_code} - {operation.name || operation.station_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={materialDraft.material_product} onValueChange={(value) => setMaterialDraft((current) => ({ ...current, material_product: value }))}>
                        <SelectTrigger><SelectValue placeholder="Ham madde ürünü" /></SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={String(product.id)} value={String(product.id)}>{asText(product.sku, 'Kodsuz')} - {asText(product.name, 'Ürün')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={materialDraft.quantity_type} onValueChange={(value) => setMaterialDraft((current) => ({ ...current, quantity_type: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Sabit</SelectItem>
                          <SelectItem value="formula">Formül</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Miktar" value={materialDraft.quantity_per_unit} onChange={(event) => setMaterialDraft((current) => ({ ...current, quantity_per_unit: event.target.value }))} />
                      <Input placeholder="Birim" value={materialDraft.unit} onChange={(event) => setMaterialDraft((current) => ({ ...current, unit: event.target.value }))} />
                      <Select value={materialDraft.default_location} onValueChange={(value) => setMaterialDraft((current) => ({ ...current, default_location: value }))}>
                        <SelectTrigger><SelectValue placeholder="Depo / raf" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Depo/raf seç</SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={String(location.id)}>{location.warehouse_name || 'Depo'} / {location.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Formül: adet * 2" value={materialDraft.formula} onChange={(event) => setMaterialDraft((current) => ({ ...current, formula: event.target.value }))} />
                      <Input placeholder="Fire %" value={materialDraft.scrap_percent} onChange={(event) => setMaterialDraft((current) => ({ ...current, scrap_percent: event.target.value }))} />
                      <Input placeholder='Koşul JSON: {"field":"detay2","operator":"contains","value":"Kırmızı"}' className="xl:col-span-2" value={materialDraft.conditions} onChange={(event) => setMaterialDraft((current) => ({ ...current, conditions: event.target.value }))} />
                      <Input placeholder="Not" className="xl:col-span-2" value={materialDraft.note} onChange={(event) => setMaterialDraft((current) => ({ ...current, note: event.target.value }))} />
                      <Button onClick={saveRecipeMaterial} disabled={!materialDraft.operation || !materialDraft.material_product}>
                        <Plus className="mr-2 h-4 w-4" /> Ham madde
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {(selectedRecipe.operations || []).map((operation) => (
                        <div key={operation.id} className="rounded-lg border bg-muted/10 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{operation.station_code} · {operation.name || operation.station_name}</p>
                              <p className="text-xs text-muted-foreground">{operation.department_name} · Sıra {operation.order}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/product-recipe-operations/${operation.id}/`, operation.station_code || 'Operasyon')}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                              <thead className="text-xs uppercase text-muted-foreground">
                                <tr className="border-b">
                                  <th className="py-2 text-left">Ham madde</th>
                                  <th className="py-2 text-left">Miktar</th>
                                  <th className="py-2 text-left">Fire</th>
                                  <th className="py-2 text-left">Depo / Raf</th>
                                  <th className="py-2 text-left">Stok (Raf / Toplam)</th>
                                  <th className="py-2 text-left">Koşul</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {(operation.materials || []).map((material) => (
                                  <tr key={material.id} className="border-b last:border-0">
                                    <td className="py-2">{material.material_sku} · {material.material_name}</td>
                                    <td className="py-2">{material.quantity_type === 'formula' ? material.formula : `${formatNumber(n(material.quantity_per_unit))} ${material.unit}`}</td>
                                    <td className="py-2">%{formatNumber(n(material.scrap_percent))}</td>
                                    <td className="py-2">{material.default_location_label || '-'}</td>
                                    <td className="py-2">
                                      {material.default_location ? (
                                        <span className={n(material.location_stock) <= 0 ? "text-destructive font-medium" : "text-muted-foreground font-medium"}>
                                          {formatNumber(n(material.location_stock))} / {formatNumber(n(material.total_stock))} {material.unit}
                                        </span>
                                      ) : (
                                        <span className={n(material.total_stock) <= 0 ? "text-destructive font-medium" : "text-muted-foreground font-medium"}>
                                          - / {formatNumber(n(material.total_stock))} {material.unit}
                                        </span>
                                      )}
                                    </td>
                                    <td className="max-w-[220px] truncate py-2">{Object.keys(material.conditions || {}).length ? JSON.stringify(material.conditions) : '-'}</td>
                                    <td className="py-2 text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button variant="outline" size="sm" className="h-8 text-primary border-primary/20 hover:bg-primary/5" onClick={() => openStockInForProduct(material.material_product, material.default_location)}>
                                          <Plus className="mr-1 h-3.5 w-3.5" /> Giriş Yap
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/product-recipe-materials/${material.id}/`, material.material_sku || 'Ham madde')}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {!(operation.materials || []).length && (
                                  <tr><td colSpan={7} className="py-3 text-sm text-muted-foreground">Bu operasyona bağlı ham madde yok.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {!(selectedRecipe.operations || []).length && (
                        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Önce bu reçeteye istasyon/operasyon ekleyin.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center p-12 text-center text-muted-foreground">
                    Lütfen reçete düzenlemek veya oluşturmak için sol taraftan bir ürün seçin.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'drawings' && (
          <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Teknik resim yükle</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={drawingDraft.product} onValueChange={(value) => setDrawingDraft((current) => ({ ...current, product: value }))}>
                    <SelectTrigger><SelectValue placeholder="Ürün seç" /></SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={String(product.id)} value={String(product.id)}>
                          {asText(product.sku, 'Kodsuz')} - {asText(product.name, 'Ürün')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={drawingDraft.folder} onValueChange={(value) => setDrawingDraft((current) => ({ ...current, folder: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Genel klasör</SelectItem>
                      {drawingFolders.map((folder) => (
                        <SelectItem key={folder.id} value={String(folder.id)}>{folder.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Başlık" value={drawingDraft.title} onChange={(event) => setDrawingDraft((current) => ({ ...current, title: event.target.value }))} />
                  <Input placeholder="Versiyon / revizyon" value={drawingDraft.version} onChange={(event) => setDrawingDraft((current) => ({ ...current, version: event.target.value }))} />
                  <Input placeholder="Etiketler: pres, montaj, kanat..." value={drawingDraft.tags} onChange={(event) => setDrawingDraft((current) => ({ ...current, tags: event.target.value }))} />
                  <Textarea placeholder="Açıklama" value={drawingDraft.description} onChange={(event) => setDrawingDraft((current) => ({ ...current, description: event.target.value }))} />
                  <input ref={drawingFileRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="block w-full rounded-md border p-2 text-sm" />
                  <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>Aktif</span>
                    <Switch checked={drawingDraft.is_active} onCheckedChange={(checked) => setDrawingDraft((current) => ({ ...current, is_active: checked }))} />
                  </label>
                  <Button onClick={uploadTechnicalDrawing} disabled={!drawingDraft.product}>
                    <Upload className="mr-2 h-4 w-4" /> PNG/JPG yükle
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Klasör oluştur</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Klasör adı" value={drawingFolderDraft} onChange={(event) => setDrawingFolderDraft(event.target.value)} />
                  <Button variant="outline" onClick={createDrawingFolder} disabled={!drawingFolderDraft.trim()}>
                    <Plus className="mr-2 h-4 w-4" /> Klasör ekle
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {drawingFolders.map((folder) => (
                      <Badge key={folder.id} variant="outline">{folder.name} · {folder.drawing_count || 0}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Ürün teknik resimleri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={drawingSearch} onChange={(event) => setDrawingSearch(event.target.value)} placeholder="Ürün kodu, ürün adı, başlık, klasör veya etiket ara" />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredDrawings.map((drawing) => (
                    <div key={drawing.id} className="rounded-lg border bg-muted/10 p-3">
                      <button
                        type="button"
                        className="mb-3 flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border bg-background"
                        onClick={() => window.open(drawingUrl(drawing), '_blank', 'noopener,noreferrer')}
                      >
                        {drawingUrl(drawing) ? (
                          <img src={drawingUrl(drawing)} alt={asText(drawing.title, 'Teknik resim')} className="h-full w-full object-contain" />
                        ) : (
                          <FileImage className="h-10 w-10 text-muted-foreground" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{asText(drawing.product_sku, 'Kodsuz')} · {asText(drawing.title, 'Teknik resim')}</p>
                        <p className="truncate text-xs text-muted-foreground">{asText(drawing.product_name, 'Ürün')} · {asText(drawing.folder_name, 'Genel')}</p>
                        {drawing.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{asText(drawing.description)}</p> : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <TechnicalDrawingButton drawings={[drawing]} compact />
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDrawing(drawing)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!filteredDrawings.length && (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                      Teknik resim bulunamadı. Ürün seçip PNG/JPG yükleyin; tablet ve iş emri ekranlarında otomatik görünür.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'report-templates' && (
          <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
            <Card>
              <CardHeader><CardTitle>{editingReportTemplateId ? 'Rapor şablonunu düzenle' : 'Rapor şablonu yükle'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Şablon adı" value={reportTemplateDraft.name} onChange={(event) => setReportTemplateDraft((current) => ({ ...current, name: event.target.value }))} />
                <Input placeholder="Anahtar: pres-is-emri" value={reportTemplateDraft.key} onChange={(event) => setReportTemplateDraft((current) => ({ ...current, key: event.target.value }))} />
                <Select value={reportTemplateDraft.default_format} onValueChange={(value) => setReportTemplateDraft((current) => ({ ...current, default_format: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">Varsayılan PDF</SelectItem>
                    <SelectItem value="xlsx">Varsayılan Excel</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Açıklama" value={reportTemplateDraft.description} onChange={(event) => setReportTemplateDraft((current) => ({ ...current, description: event.target.value }))} />
                <input ref={reportTemplateFileRef} type="file" accept=".xlsx,.xltx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block w-full rounded-md border p-2 text-sm" />
                <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>Aktif</span>
                  <Switch checked={reportTemplateDraft.is_active} onCheckedChange={(checked) => setReportTemplateDraft((current) => ({ ...current, is_active: checked }))} />
                </label>
                <div className="flex gap-2">
                  <Button onClick={saveReportTemplate} disabled={!reportTemplateDraft.name.trim()}>
                    {editingReportTemplateId ? <Save className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                    {editingReportTemplateId ? 'Güncelle' : 'Yükle'}
                  </Button>
                  {editingReportTemplateId && <Button variant="outline" onClick={resetReportTemplateForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>İş emri rapor şablonları</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {reportTemplates.map((template) => (
                  <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.key} · {template.default_format?.toUpperCase()} · {template.is_active ? 'Aktif' : 'Pasif'}</p>
                      {template.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {template.file_url ? (
                        <Button variant="outline" size="sm" onClick={() => window.open(template.file_url, '_blank', 'noopener,noreferrer')}>
                          <Download className="mr-2 h-4 w-4" /> Şablon
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => editReportTemplate(template)}>
                        <Edit3 className="mr-2 h-4 w-4" /> Düzenle
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteItem(`/production/report-templates/${template.id}/`, template.name)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Sil
                      </Button>
                    </div>
                  </div>
                ))}
                {!reportTemplates.length && (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Excel şablonu yükleyin. Şablonda genel alanları ve bir örnek kalem satırında <code>{'{kalem1.urunTipi}'}</code>, <code>{'{kalem1.adet}'}</code> gibi placeholderları kullanabilirsiniz.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'devices' && (
          <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>{editingDeviceId ? 'Cihazı düzenle' : 'Cihaz oluştur'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={deviceDraft.station} onValueChange={(value) => setDeviceDraft((v) => ({ ...v, station: value }))}>
                  <SelectTrigger><SelectValue placeholder="İstasyon seç" /></SelectTrigger>
                  <SelectContent>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Cihaz adı" value={deviceDraft.name} onChange={(e) => setDeviceDraft((v) => ({ ...v, name: e.target.value }))} />
                <label className="flex items-center justify-between rounded-md border p-3 text-sm"><span>Aktif</span><Switch checked={deviceDraft.is_active} onCheckedChange={(checked) => setDeviceDraft((v) => ({ ...v, is_active: checked }))} /></label>
                <div className="flex gap-2">
                  <Button onClick={saveDevice} disabled={!deviceDraft.station || !deviceDraft.name}>
                    {editingDeviceId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {editingDeviceId ? 'Güncelle' : 'Cihaz ekle'}
                  </Button>
                  {editingDeviceId && <Button variant="outline" onClick={resetDeviceForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{editingFieldId ? 'Veri alanını düzenle' : 'Veri alanı'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Anahtar" value={fieldDraft.key} onChange={(e) => setFieldDraft((v) => ({ ...v, key: e.target.value }))} />
                <Input placeholder="Etiket" value={fieldDraft.label} onChange={(e) => setFieldDraft((v) => ({ ...v, label: e.target.value }))} />
                <Select value={fieldDraft.station} onValueChange={(value) => setFieldDraft((v) => ({ ...v, station: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="global">Genel</SelectItem>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={createField} disabled={!fieldDraft.key || !fieldDraft.label}><Save className="mr-2 h-4 w-4" /> {editingFieldId ? 'Alanı güncelle' : 'Alan ekle'}</Button>
                  {editingFieldId && <Button variant="outline" onClick={resetFieldForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{editingMapId ? 'JSON path eşlemeyi düzenle' : 'JSON path eşleme'}</CardTitle></CardHeader>
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
                <div className="flex gap-2">
                  <Button onClick={createMap} disabled={!mapDraft.device || !mapDraft.source_path || !mapDraft.target_key}><Plus className="mr-2 h-4 w-4" /> {editingMapId ? 'Eşlemeyi güncelle' : 'Eşle'}</Button>
                  {editingMapId && <Button variant="outline" onClick={resetMapForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {devices.map((device) => (
              <Card key={`device-${device.id}`}>
                <CardContent className="flex items-center justify-between gap-3 pt-6 text-sm">
                  <div className="min-w-0">
                    <span>{device.name} · {device.station_code}</span>
                    <Badge className="ml-2" variant={device.is_active ? 'secondary' : 'outline'}>{device.is_active ? 'Aktif' : 'Pasif'}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => editDevice(device)} title="Cihazı düzenle">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/devices/${device.id}/`, device.name)} title="Cihazı sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {dataFields.map((field) => (
              <Card key={`field-${field.id}`}>
                <CardContent className="flex items-center justify-between gap-3 pt-6 text-sm">
                  <span>{field.label} · {field.station_code || 'Genel'}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => editDataField(field)} title="Veri alanını düzenle">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/data-fields/${field.id}/`, field.label)} title="Veri alanını sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {deviceMaps.map((map) => (
              <Card key={`map-${map.id}`}>
                <CardContent className="flex items-center justify-between gap-3 pt-6 text-sm">
                  <span>{map.device_name} · {map.source_path}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{map.target_key}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => editDeviceMap(map)} title="Eşlemeyi düzenle">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/device-maps/${map.id}/`, map.target_key)} title="Eşlemeyi sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </>
        )}

        {activeTab === 'flow' && (
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader><CardTitle>{editingRouteId ? 'Rotayı düzenle' : 'Rota oluştur'}</CardTitle></CardHeader>
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
                <div className="flex gap-2">
                  <Button onClick={createRoute} disabled={!routeDraft.name || !routeDraft.product_group_key || routeDraft.station_ids.length === 0}><Route className="mr-2 h-4 w-4" /> {editingRouteId ? 'Rotayı güncelle' : 'Rota kaydet'}</Button>
                  {editingRouteId && <Button variant="outline" onClick={resetRouteForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>{editingRuleId ? 'Kural setini düzenle' : 'Kural seti oluştur'}</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Input placeholder="Kural adı" value={ruleDraft.name} onChange={(e) => setRuleDraft((v) => ({ ...v, name: e.target.value }))} />
                  <Select value={ruleDraft.scope} onValueChange={(value) => setRuleDraft((v) => ({ ...v, scope: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['global', 'station', 'route'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                  <Select value={ruleDraft.station} onValueChange={(value) => setRuleDraft((v) => ({ ...v, station: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">İstasyon yok</SelectItem>{stations.map((st) => <SelectItem key={st.id} value={String(st.id)}>{st.code}</SelectItem>)}</SelectContent></Select>
                  <Select value={ruleDraft.route} onValueChange={(value) => setRuleDraft((v) => ({ ...v, route: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Rota yok</SelectItem>{routes.map((route) => <SelectItem key={route.id} value={String(route.id)}>{route.name}</SelectItem>)}</SelectContent></Select>
                  <div className="flex gap-2 xl:col-span-1">
                    <Button onClick={createRule} disabled={!ruleDraft.name}><Plus className="mr-2 h-4 w-4" /> {editingRuleId ? 'Güncelle' : 'Kural ekle'}</Button>
                    {editingRuleId && <Button variant="outline" onClick={resetRuleForm}><X className="mr-2 h-4 w-4" /> İptal</Button>}
                  </div>
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
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => editRoute(route)} title="Rotayı düzenle">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/routes/${route.id}/`, route.name)} title="Rotayı sil">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => editRule(rule)} title="Kural setini düzenle">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteItem(`/production/rules/${rule.id}/`, rule.name)} title="Kural setini sil">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'presets' && (
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
        )}
      </PageSubSidebar>

      <Dialog open={stockInOpen} onOpenChange={setStockInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Plus className="h-5 w-5" /> Hammadde Girişi (Depoya Mal Kabul)
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const product = products.find((p: any) => String(p.id) === String(stockInForm.product_id))
            if (!product) return null
            
            const hasExisting = targetProductStocks.length > 0
            const totalStockVal = targetProductStocks.reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0)

            return (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/40 p-3 border text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground uppercase">Ürün Detayı</p>
                  <p className="font-medium text-sm text-foreground">{product.sku} · {product.name}</p>
                  <p className="text-muted-foreground">Kategori: {product.category_name || product.categoryName || 'Belirtilmemiş'}</p>
                </div>

                {isLoadingStocks ? (
                  <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> Stok bilgisi sorgulanıyor...
                  </div>
                ) : !hasExisting ? (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
                    <p className="font-semibold text-amber-600 flex items-center gap-1">
                      ⚠️ Depoya İlk Giriş Yapılacak
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Bu ürün daha önce depoya alınmamıştır. Sistemdeki eski toplam stok bakiyesi (<strong>{product.stock || 0} Adet</strong>) otomatik olarak seçeceğiniz rafa devredilecektir.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs">
                    <p className="font-semibold text-emerald-600 flex items-center gap-1">
                      ✅ Depoda Stok Kaydı Mevcut
                    </p>
                    <div className="mt-1.5 space-y-1">
                      <p className="text-muted-foreground font-medium">Mevcut Raflar ve Stoklar:</p>
                      <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-0.5">
                        {targetProductStocks.map((s: any, idx: number) => (
                          <li key={idx}>
                            {s.warehouse_name} / <strong>{s.location_code}</strong>: {s.quantity} Adet
                            { (s.detail_1 || s.detail_2) && ` (${s.detail_1 || ''} / ${s.detail_2 || ''})` }
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[10px] text-muted-foreground italic">
                        Toplam Depo Bakiyesi: {totalStockVal} Adet (Katalog Bakiyesi: {product.stock || 0})
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="space-y-3 py-2 text-sm">
            <div className="grid gap-1">
              <Label>Giriş Yapılacak Depo / Raf</Label>
              <Select 
                value={stockInForm.location_id} 
                onValueChange={(val) => setStockInForm((prev: any) => ({ ...prev, location_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Depo/raf seçin" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc: any) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.warehouse_name || 'Depo'} / {loc.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Detay-1 (Boy/Ölçü)</Label>
                <Input 
                  value={stockInForm.detail_1_override} 
                  onChange={(e) => setStockInForm((prev: any) => ({ ...prev, detail_1_override: e.target.value }))}
                  placeholder="örn: 60"
                />
              </div>
              <div className="grid gap-1">
                <Label>Detay-2 (Renk/Özellik)</Label>
                <Input 
                  value={stockInForm.detail_2_override} 
                  onChange={(e) => setStockInForm((prev: any) => ({ ...prev, detail_2_override: e.target.value }))}
                  placeholder="örn: Kırmızı"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label>Eklenecek Miktar</Label>
              <Input 
                type="number" 
                min="0.01" 
                step="any"
                value={stockInForm.quantity} 
                onChange={(e) => setStockInForm((prev: any) => ({ ...prev, quantity: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-1">
              <Label>Referans (Evrak/İrsaliye)</Label>
              <Input 
                value={stockInForm.reference} 
                onChange={(e) => setStockInForm((prev: any) => ({ ...prev, reference: e.target.value }))}
                placeholder="İrsaliye no vb."
              />
            </div>

            <div className="grid gap-1">
              <Label>Açıklama</Label>
              <Textarea 
                value={stockInForm.note} 
                onChange={(e) => setStockInForm((prev: any) => ({ ...prev, note: e.target.value }))}
                placeholder="Açıklama yazın..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockInOpen(false)}>İptal</Button>
            <Button onClick={submitStockIn} className="bg-primary hover:bg-primary/95 text-white">
              Stok Girişini Tamamla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ProductionWorkOrdersPage() {
  const { toast } = useToast()
  const workOrderImportRef = useRef<HTMLInputElement | null>(null)
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [tablets, setTablets] = useState<Tablet[]>([])
  const [reportTemplates, setReportTemplates] = useState<ProductionReportTemplate[]>([])
  const [stepTargetDraft, setStepTargetDraft] = useState<Record<number, string>>({})
  const [contractId, setContractId] = useState('')
  const [query, setQuery] = useState('')
  const [drawingQuery, setDrawingQuery] = useState('')
  const [drawingResults, setDrawingResults] = useState<TechnicalDrawing[]>([])
  const [drawingSearching, setDrawingSearching] = useState(false)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({})
  const [reportOrder, setReportOrder] = useState<WorkOrder | null>(null)
  const [reportTemplateId, setReportTemplateId] = useState('')
  const [reportFormat, setReportFormat] = useState<'xlsx' | 'pdf'>('pdf')
  const [reportNotes, setReportNotes] = useState('')
  const [reportExporting, setReportExporting] = useState(false)

  const load = async () => {
    const [wo, qs, tabletRows, templateRows] = await Promise.all([
      fetchAll<WorkOrder>('/production/work-orders/'),
      fetchAll<any>('/quotes/?document_type=Contract&summary=1'),
      fetchAll<Tablet>('/production/tablets/'),
      fetchAll<ProductionReportTemplate>('/production/report-templates/').catch(() => []),
    ])
    setOrders(wo)
    setContracts(qs.filter((item) => item.status === 'Approved' || item.status === 'Onaylandı'))
    setTablets(tabletRows)
    setReportTemplates(templateRows.filter((item) => item.is_active))
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

  const sendDraftToProduction = async (id: number) => {
    setPublishingId(id)
    try {
      await api.patch(`/production/work-orders/${id}/`, { status: 'waiting' })
      toast({ title: 'İş emri üretime gönderildi' })
      await load()
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'İş emri güncellenemedi', variant: 'destructive' })
    } finally {
      setPublishingId(null)
    }
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

  const searchDrawings = async () => {
    setDrawingSearching(true)
    try {
      const response = await api.get('/product-technical-drawings/', { params: { search: drawingQuery, active: 'true' } })
      setDrawingResults(Array.isArray(response.data) ? response.data : response.data?.results || [])
    } finally {
      setDrawingSearching(false)
    }
  }

  const openWorkOrderReport = (order: WorkOrder) => {
    const preferred = reportTemplates.find((item) => item.is_active) || reportTemplates[0]
    setReportOrder(order)
    setReportTemplateId(preferred ? String(preferred.id) : '')
    setReportFormat(preferred?.default_format || 'pdf')
    setReportNotes('')
  }

  const exportWorkOrderReport = async () => {
    if (!reportOrder || !reportTemplateId) return
    setReportExporting(true)
    try {
      const response = await api.post(
        `/production/work-orders/${reportOrder.id}/export-report/`,
        { template_id: reportTemplateId, format: reportFormat, extra_notes: reportNotes },
        { responseType: 'blob' },
      )
      downloadBlobResponse(response, `${reportOrder.number}-is-emri-raporu.${reportFormat}`)
      toast({ title: 'İş emri raporu indirildi' })
      setReportOrder(null)
    } catch (error: any) {
      toast({ title: error?.response?.data?.detail || 'Rapor oluşturulamadı', variant: 'destructive' })
    } finally {
      setReportExporting(false)
    }
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
                      <SelectItem key={item.id} value={String(item.id)}>{asText(item.number)} - {asText(item.customer_name || item.customerName, 'Cari')}</SelectItem>
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
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input value={drawingQuery} onChange={(event) => setDrawingQuery(event.target.value)} placeholder="Teknik resim ara: ürün kodu, ürün adı, kategori veya dosya başlığı" onKeyDown={(event) => { if (event.key === 'Enter') void searchDrawings() }} />
            <Button variant="outline" onClick={searchDrawings} disabled={drawingSearching}>
              <FileImage className="mr-2 h-4 w-4" /> Ara
            </Button>
          </div>
          {drawingResults.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {drawingResults.map((drawing) => (
                <div key={drawing.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{asText(drawing.product_sku, 'Kodsuz')} · {asText(drawing.title, 'Teknik resim')}</p>
                    <p className="truncate text-xs text-muted-foreground">{asText(drawing.product_name || drawing.folder_name, 'Teknik resim')}</p>
                  </div>
                  <TechnicalDrawingButton drawings={[drawing]} compact />
                </div>
              ))}
            </div>
          )}
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
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openWorkOrderReport(order)} disabled={!reportTemplates.length}>
                  <Download className="mr-2 h-4 w-4" /> İş Emri Raporu
                </Button>
                {order.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendDraftToProduction(order.id)}
                    disabled={publishingId === order.id}
                  >
                    Üretime Gönder
                  </Button>
                )}
                <Badge>{statusLabel[order.status] || order.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(order.lines || []).map((line) => (
                <div key={line.id} className="rounded-lg border p-3">
                  <div className="grid gap-3 xl:grid-cols-[1.4fr_160px_auto] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{asText(line.product_sku, 'Kodsuz')} · {asText(line.product_name, 'Ürün')}</p>
                        {line.technical_drawings?.length ? <Badge variant="secondary">{line.technical_drawings.length} teknik resim</Badge> : null}
                      </div>
                      <div className="mt-1 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                        <p><span className="font-medium text-foreground">Detay-1:</span> {asText(line.detail_1, '-')}</p>
                        <p><span className="font-medium text-foreground">Detay-2:</span> {asText(line.detail_2, '-')}</p>
                      </div>
                      {line.technical_notes ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{asText(line.technical_notes)}</p> : null}
                      <div className="mt-2">
                        <MaterialRequirementList rows={line.material_requirements} compact />
                      </div>
                    </div>
                    <div className="text-sm xl:text-right">
                      <p>{formatNumber(n(line.completed_quantity))} / {formatNumber(n(line.quantity))}</p>
                      <ProgressBar done={line.completed_quantity} target={line.quantity} />
                      {line.stock_in_done && <Badge variant="secondary">Depoya işlendi</Badge>}
                    </div>
                    <div className="flex justify-start xl:justify-end gap-2">
                      <TechnicalDrawingButton drawings={line.technical_drawings} compact />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedLines(prev => ({ ...prev, [line.id]: !prev[line.id] }))}
                        className="h-9 gap-1 font-semibold text-xs border-primary/30"
                      >
                        {expandedLines[line.id] ? (
                          <>
                            <X className="h-4 w-4" /> Gizle
                          </>
                        ) : (
                          <>
                            <Monitor className="h-4 w-4" /> İstasyon & Tablet Atamaları ({line.steps?.length || 0})
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {expandedLines[line.id] && (
                    <div className="mt-4 border-t pt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground">İstasyon Akışı & Tablet Atamaları</h4>
                        <span className="text-xs text-muted-foreground">{line.steps?.length || 0} Adım</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-6">
                        {(line.steps || []).map((step) => (
                          <div key={step.id} className="rounded-md border p-2 bg-muted/10">
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
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={Boolean(reportOrder)} onOpenChange={(open) => { if (!open) setReportOrder(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>İş emri raporu oluştur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{reportOrder?.number} · {reportOrder?.customer_name || 'Cari yok'}</p>
            <Select value={reportTemplateId} onValueChange={(value) => {
              setReportTemplateId(value)
              const selected = reportTemplates.find((item) => String(item.id) === value)
              if (selected?.default_format) setReportFormat(selected.default_format)
            }}>
              <SelectTrigger><SelectValue placeholder="Rapor şablonu seç" /></SelectTrigger>
              <SelectContent>
                {reportTemplates.map((template) => (
                  <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reportFormat} onValueChange={(value) => setReportFormat(value as 'xlsx' | 'pdf')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="xlsx">Excel</SelectItem>
              </SelectContent>
            </Select>
            <Textarea value={reportNotes} onChange={(event) => setReportNotes(event.target.value)} placeholder="Ek açıklamalar / Açıklama 3-4 gibi basılacak notlar" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOrder(null)}>İptal</Button>
            <Button onClick={exportWorkOrderReport} disabled={!reportTemplateId || reportExporting}>
              <Download className="mr-2 h-4 w-4" /> İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                  <CardTitle>{asText(item.station_code)} · {asText(item.product_name, 'Ürün')}</CardTitle>
                  <p className="text-sm text-muted-foreground">{asText(item.work_order_number)} · {asText(item.customer_name, '-')} · {asText(item.detail_1, '-')} / {asText(item.detail_2, '-')}</p>
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
  const selectedLineIdRef = useRef(selectedLineId)

  useEffect(() => {
    selectedLineIdRef.current = selectedLineId
  }, [selectedLineId])

  const [loginSlot, setLoginSlot] = useState<number | null>(null)
  const [loginUser, setLoginUser] = useState('')
  const [pin, setPin] = useState('')
  const [closingSlot, setClosingSlot] = useState<TabletSlot | null>(null)
  const [closingQty, setClosingQty] = useState('')
  const [closingPin, setClosingPin] = useState('')
  const [note, setNote] = useState('')
  const [batchLogoutOpen, setBatchLogoutOpen] = useState(false)
  const [batchSelectedSessionIds, setBatchSelectedSessionIds] = useState<number[]>([])
  const [batchLogoutQty, setBatchLogoutQty] = useState('')
  const [batchLogoutAuthorizerId, setBatchLogoutAuthorizerId] = useState('')
  const [batchLogoutPin, setBatchLogoutPin] = useState('')
  const [batchLogoutNote, setBatchLogoutNote] = useState('')
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkpointTitle, setCheckpointTitle] = useState('')
  const [checkpointTotal, setCheckpointTotal] = useState('')
  const [checkpointNote, setCheckpointNote] = useState('')
  const [activeAlert, setActiveAlert] = useState<any | null>(null)
  const [callManagerOpen, setCallManagerOpen] = useState(false)
  const [callManagerTitle, setCallManagerTitle] = useState('Makine Arızası')
  const [callManagerMessage, setCallManagerMessage] = useState('')
  const [tick, setTick] = useState(Date.now())
  const [lastLoadedAt, setLastLoadedAt] = useState(Date.now())
  const seenAlerts = useRef<Set<number>>(new Set())
  const checkpointActionRef = useRef<((total: string, note: string) => Promise<void>) | null>(null)
  const autoCheckpointKeyRef = useRef('')

  const callManager = async () => {
    setSubmitting(true)
    try {
      await api.post('/production/tablet/call-manager/', {
        token,
        title: callManagerTitle,
        message: callManagerMessage,
      })
      toast({ title: 'Yönetici çağrısı gönderildi' })
      setCallManagerOpen(false)
      setCallManagerMessage('')
      await load()
    } catch (err: any) {
      toast({
        title: 'Çağrı başarısız',
        description: err.response?.data?.detail || 'Bilinmeyen bir hata oluştu.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const load = async () => {
    if (!token) return
    localStorage.setItem('production-tablet-token', token)
    const response = await api.get('/production/tablet/context/', { params: { token } })
    const data = response.data || {}
    setCtx(data)
    setLastLoadedAt(Date.now())
    
    let nextId = selectedLineIdRef.current
    const items = data.work_items || []
    if (nextId && !items.some((item: any) => String(item.line_id) === nextId)) {
      nextId = ''
    }
    if (!nextId && items[0]) {
      setSelectedLineId(String(items[0].line_id))
    }

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

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const slots = Array.from({ length: ctx.station?.max_workers || 1 }, (_, index) => ctx.slots?.find((slot) => Number(slot.slot_index) === index) || null)
  const selectedWork = ctx.work_items?.find((item) => String(item.line_id) === selectedLineId) || ctx.work_items?.[0]
  const activeSlots = slots.filter(Boolean) as TabletSlot[]
  const startedSlots = activeSlots.filter((slot) => slot.status === 'started')
  const shiftLocked = Boolean(ctx.shift_state?.locked)
  const shiftNeedsCheckpoint = ctx.shift_state?.state === 'checkpoint_required'
  const checkpointNames = (ctx.shift_state?.checkpoint_names || activeSlots.map((slot) => slot.user_name)).filter(Boolean)
  const checkpointPeople = checkpointNames.length ? checkpointNames.join(' ve ') : 'çalışanların'

  const liveBreakSeconds = (slot: TabletSlot) => {
    const base = Number(slot.break_seconds || 0)
    if (slot.active_break_id && slot.status === 'paused') {
      return base + Math.max(0, Math.floor((tick - lastLoadedAt) / 1000))
    }
    return base
  }

  const requestCheckpoint = (title: string, action: (total: string, note: string) => Promise<void>) => {
    setCheckpointTitle(title)
    setCheckpointTotal('')
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

  const shiftCheckpoint = async () => {
    const perform = async (total: string, checkpointNoteValue: string) => {
      await api.post('/production/tablet/shift-checkpoint/', {
        token,
        line_id: ctx.shift_state?.line_id || selectedWork?.line_id || null,
        checkpoint_total: total,
        note: checkpointNoteValue || ctx.shift_state?.label || 'Vardiya checkpoint',
      })
      toast({ title: 'Vardiya checkpoint kaydedildi' })
      await load()
    }
    const title = ctx.shift_state?.active_break
      ? `Planlı mola başladı. ${checkpointPeople} mola öncesi üretim miktarını yazın`
      : `Vardiya bitti. ${checkpointPeople} çıkış yapmadan önce üretim miktarını yazın`
    requestCheckpoint(title, perform)
  }

  useEffect(() => {
    if (!shiftNeedsCheckpoint || checkpointOpen || submitting) return
    const key = `${ctx.shift_state?.state || ''}:${ctx.shift_state?.active_window_id || ''}:${ctx.shift_state?.active_break?.id || ''}:${ctx.shift_state?.active_shift?.id || ''}`
    if (!key || autoCheckpointKeyRef.current === key) return
    autoCheckpointKeyRef.current = key
    void shiftCheckpoint()
  }, [shiftNeedsCheckpoint, checkpointOpen, submitting, ctx.shift_state?.active_window_id, ctx.shift_state?.active_break?.id, ctx.shift_state?.active_shift?.id])

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
        const names = activeSlots.map((s) => s.user_name).join(' ve ')
        requestCheckpoint(`Yeni çalışan girmeden önce ${names} üretim miktarını yazın`, perform)
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
        const targetSlots = endpoint.includes('break/start') ? activeSlots : startedSlots
        const names = targetSlots.map((s) => s.user_name).join(' ve ')
        requestCheckpoint(`${names} üretim miktarını yazın`, perform)
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

  const batchLogout = async () => {
    if (batchSelectedSessionIds.length === 0) {
      toast({
        title: 'Hata',
        description: 'Lütfen çıkış yapacak en az bir çalışan seçin.',
        variant: 'destructive',
      })
      return
    }
    if (!batchLogoutQty || isNaN(Number(batchLogoutQty)) || Number(batchLogoutQty) < 0) {
      toast({
        title: 'Hata',
        description: 'Lütfen geçerli bir üretim miktarı girin.',
        variant: 'destructive',
      })
      return
    }
    if (!batchLogoutAuthorizerId) {
      toast({
        title: 'Hata',
        description: 'Lütfen onaylayan çalışanı seçin.',
        variant: 'destructive',
      })
      return
    }
    if (!batchLogoutPin) {
      toast({
        title: 'Hata',
        description: 'Lütfen onaylayan çalışanın PIN kodunu girin.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await api.post('/production/tablet/batch-logout-slots/', {
        token,
        user_id: Number(batchLogoutAuthorizerId),
        pin: batchLogoutPin,
        session_ids: batchSelectedSessionIds,
        declared_good_quantity: Number(batchLogoutQty),
        note: batchLogoutNote,
      })
      setBatchLogoutOpen(false)
      setBatchSelectedSessionIds([])
      setBatchLogoutQty('')
      setBatchLogoutAuthorizerId('')
      setBatchLogoutPin('')
      setBatchLogoutNote('')
      toast({ title: 'Toplu çıkış başarıyla yapıldı' })
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
        const names = activeSlots.map((s) => s.user_name).join(' ve ')
        requestCheckpoint(`${names} üretim miktarını yazın`, perform)
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
    <div className="min-h-screen space-y-3 bg-background p-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{ctx.station?.department_name || 'İmalat'}</p>
              <h1 className="mt-1 text-3xl font-black tracking-wide md:text-5xl">{ctx.station?.code} · {ctx.station?.name}</h1>
            </div>
            <Button 
              onClick={() => {
                setCallManagerTitle('Makine Arızası')
                setCallManagerMessage('')
                setCallManagerOpen(true)
              }} 
              variant="outline"
              className="h-12 border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-500/20 gap-2 shrink-0 sm:self-center"
            >
              <Volume2 className="h-5 w-5 animate-pulse" /> Yöneticiyi Çağır
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricBlock label="Hedef" value={formatNumber(n(ctx.daily_target?.target_quantity))} />
            <MetricBlock label="Yapılan" value={formatNumber(n(ctx.daily_target?.actual_quantity))} />
            <MetricBlock label="Kalan" value={formatNumber(n(ctx.daily_target?.remaining_quantity))} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar done={ctx.daily_target?.actual_quantity} target={ctx.daily_target?.target_quantity} />
          <span className="min-w-12 text-right text-sm font-semibold">%{formatNumber(n(ctx.daily_target?.completion_percent ?? pct(ctx.daily_target?.actual_quantity, ctx.daily_target?.target_quantity)))}</span>
        </div>
      </div>

      <Card className={shiftLocked ? 'border-amber-500/70 bg-amber-500/10' : ''}>
        <CardContent className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={shiftLocked ? 'destructive' : 'secondary'}>{ctx.shift_state?.label || 'Vardiya'}</Badge>
              {ctx.shift_state?.active_shift && <span className="text-sm font-medium">{ctx.shift_state.active_shift.name}</span>}
              {ctx.shift_state?.active_break && <span className="text-sm font-medium">{ctx.shift_state.active_break.name}</span>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {ctx.shift_state?.message || (
                ctx.shift_state?.next_break
                  ? `Sonraki mola: ${ctx.shift_state.next_break.name} ${shortTime(ctx.shift_state.next_break.starts_at)}`
                  : ctx.shift_state?.next_shift
                    ? `Sonraki vardiya: ${ctx.shift_state.next_shift.name} ${shortTime(ctx.shift_state.next_shift.starts_at)}`
                    : 'Vardiya aktif.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {ctx.shift_state?.seconds_until_change !== null && ctx.shift_state?.seconds_until_change !== undefined && (
              <Badge variant="outline" className="px-3 py-2 text-sm">
                {formatSeconds(Math.max(0, Number(ctx.shift_state.seconds_until_change || 0) - Math.floor((tick - lastLoadedAt) / 1000)))}
              </Badge>
            )}
            {shiftNeedsCheckpoint && (
              <Button onClick={shiftCheckpoint} disabled={submitting}>
                <Save className="mr-2 h-4 w-4" /> Üretim miktarını yaz
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-3 lg:grid-cols-[1fr_320px] lg:items-end">
          <div className="space-y-2">
            <Label>Aktif iş emri</Label>
            <Select value={selectedLineId} onValueChange={setSelectedLineId} disabled={shiftLocked}>
              <SelectTrigger className="h-14 text-lg"><SelectValue placeholder="İş emri seç" /></SelectTrigger>
              <SelectContent>
                {(ctx.work_items || []).map((item) => (
                  <SelectItem key={item.line_id} value={String(item.line_id)}>
                    {asText(item.work_order_number)} · {asText(item.product_sku, 'Kodsuz')} · {asText(item.product_name, 'Ürün')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={load} className="h-14" disabled={submitting}><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setBatchSelectedSessionIds(activeSlots.map(s => s.id))
                  if (activeSlots.length > 0) {
                    setBatchLogoutAuthorizerId(String(activeSlots[0].user_id))
                  }
                  setBatchLogoutQty('')
                  setBatchLogoutPin('')
                  setBatchLogoutNote('')
                  setBatchLogoutOpen(true)
                }}
                disabled={activeSlots.length === 0 || submitting || shiftLocked}
                className="h-14"
              >
                <LogOut className="mr-2 h-4 w-4" /> Toplu Çıkış
              </Button>
            </div>
            <Button onClick={completeWorkItem} disabled={!selectedWork || submitting || shiftLocked} className="h-14"><CheckCircle2 className="mr-2 h-4 w-4" /> İşi tamamla</Button>
            <TechnicalDrawingButton drawings={selectedWork?.technical_drawings} compact />
          </div>
        </CardContent>
      </Card>

      {selectedWork && (
        <Card>
          <CardContent className="grid gap-3 p-3 lg:grid-cols-[1.5fr_repeat(4,minmax(90px,1fr))_auto] lg:items-center">
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{asText(selectedWork.product_sku, 'Kodsuz')} · {asText(selectedWork.product_name, 'Ürün')}</p>
              <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p><span className="font-medium text-foreground">Detay-1:</span> {asText(selectedWork.detail_1, '-')}</p>
                <p><span className="font-medium text-foreground">Detay-2:</span> {asText(selectedWork.detail_2, '-')}</p>
              </div>
              {selectedWork.technical_notes ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{asText(selectedWork.technical_notes)}</p> : null}
              <div className="mt-2">
                <MaterialRequirementList rows={selectedWork.material_requirements} compact />
              </div>
            </div>
            <MetricBlock label="Adet" value={formatNumber(n(selectedWork.target_quantity))} />
            <MetricBlock label="Resmi sağlam" value={formatNumber(n(selectedWork.completed_quantity))} />
            <MetricBlock label="Makine" value={formatNumber(n(selectedWork.machine_quantity))} />
            <MetricBlock label="Pencere" value={formatNumber(n(ctx.active_window?.machine_delta))} />
            <TechnicalDrawingButton drawings={selectedWork.technical_drawings} compact />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot, index) => (
          <Card key={index} className="min-h-56">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="flex items-center justify-between">
                <span>Slot {index + 1}</span>
                {slot?.status === 'paused' && <Badge variant="outline">Molada</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              {slot ? (
                <>
                  <div>
                    <p className="text-xl font-bold">{slot.user_name}</p>
                    <p className="text-sm text-muted-foreground">{slot.work_order_number} · {slot.product_sku}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricBlock label="Oturum makine" value={formatNumber(n(slot.machine_quantity))} />
                    <MetricBlock label="Bugün kişi" value={formatNumber(n(ctx.operators?.find((item) => item.id === slot.user_id)?.today_total))} />
                  </div>
                  <MetricBlock label="Mola süresi" value={formatSeconds(liveBreakSeconds(slot))} />
                  <div className="grid gap-2">
                    {slot.status === 'paused' ? (
                      <Button variant="outline" onClick={() => tabletAction('break/end', slot)} disabled={submitting || shiftLocked}>Molayı bitir</Button>
                    ) : (
                      <Button variant="outline" onClick={() => window.confirm('Molaya çıkılsın mı?') && tabletAction('break/start', slot)} disabled={submitting || shiftLocked}>
                        <Pause className="mr-2 h-4 w-4" /> Mola
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      disabled={submitting || shiftLocked}
                      onClick={() => {
                        setClosingSlot(slot)
                        setClosingQty('')
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
                  className="flex h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted/40"
                  onClick={() => setLoginSlot(index)}
                  disabled={submitting || shiftLocked}
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
        <CardHeader className="p-3 pb-1"><CardTitle>Bugünkü kişi toplamları</CardTitle></CardHeader>
        <CardContent className="grid gap-2 p-3 md:grid-cols-3 xl:grid-cols-6">
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
            <Input type="text" inputMode="numeric" pattern="[0-9]*" style={{ WebkitTextSecurity: 'disc' } as any} placeholder="Üretim PIN’i" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} disabled={submitting} />
          </div>
          <DialogFooter><Button onClick={login} disabled={!loginUser || !pin || submitting}>Başlat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closingSlot} onOpenChange={(open) => !open && setClosingSlot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{closingSlot?.user_name} - Çıkış Yap</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Bu periyotta tek başınıza veya ekiple birlikte ürettiğiniz net miktarı (adet) yazın.
            </div>
            <div className="grid gap-2">
              <Label>Yapılan Üretim Miktarı (Adet)</Label>
              <Input type="text" inputMode="numeric" pattern="[0-9]*" value={closingQty} onChange={(e) => setClosingQty(e.target.value)} disabled={submitting} />
            </div>
            <Input type="text" inputMode="numeric" pattern="[0-9]*" style={{ WebkitTextSecurity: 'disc' } as any} placeholder="Üretim PIN’i" maxLength={4} value={closingPin} onChange={(e) => setClosingPin(e.target.value.replace(/\D/g, ''))} disabled={submitting} />
            <Textarea placeholder="Varsa notunuz" value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter><Button onClick={logout} disabled={!closingQty || !closingPin || submitting}>Çıkışı tamamla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkpointOpen} onOpenChange={(open) => {
        if (!open && shiftNeedsCheckpoint) return
        if (!open) {
          checkpointActionRef.current = null
          setCheckpointOpen(false)
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{checkpointTitle || 'Üretim Miktarını Yazın'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Yapılan Üretim Miktarı (Adet)</Label>
              <Input type="text" inputMode="numeric" pattern="[0-9]*" value={checkpointTotal} onChange={(e) => setCheckpointTotal(e.target.value)} autoFocus disabled={submitting} />
            </div>
            <Textarea placeholder="Varsa notunuz" value={checkpointNote} onChange={(e) => setCheckpointNote(e.target.value)} disabled={submitting} />
          </div>
          <DialogFooter>
            {!shiftNeedsCheckpoint && <Button variant="outline" onClick={() => setCheckpointOpen(false)} disabled={submitting}>Vazgeç</Button>}
            <Button onClick={submitCheckpoint} disabled={checkpointTotal === '' || submitting}>Üretim Miktarını Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchLogoutOpen} onOpenChange={setBatchLogoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu Çıkış Yap</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Çıkış Yapacak Çalışanları Seçin</Label>
              <div className="grid gap-2 rounded-md border p-3">
                {activeSlots.map((slot) => {
                  const isChecked = batchSelectedSessionIds.includes(slot.id)
                  return (
                    <label key={slot.id} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-muted/40 rounded">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchSelectedSessionIds([...batchSelectedSessionIds, slot.id])
                          } else {
                            setBatchSelectedSessionIds(batchSelectedSessionIds.filter((id) => id !== slot.id))
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-foreground">{slot.user_name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-qty">Ortak Üretim Miktarı</Label>
              <Input
                id="batch-qty"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Örn: 50"
                value={batchLogoutQty}
                onChange={(e) => setBatchLogoutQty(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Girilen miktar istasyonda çalışan tüm kişilere eşit olarak yansıtılacaktır.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="batch-auth">Onaylayan Çalışan</Label>
                <Select value={batchLogoutAuthorizerId} onValueChange={setBatchLogoutAuthorizerId}>
                  <SelectTrigger id="batch-auth" className="h-11">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSlots.map((slot) => (
                      <SelectItem key={slot.id} value={String(slot.user_id)}>
                        {slot.user_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-pin">Onaylayan PIN</Label>
                <Input
                  id="batch-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={{ WebkitTextSecurity: 'disc' } as any}
                  maxLength={4}
                  placeholder="PIN"
                  value={batchLogoutPin}
                  onChange={(e) => setBatchLogoutPin(e.target.value.replace(/\D/g, ''))}
                  className="h-11 text-center font-mono tracking-widest"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-note">Not (İsteğe Bağlı)</Label>
              <Textarea
                id="batch-note"
                rows={2}
                placeholder="Açıklama girin..."
                value={batchLogoutNote}
                onChange={(e) => setBatchLogoutNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchLogoutOpen(false)} disabled={submitting}>İptal</Button>
            <Button variant="destructive" onClick={batchLogout} disabled={submitting}>
              {submitting ? 'Çıkış Yapılıyor...' : 'Toplu Çıkış Yap'}
            </Button>
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

      <Dialog open={callManagerOpen} onOpenChange={setCallManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-amber-500" /> Yöneticiyi Çağır
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Durum/Kategori</Label>
              <Select value={callManagerTitle} onValueChange={setCallManagerTitle}>
                <SelectTrigger>
                  <SelectValue placeholder="Durum seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Makine Arızası">Makine Arızası</SelectItem>
                  <SelectItem value="Teknik Sorun">Teknik Sorun</SelectItem>
                  <SelectItem value="Diğer">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Açıklama / Mesaj (İsteğe Bağlı)</Label>
              <Textarea 
                placeholder="Yöneticiye iletmek istediğiniz detayları yazın..." 
                value={callManagerMessage} 
                onChange={(e) => setCallManagerMessage(e.target.value)} 
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallManagerOpen(false)} disabled={submitting}>Vazgeç</Button>
            <Button onClick={callManager} disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">Çağrıyı Gönder</Button>
          </DialogFooter>
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
  const [start, setStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [end, setEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedStation, setSelectedStation] = useState('all')
  const [selectedWorker, setSelectedWorker] = useState('all')
  const [summary, setSummary] = useState<any>({
    by_station: [],
    by_worker: [],
    by_date: [],
    worker_station: [],
    detailed_sessions: [],
    departments: [],
    stations_list: [],
    workers_list: [],
    open_sessions: 0,
    discrepancies_pending: 0,
    departments_count: 0,
    stations_count: 0,
    active_orders: 0,
    completed_today: 0,
  })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = { start, end }
      if (selectedDept !== 'all') params.department = selectedDept
      if (selectedStation !== 'all') params.station = selectedStation
      if (selectedWorker !== 'all') params.worker = selectedWorker
      
      const res = await api.get('/production/reports/summary/', { params })
      setSummary(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [start, end, selectedDept, selectedStation, selectedWorker])

  const downloadCsv = async () => {
    const params: any = { start, end }
    if (selectedDept !== 'all') params.department = selectedDept
    if (selectedStation !== 'all') params.station = selectedStation
    if (selectedWorker !== 'all') params.worker = selectedWorker

    const res = await api.get('/production/reports/export/', { params, responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `imalat_raporu_${start}_${end}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  // Calculate stats in the current filtered range
  const totalProducedInRange = useMemo(() => {
    return (summary.by_station || []).reduce((acc: number, row: any) => acc + (parseFloat(row.total) || 0), 0)
  }, [summary.by_station])
  const stationTargetPerformance = summary.station_target_performance || []

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#14b8a6', '#eab308']

  // Format date safely
  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-'
    const d = new Date(isoString)
    return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="İmalat Raporları"
        description="Filtrelenebilir imalat verimliliği, çalışan performans analizleri ve grafikler."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Yenile
            </Button>
            <Button variant="outline" onClick={downloadCsv} disabled={loading}>
              <Download className="mr-2 h-4 w-4" /> Excel/CSV Aktar
            </Button>
          </>
        }
      />

      {/* Filter panel */}
      <Card className="border border-border/80">
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Başlangıç Tarihi</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="date" className="pl-8 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bitiş Tarihi</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="date" className="pl-8 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bölüm</Label>
            <Select value={selectedDept} onValueChange={(val) => { setSelectedDept(val); setSelectedStation('all'); }}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Bölümler</SelectItem>
                {(summary.departments_list || []).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">İstasyon</Label>
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm İstasyonlar</SelectItem>
                {(summary.stations_list || [])
                  .filter((st: any) => selectedDept === 'all' || String(st.department_id) === selectedDept)
                  .map((st: any) => (
                    <SelectItem key={st.id} value={String(st.id)}>{st.code} - {st.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Çalışan</Label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Çalışanlar</SelectItem>
                {(summary.workers_list || []).map((w: any) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.first_name || w.last_name ? `${w.first_name} ${w.last_name}` : w.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bölüm Sayısı</CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.departments || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Aktif üretim departmanları</p>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">İstasyon Sayısı</CardTitle>
            <Cpu className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.stations || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Aktif hat istasyonları</p>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Açık İş Emri Yükü</CardTitle>
            <Route className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.active_orders || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Üretimi süren/bekleyen iş emirleri</p>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Dönemlik Toplam Üretim</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(totalProducedInRange)}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Seçilen aralıktaki toplam teslimat</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/80 bg-card/40 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TimerReset className="h-4 w-4 text-emerald-500" /> İstasyon Hedef Gerçekleşme
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stationTargetPerformance.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Seçilen aralıkta istasyon hedefi bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationTargetPerformance} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="station_code" tick={{ fontSize: 10 }} stroke="#888888" />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    stroke="#888888" 
                    tickFormatter={(val) => `%${val}`}
                    domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 10) * 10)]}
                  />
                  <ReTooltip
                    formatter={(value: any, name?: string) => {
                      if (name === 'completion_percent') {
                        return [`%${formatNumber(Number(value))}`, 'Verimlilik Oranı'];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label, items) => {
                      const row = items[0]?.payload || {};
                      return (
                        <div className="text-xs space-y-1">
                          <p className="font-bold">İstasyon: {label} - {row.station_name || ''}</p>
                          <p className="text-muted-foreground">Departman: {row.department_name || ''}</p>
                          <p>Hedef: {formatNumber(row.target_quantity || 0)} adet</p>
                          <p>Gerçekleşen: {formatNumber(row.actual_quantity || 0)} adet</p>
                          <p>Kalan Hedef: {formatNumber(row.remaining_quantity || 0)} adet</p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine 
                    y={100} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    label={{ value: 'Hedef %100', fill: '#f59e0b', fontSize: 10, position: 'top' }} 
                  />
                  <Bar dataKey="completion_percent" name="completion_percent" radius={[4, 4, 0, 0]}>
                    {stationTargetPerformance.map((entry: any, index: number) => {
                      const percent = entry.completion_percent || 0;
                      let fill = '#ef4444'; // Red
                      if (percent >= 100) fill = '#10b981'; // Green
                      else if (percent >= 70) fill = '#3b82f6'; // Blue
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Günlük Üretim Hacmi (Zaman Serisi)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {(!summary.by_date || summary.by_date.length === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Seçilen aralıkta üretim kaydı bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.by_date} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888888" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#888888" allowDecimals={false} />
                  <ReTooltip formatter={(value) => `${formatNumber(Number(value))} adet`} />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" name="Üretim Adedi" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-500" /> İstasyon Bazlı Üretim Dağılım Payı
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {(!summary.by_station || summary.by_station.length === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                İstasyon bazında üretim verisi bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.by_station}
                    dataKey="total"
                    nameKey="station__code"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={true}
                  >
                    {(summary.by_station || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(value) => `${formatNumber(Number(value))} adet`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs / Tables */}
      <Tabs defaultValue="worker-breakdown" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="worker-breakdown">Çalışan & İstasyon Dağılımı</TabsTrigger>
          <TabsTrigger value="detailed-logs">Detaylı Çalışma Logları</TabsTrigger>
        </TabsList>

        <TabsContent value="worker-breakdown">
          <Card className="border border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Çalışanların İstasyonlardaki Üretim Performansı</CardTitle>
            </CardHeader>
            <CardContent>
              {(!summary.worker_station || summary.worker_station.length === 0) ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Veri yok.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Çalışan</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">İstasyon Kodu</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">İstasyon Adı</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Toplam Üretilen Adet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.worker_station.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {row.user__first_name || row.user__last_name ? `${row.user__first_name} ${row.user__last_name}` : row.user__username}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono">{row.station__code}</td>
                          <td className="px-4 py-2.5 text-foreground">{row.station__name}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatNumber(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed-logs">
          <Card className="border border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Son Çalışma Oturum Logları (Maks. 200 Kayıt)</CardTitle>
            </CardHeader>
            <CardContent>
              {(!summary.detailed_sessions || summary.detailed_sessions.length === 0) ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Log kaydı bulunamadı.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Başlangıç Zamanı</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Çalışan</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">İstasyon</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">İş Emri</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Mamul Adı</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Kabul Edilen Miktar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.detailed_sessions.map((row: any) => {
                        const isBreak = row.type === 'break';
                        return (
                          <tr key={row.id} className={`hover:bg-muted/20 ${isBreak ? 'bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10 dark:hover:bg-amber-500/20' : ''}`}>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDateTime(row.started_at)}</td>
                            <td className="px-4 py-2.5 font-medium text-foreground">{row.fullname || row.username}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{row.station_code ? `${row.station_code} - ${row.station_name}` : '-'}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">
                              {isBreak ? (
                                <span className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                  MOLA
                                </span>
                              ) : (
                                row.work_order_number || '-'
                              )}
                            </td>
                            <td className={`px-4 py-2.5 truncate max-w-[200px] ${isBreak ? 'italic text-amber-600 dark:text-amber-400 font-medium' : 'text-foreground'}`} title={row.product_name}>
                              {row.product_name}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                              {isBreak ? '-' : formatNumber(row.quantity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
