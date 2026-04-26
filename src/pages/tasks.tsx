import { useMemo, useState, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/app-shell'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import api from '@/lib/api'
import {
  formatDate,
  formatDateTime,
  formatNumber,
  addWorkingMinutes,
  getWorkingMinutesPerDay,
  cn,
  toDatetimeLocalValue,
  toDatetimeLocalFromISO,
} from '@/lib/utils'
import { taskPriorityLabelTR, taskSlaBucketLabelTR, taskStatusLabelTR } from '@/lib/task-labels'
import type { Task, TaskChecklistItem, TaskTimeEntry, UserLite } from '@/types'
import { taskProductLineSchema } from '@/lib/task-product-schema'
import {
  initialProductLinesForForm,
  emptyProductLineRow,
  sumProductLineQuantities,
  sumProductLineQtyProduced,
  workflowTargetFallbackQty,
} from '@/lib/task-product-lines-helpers'
import { TaskProductLineFields } from '@/components/task-product-line-fields'
import { Calendar, ChevronDown, Lock, Plus, Paperclip, Download, Trash2, GripVertical } from 'lucide-react'
import { RbacGuard } from '@/components/rbac'
import { useParams } from '@tanstack/react-router'
import { CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { downloadCsv } from '@/utils/download-csv'
import { downloadICS } from '@/utils/ics'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { taskVisibleToWorkerTeamMember, workerMayClaimTask } from '@/lib/task-worker-visibility'

/** Varsayılan görev sahibi: Ömer Faruk (ad / kullanıcı adı eşleşmesi). */
function pickDefaultTaskOwner(users: UserLite[], explicitOwner?: string): string {
  if (explicitOwner) return explicitOwner
  if (!users.length) return ''
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/ı/g, 'i')
  for (const u of users) {
    const bundle = norm(`${u.firstName || ''} ${u.lastName || ''} ${u.username}`)
    if (bundle.includes('omer') && bundle.includes('faruk')) return u.id
  }
  for (const u of users) {
    const un = norm(u.username)
    if (un.includes('omerfaruk') || un.includes('omer.faruk')) return u.id
  }
  return users[0].id
}

const MENTION_REGEX = /@([\w.-]+)/g
const MAX_FILE_MB = 10
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
const TASK_TEMPLATES: { id: string; name: string; checklist: string[] }[] = [
  { id: 'onboarding', name: 'Onboarding', checklist: ['Gereksinim topla', 'Ölçümleri tanımla', 'Kickoff planla'] },
  { id: 'bugfix', name: 'Bug fix', checklist: ['Reprodüksiyon', 'Kök neden analizi', 'Fix PR', 'Test ve onay'] },
  { id: 'delivery', name: 'Teslimat', checklist: ['Ekip ataması', 'Takvim doğrula', 'Müşteri bilgilendir', 'QA tamamla'] },
]
const WIP_DEFAULTS: Record<Task['status'], number> = { todo: 5, 'in-progress': 4, done: 999 }
const MODEL_CODES = [
  'AY-01',
  'AY-02',
  'AY-03',
  'AY-04',
  'AY-05',
  'AY-06',
  'AY-07',
  'AY-08',
  'AY-09',
  'AY-10',
  'AY-11',
  'AY-12',
  'AY-13',
  'AY-14',
  'AY-15',
  'AY-16',
  'AY-17',
  'AY-18',
  'AY-19',
  'AY-20',
  'AY-21',
  'AY-22',
  'AY-23',
  'AY-24',
  'AY-25',
  'AY-27',
  'AY-28',
  'AY-30',
  'AY-31',
  'AY-35',
]
const BASE_VARIANTS = [
  { id: 'A1', label: 'A1', duration: 4, blade: '1 mm' },
  { id: 'A2', label: 'A2', duration: 4, blade: '1 mm' },
  { id: 'A3', label: 'A3', duration: 4, blade: '3.5 mm' },
  { id: 'A5', label: 'A5', duration: 4, blade: '3 mm' },
  { id: 'A7', label: 'A7', duration: 4, blade: '6.1 mm' },
  { id: 'camli', label: 'Camlı', duration: 8, blade: '1.5 mm' },
  { id: 'giyotin', label: 'Giyotin', duration: 4.5, blade: '3 mm' },
]
const MODEL_DEFAULTS: Record<string, { duration: number; blade: string; sizes?: string[] }> = {
  'AY-01': { duration: 4, blade: '1 mm' },
  'AY-02': { duration: 4, blade: '1 mm' },
  'AY-03': { duration: 4, blade: '1.5 mm' },
  'AY-04': { duration: 3, blade: '1.5 mm' },
  'AY-05': { duration: 4, blade: '3 mm' },
  'AY-06': { duration: 4, blade: '1.5 mm' },
  'AY-07': { duration: 4, blade: '1.5 mm' },
  'AY-08': { duration: 4.5, blade: '1.5 mm' },
  'AY-09': { duration: 4, blade: '1.5 mm' },
  'AY-10': { duration: 4, blade: '1.5 mm' },
  'AY-11': { duration: 3, blade: '1.5 mm' },
  'AY-12': { duration: 2, blade: '1.5 mm' },
  'AY-13': { duration: 3.5, blade: '1.5 mm' },
  'AY-14': { duration: 4, blade: '1.5 mm' },
  'AY-15': { duration: 4, blade: '1.5 mm' },
  'AY-16': { duration: 4, blade: '1.5 mm' },
  'AY-17': { duration: 4, blade: '1.5 mm' },
  'AY-18': { duration: 4, blade: '1.5 mm' },
  'AY-19': { duration: 4, blade: '1.5 mm' },
  'AY-20': { duration: 4, blade: '1.5 mm' },
  'AY-21': { duration: 4, blade: '1.5 mm' },
  'AY-22': { duration: 4, blade: '1.5 mm' },
  'AY-23': { duration: 4, blade: '1.5 mm' },
  'AY-24': { duration: 4, blade: '1.5 mm' },
  'AY-25': { duration: 4, blade: '1.5 mm' },
  'AY-27': { duration: 4, blade: '1.5 mm' },
  'AY-28': { duration: 4, blade: '1.5 mm' },
  'AY-30': { duration: 4, blade: '1.5 mm' },
  'AY-31': { duration: 4, blade: '1.5 mm' },
  'AY-35': { duration: 4, blade: '1.5 mm' },
}
const MODEL_PRESETS = MODEL_CODES.map((code) => {
  const def = MODEL_DEFAULTS[code] || { duration: 4, blade: '1.5 mm' }
  return {
    code,
    sizes: def.sizes || ['73x210', '83x210', '93x210'],
    variants: BASE_VARIANTS,
    baseDuration: def.duration,
    baseBlade: def.blade,
  }
})

const taskSchema = z
  .object({
    title: z.string().min(2, 'Başlık en az 2 karakter olmalı'),
    owner: z.string().min(1, 'Görevi takip eden seçilmeli'),
    assignee: z.string().optional(),
    teamId: z.string().optional(),
    status: z.enum(['todo', 'in-progress', 'done']),
    priority: z.enum(['low', 'medium', 'high']),
    start: z.string(),
    end: z.string(),
    due: z.string().optional(),
    notes: z.string().max(2000, 'Not çok uzun').optional(),
    productLines: z.array(taskProductLineSchema).min(1, 'En az bir ürün kalemi ekleyin'),
    activeProductIndex: z.number().int().min(0).optional(),
    workflowTeamIds: z.array(z.string()).optional(),
    workflowStageTargets: z.array(z.number()).optional(),
    workflowParallel: z.boolean().optional(),
    salesOrderId: z.string().optional(),
    plannedHours: z.preprocess(
      (v) => (v === '' || v === undefined ? 0 : Number(v)),
      z.number().min(0, '>=0 olmalı')
    ),
    plannedCost: z.preprocess(
      (v) => (v === '' || v === undefined ? 0 : Number(v)),
      z.number().min(0, '>=0 olmalı')
    ),
  })
  .refine((v) => new Date(v.end).getTime() >= new Date(v.start).getTime(), {
    message: 'Bitiş tarihi başlangıçtan önce olamaz',
    path: ['end'],
  })
  .refine((v) => !v.due || new Date(v.due).getTime() >= new Date(v.start).getTime(), {
    message: 'Vade tarihi başlangıçtan önce olamaz',
    path: ['due'],
  })
  .superRefine((data, ctx) => {
    data.productLines.forEach((line, i) => {
      if (line.mode === 'fixed' && (!line.modelCode?.trim() || !line.quantity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Sabit modda model ve adet seçilmeli',
          path: ['productLines', i, 'modelCode'],
        })
      }
    })
  })

/** Renk kodu #RGB / #RRGGBB ise önizleme için döner. */
function cssColorFromProductCode(code: string | undefined | null): string | undefined {
  if (!code || typeof code !== 'string') return undefined
  const t = code.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return t
  return undefined
}

const slaStatus = (task: Task) => {
  const due = task.due || task.end
  if (!due) return null
  const diff = new Date(due).getTime() - Date.now()
  const oneDay = 1000 * 60 * 60 * 24
  if (diff < 0) return 'overdue'
  if (diff < oneDay) return 'soon'
  return null
}

function renderMentions(text: string) {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  for (const match of text.matchAll(MENTION_REGEX)) {
    const start = match.index ?? 0
    if (start > lastIndex) parts.push(text.slice(lastIndex, start))
    const handle = match[1]
    parts.push(
      <span key={`${handle}-${start}`} className="font-semibold text-primary">
        @{handle}
      </span>
    )
    lastIndex = start + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

export function TasksPage() {
  const { data, createTask, updateTask, deleteTask } = useAppStore()
  const logAccess = useAppStore((s: any) => s.logAccess)
  const tasks = data.tasks ?? []
  const { toast } = useToast()
  const [notifMuted, setNotifMuted] = useState(false)
  const [status, setStatus] = useState('all')
  const defaultAssignee =
    typeof window !== 'undefined' && data.settings.role === 'Worker'
      ? localStorage.getItem('current-user-id') || 'all'
      : 'all'
  const [assignee, setAssignee] = useState(defaultAssignee)
  const [teamFilter, setTeamFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<'table' | 'board' | 'workload'>('table')
  const [wipLimits, setWipLimits] = useState<Record<Task['status'], number>>(WIP_DEFAULTS)
  const [savedFilters, setSavedFilters] = useState<{ name: string; status: string; assignee: string; team: string }[]>([])
  const [selectedFilter, setSelectedFilter] = useState<string>('none')
  const [filterName, setFilterName] = useState('')
  const [savedBoards, setSavedBoards] = useState<
    { name: string; wip: Record<Task['status'], number>; status: string; assignee: string; team: string }[]
  >([])
  const [boardPick, setBoardPick] = useState('none')

  useEffect(() => {
    const raw = localStorage.getItem('wip-limits')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setWipLimits({ ...WIP_DEFAULTS, ...parsed })
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('wip-limits', JSON.stringify(wipLimits))
  }, [wipLimits])

  useEffect(() => {
    const raw = localStorage.getItem('task-filters')
    if (raw) {
      try {
        setSavedFilters(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('task-filters', JSON.stringify(savedFilters))
  }, [savedFilters])

  useEffect(() => {
    const v = localStorage.getItem('task-view')
    if (v === 'table' || v === 'board' || v === 'workload') setView(v)
    logAccess?.('tasks:view', { view: v || 'table' })
  }, [])

  useEffect(() => {
    localStorage.setItem('task-view', view)
  }, [view])

  useEffect(() => {
    const raw = localStorage.getItem('board-views')
    if (raw) {
      try {
        setSavedBoards(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('board-views', JSON.stringify(savedBoards))
  }, [savedBoards])

  // Worker rolü için varsayılan olarak kendi görevlerini göster
  useEffect(() => {
    if (data.settings.role === 'Worker') {
      const me = typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null
      if (me && assignee !== me) {
        setAssignee(me)
      }
    }
  }, [data.settings.role])

  useEffect(() => {
    // notification settings: mute + slack/email endpoints (only mute used client-side)
    const raw = localStorage.getItem('notification-settings')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setNotifMuted(!!parsed.muted)
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    if (notifMuted) return
    const alertedRaw = sessionStorage.getItem('sla-alerted') || '[]'
    let alerted: string[] = []
    try {
      alerted = JSON.parse(alertedRaw)
    } catch {
      alerted = []
    }
    const soonTasks = tasks.filter((t) => slaStatus(t) === 'soon' && !alerted.includes(t.id))
    if (soonTasks.length === 0) return
    const ids = soonTasks.map((t) => t.id)
    sessionStorage.setItem('sla-alerted', JSON.stringify([...alerted, ...ids]))
    const titles = soonTasks.slice(0, 3).map((t) => t.title).join(', ')
    toast({
      title: 'SLA uyarısı',
      description: `${soonTasks.length} görev 24 saat içinde vade: ${titles}${soonTasks.length > 3 ? '...' : ''}`,
    })
  }, [tasks, notifMuted, toast])

  const filtered = useMemo(() => {
    const me =
      typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null
    const isWorker = data.settings.role === 'Worker'
    return tasks.filter((t) => {
      const assigneeMatch =
        assignee === 'all' ||
        String(t.assignee) === String(assignee) ||
        (isWorker &&
          me &&
          assignee === me &&
          taskVisibleToWorkerTeamMember(t, me, data.teams))
      return (
        (status === 'all' || t.status === status) &&
        assigneeMatch &&
        (teamFilter === 'all' || String(t.teamId) === String(teamFilter)) &&
        (search.trim().length === 0 ||
          t.title.toLowerCase().includes(search.trim().toLowerCase()) ||
          (t.notes || '').toLowerCase().includes(search.trim().toLowerCase()))
      )
    })
  }, [tasks, status, assignee, teamFilter, search, data.settings.role, data.teams])

  const statusCounts = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1
        return acc
      },
      { todo: 0, 'in-progress': 0, done: 0 } as Record<Task['status'], number>
    )
  }, [filtered])

  const slaOverdue = useMemo(() => filtered.filter((t) => slaStatus(t) === 'overdue'), [filtered])
  const slaSoon = useMemo(() => filtered.filter((t) => slaStatus(t) === 'soon'), [filtered])

  const slaTable = useMemo(() => {
    return filtered
      .filter((t) => t.due || t.end)
      .map((t) => ({
        id: t.id,
        title: t.title,
        due: t.due || t.end || '',
        status: t.status,
        priority: t.priority,
        assignee: data.users.find((u) => u.id === t.assignee)?.username || t.assignee || '—',
        sla: slaStatus(t),
      }))
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
      .slice(0, 50)
  }, [filtered, data.users])

  const slaBuckets = useMemo(() => {
    const buckets = new Array(7).fill(0)
    let overdue = 0
    filtered.forEach((t) => {
      const due = t.due || t.end
      if (!due) return
      const diffDays = Math.floor((new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) overdue += 1
      else if (diffDays < 7) buckets[diffDays] += 1
    })
    const labels = ['Bugün', 'Yarın', '2g', '3g', '4g', '5g', '6g+']
    const maxCount = Math.max(overdue, ...buckets, 1)
    return { buckets, labels, overdue, maxCount }
  }, [filtered])

  const timeReportUsers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; totalHours: number; entries: number }
    >()
    filtered.forEach((t) => {
      (t.time_entries || []).forEach((te: any) => {
        const start = te.started_at ? new Date(te.started_at).getTime() : 0
        const end = te.ended_at ? new Date(te.ended_at).getTime() : start
        const hours = Math.max(0, (end - start) / 1000 / 60 / 60)
        const key = te.user || te.user_name || 'unknown'
        const name = te.user_name || te.user || 'Bilinmiyor'
        const cur = map.get(key) || { name, totalHours: 0, entries: 0 }
        cur.totalHours += hours
        cur.entries += 1
        map.set(key, cur)
      })
    })
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
  }, [filtered])

  const timeReportTeams = useMemo(() => {
    const map = new Map<
      string,
      { name: string; totalHours: number; entries: number }
    >()
    filtered.forEach((t) => {
      const teamKey = t.teamId || 'noteam'
      const teamName = t.teamId ? data.teams.find((tm) => tm.id === t.teamId)?.name || 'Ekip' : 'Ekip yok'
      const hours = (t.time_entries || []).reduce((sum, te: any) => {
        const start = te.started_at ? new Date(te.started_at).getTime() : 0
        const end = te.ended_at ? new Date(te.ended_at).getTime() : start
        return sum + Math.max(0, (end - start) / 1000 / 60 / 60)
      }, 0)
      const cur = map.get(teamKey) || { name: teamName, totalHours: 0, entries: 0 }
      cur.totalHours += hours
      cur.entries += (t.time_entries || []).length
      map.set(teamKey, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
  }, [filtered, data.teams])

  const timeBudgetTable = useMemo(() => {
    return filtered
      .map((t) => {
        const planned = Number((t as any).plannedHours || 0)
        const actual = (t.time_entries || []).reduce((sum, te: any) => {
          const start = te.started_at ? new Date(te.started_at).getTime() : 0
          const end = te.ended_at ? new Date(te.ended_at).getTime() : start
          return sum + Math.max(0, (end - start) / 1000 / 60 / 60)
        }, 0)
        return {
          id: t.id,
          title: t.title,
          planned,
          actual,
          delta: actual - planned,
          assignee: data.users.find((u) => u.id === t.assignee)?.username || t.assignee || '—',
        }
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 50)
  }, [filtered, data.users])

  const exportCsv = () => {
    const rows = filtered.map((t) => ({
      Başlık: t.title,
      Durum: taskStatusLabelTR(t.status),
      Öncelik: taskPriorityLabelTR(t.priority),
      Atanan: data.users.find((u) => u.id === t.assignee)?.username || '',
      'Görevi takip eden': data.users.find((u) => u.id === t.owner)?.username || '',
      Ekip: data.teams.find((tm) => tm.id === t.teamId)?.name || '',
      Başlangıç: formatDate(t.start ?? ''),
      Bitiş: formatDate(t.end ?? ''),
      Bitiş_Tarih: formatDate(t.due ?? ''),
    }))
    if (rows.length === 0) {
      toast({ title: 'Dışa aktarılacak kayıt yok' })
      return
    }
    downloadCsv('tasks.csv', rows)
    toast({ title: 'Tablo hazır', description: `${rows.length} kayıt (CSV)` })
  }

  const exportICS = () => {
    const events = filtered
      .filter((t) => t.start || t.due || t.end)
      .map((t) => ({
        uid: `${t.id}@udarcrm`,
        summary: t.title,
        description: `Durum: ${taskStatusLabelTR(t.status)} • Öncelik: ${taskPriorityLabelTR(t.priority)}`,
        start: t.start || t.due || t.end || new Date().toISOString(),
        end: t.end || undefined,
      }))
    if (events.length === 0) {
      toast({ title: 'Takvime aktarılacak kayıt yok' })
      return
    }
    downloadICS('tasks.ics', events)
    toast({ title: 'ICS hazır', description: `${events.length} görev` })
  }

  const workloadUsers = useMemo(() => {
    const base = filtered
    const map = new Map<
      string,
      { name: string; total: number; todo: number; inProgress: number; done: number }
    >()
    base.forEach((t) => {
      const key = t.assignee || 'unassigned'
      const name = data.users.find((u) => u.id === t.assignee)?.username || 'Atanmamış'
      const entry = map.get(key) || { name, total: 0, todo: 0, inProgress: 0, done: 0 }
      entry.total += 1
      if (t.status === 'todo') entry.todo += 1
      else if (t.status === 'in-progress') entry.inProgress += 1
      else if (t.status === 'done') entry.done += 1
      map.set(key, entry)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered, data.users])

  const workloadTeams = useMemo(() => {
    const base = filtered
    const map = new Map<
      string,
      { name: string; total: number; todo: number; inProgress: number; done: number }
    >()
    base.forEach((t) => {
      const key = t.teamId || 'noteam'
      const name = t.teamId ? data.teams.find((tm) => tm.id === t.teamId)?.name || 'Ekip' : 'Ekip yok'
      const entry = map.get(key) || { name, total: 0, todo: 0, inProgress: 0, done: 0 }
      entry.total += 1
      if (t.status === 'todo') entry.todo += 1
      else if (t.status === 'in-progress') entry.inProgress += 1
      else if (t.status === 'done') entry.done += 1
      map.set(key, entry)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered, data.teams])

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: 'Görev',
      cell: ({ row }) => (
        <button
          onClick={() => window.location.href = `/tasks/${row.original.id}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0"
        >
          {row.original.title}
        </button>
      ),
    },
    {
      accessorKey: 'assignee',
      header: 'Atanan',
      cell: ({ row }) => data.users.find((u) => u.id === row.original.assignee)?.username ?? row.original.assignee,
    },
    {
      accessorKey: 'owner',
      header: 'Görevi takip eden',
      cell: ({ row }) => data.users.find((u) => u.id === row.original.owner)?.username ?? row.original.owner,
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <Badge variant="secondary">{taskStatusLabelTR(row.original.status)}</Badge>,
    },
    {
      accessorKey: 'priority',
      header: 'Öncelik',
      cell: ({ row }) => <Badge variant="outline">{taskPriorityLabelTR(row.original.priority)}</Badge>,
    },
    { accessorKey: 'start', header: 'Başlangıç', cell: ({ row }) => formatDate(row.original.start ?? '') },
    { accessorKey: 'end', header: 'Bitiş', cell: ({ row }) => formatDate(row.original.end ?? '') },
    {
      id: 'sla',
      header: 'SLA',
      cell: ({ row }) => {
        const sla = slaStatus(row.original)
        if (!sla) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <Badge variant={sla === 'overdue' ? 'destructive' : 'default'}>{taskSlaBucketLabelTR(sla)}</Badge>
        )
      },
    },
    {
      accessorKey: 'teamId',
      header: 'Ekip',
      cell: ({ row }) => data.teams.find((t) => t.id === row.original.teamId)?.name ?? '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = `/tasks/${row.original.id}`}
            className="text-xs text-blue-600 underline underline-offset-4 cursor-pointer bg-transparent border-none p-0"
          >
            Detay
          </button>
          {data.settings.role !== 'Worker' && (
            <RbacGuard perm="tasks.edit">
              <TaskModal
                task={row.original}
                users={data.users}
                teams={data.teams}
                salesOrders={data.salesOrders}
                uploading={uploading}
                setUploading={setUploading}
                onSubmit={(values) => {
                  updateTask(row.original.id, values)
                  toast({ title: 'Görev güncellendi' })
                }}
              >
                <Button variant="ghost" size="sm">
                  Düzenle
                </Button>
              </TaskModal>
              <Button variant="ghost" size="sm" onClick={() => deleteTask(row.original.id)}>
                Sil
              </Button>
            </RbacGuard>
          )}
        </div>
      ),
    },
  ]

  const boardStatuses: Task['status'][] = ['todo', 'in-progress', 'done']

  const handleDrop = (newStatus: Task['status'], forcedId?: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const id = forcedId || e.dataTransfer.getData('text/plain')
    if (!id) return
    const moving = tasks.find((t) => t.id === id)
    if (moving && moving.status !== newStatus && statusCounts[newStatus] >= wipLimits[newStatus]) {
      toast({
        title: 'WIP limiti dolu',
        description: `${taskStatusLabelTR(newStatus)} sütunu için limit: ${wipLimits[newStatus]}`,
        variant: 'destructive',
      })
      return
    }
    updateTask(id, { status: newStatus })
  }

  const applySavedFilter = (name: string) => {
    if (name === 'none') return
    const f = savedFilters.find((x) => x.name === name)
    if (!f) return
    setStatus(f.status)
    setAssignee(f.assignee)
    setTeamFilter(f.team)
    setSelectedFilter(name)
  }

  const saveCurrentFilter = (name?: string) => {
    const finalName = name ?? prompt('Filtre adı:', 'Favori filtre')
    if (!finalName) return
    const next = [...savedFilters.filter((f) => f.name !== finalName), { name: finalName, status, assignee, team: teamFilter }]
    setSavedFilters(next)
    setSelectedFilter(finalName)
    toast({ title: 'Filtre kaydedildi', description: finalName })
  }

  const deleteSavedFilter = () => {
    if (selectedFilter === 'none') return
    setSavedFilters((prev) => prev.filter((f) => f.name !== selectedFilter))
    setSelectedFilter('none')
  }

  const saveBoardView = (name?: string) => {
    const finalName = name ?? prompt('Board görünüm adı:', 'Kanban görünüm')
    if (!finalName) return
    const viewState = { name: finalName, wip: wipLimits, status, assignee, team: teamFilter }
    setSavedBoards((prev) => [...prev.filter((b) => b.name !== finalName), viewState])
    setBoardPick(finalName)
    toast({ title: 'Board kaydedildi', description: finalName })
  }

  const applyBoardView = (name: string) => {
    if (name === 'none') return
    const v = savedBoards.find((b) => b.name === name)
    if (!v) return
    setWipLimits(v.wip)
    setStatus(v.status)
    setAssignee(v.assignee)
    setTeamFilter(v.team)
    setBoardPick(name)
    toast({ title: 'Board yüklendi', description: name })
  }

  const deleteBoardView = () => {
    if (boardPick === 'none') return
    setSavedBoards((prev) => prev.filter((b) => b.name !== boardPick))
    setBoardPick('none')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Görevler"
        description="Sorumlu atama, başlangıç/bitiş takibi"
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList>
                <TabsTrigger value="table">Liste</TabsTrigger>
                <TabsTrigger value="board">Kanban</TabsTrigger>
                <TabsTrigger value="workload">İş yükü</TabsTrigger>
              </TabsList>
            </Tabs>
            {data.settings.role !== 'Worker' && (
              <RbacGuard perm="tasks.edit">
                <TaskModal
                  users={data.users}
                  teams={data.teams}
                  salesOrders={data.salesOrders}
                  uploading={uploading}
                  setUploading={setUploading}
                  onSubmit={async (values) => {
                    try {
                      await createTask(values as any)
                      toast({ title: 'Görev oluşturuldu' })
                    } catch (err: any) {
                      const d = err?.response?.data
                      const msg =
                        (typeof d === 'object' && d && !Array.isArray(d)
                          ? Object.entries(d)
                              .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as string[])[0] : v}`)
                              .join('; ')
                          : null) ||
                        d?.detail ||
                        err?.message
                      toast({
                        title: 'Görev oluşturulamadı',
                        description: msg || 'Kayıt başarısız veya sunucu hatası',
                        variant: 'destructive',
                      })
                    }
                  }}
                >
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Görev oluştur
                  </Button>
                </TaskModal>
              </RbacGuard>
            )}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Tabloyu dışa aktar (CSV)
          </Button>
          <Button size="sm" variant="outline" onClick={exportICS}>
            <Calendar className="mr-2 h-4 w-4" />
            ICS dışa aktar
          </Button>
            <Button
              size="sm"
              variant={notifMuted ? 'secondary' : 'outline'}
              onClick={() => {
                const next = !notifMuted
                setNotifMuted(next)
                localStorage.setItem('notification-settings', JSON.stringify({ muted: next }))
                toast({ title: next ? 'Bildirimler sessize alındı' : 'Bildirimler açık' })
              }}
            >
              {notifMuted ? 'Sessiz (aç)' : 'Sessize al'}
            </Button>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">WIP · Yapılacak</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{statusCounts.todo}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">WIP · Devam ediyor</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{statusCounts['in-progress']}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">SLA gecikmiş</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{slaOverdue.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">SLA · 24 saat içinde</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{slaSoon.length}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>SLA listesi</CardTitle>
          <CardDescription>Geciken ve 24 saat içinde vadesi gelen görevler</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-destructive">Geciken</p>
            {slaOverdue.slice(0, 5).map((t) => (
              <div key={t.id} className="mt-2 flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>{t.title}</span>
                <Badge variant="destructive">Gecikti</Badge>
              </div>
            ))}
            {slaOverdue.length === 0 && <p className="text-xs text-muted-foreground mt-2">Kayıt yok</p>}
          </div>
          <div>
            <p className="text-sm font-semibold">24 saat içinde</p>
            {slaSoon.slice(0, 5).map((t) => (
              <div key={t.id} className="mt-2 flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>{t.title}</span>
                <Badge variant="secondary">Yaklaşıyor</Badge>
              </div>
            ))}
            {slaSoon.length === 0 && <p className="text-xs text-muted-foreground mt-2">Kayıt yok</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SLA ısı haritası (7 gün)</CardTitle>
          <CardDescription>Gün bazlı SLA yükü</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <div className="rounded border p-3">
            <p className="text-sm font-semibold text-destructive mb-2">Geciken</p>
            <div className="h-10 w-full rounded bg-destructive/10 flex items-center justify-center font-semibold text-destructive">
              {slaBuckets.overdue}
            </div>
          </div>
          {slaBuckets.labels.map((label, idx) => {
            const count = slaBuckets.buckets[idx]
            const intensity = Math.min(1, count / slaBuckets.maxCount)
            const bg = `rgba(59,130,246,${0.15 + 0.6 * intensity})`
            return (
              <div key={label} className="rounded border p-3">
                <p className="text-sm font-semibold mb-2">{label}</p>
                <div className="h-10 w-full rounded flex items-center justify-center font-semibold" style={{ backgroundColor: bg }}>
                  {count}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SLA detay tablosu</CardTitle>
          <CardDescription>En yakın 50 görev (due/end tarihine göre sıralı)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 text-left">Görev</th>
                <th className="py-2 text-left">Due/End</th>
                <th className="py-2 text-left">SLA</th>
                <th className="py-2 text-left">Durum</th>
                <th className="py-2 text-left">Öncelik</th>
                <th className="py-2 text-left">Atanan</th>
              </tr>
            </thead>
            <tbody>
              {slaTable.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2">{row.title}</td>
                  <td className="py-2">{formatDate(row.due)}</td>
                  <td className="py-2">
                    <Badge variant={row.sla === 'overdue' ? 'destructive' : row.sla === 'soon' ? 'secondary' : 'outline'}>
                      {row.sla ? taskSlaBucketLabelTR(row.sla) : '—'}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Badge variant="outline">{taskStatusLabelTR(row.status)}</Badge>
                  </td>
                  <td className="py-2">
                    <Badge variant="secondary">{taskPriorityLabelTR(row.priority)}</Badge>
                  </td>
                  <td className="py-2">{row.assignee}</td>
                </tr>
              ))}
              {slaTable.length === 0 && (
                <tr>
                  <td className="py-3 text-muted-foreground text-center" colSpan={6}>
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ara (başlık/not)"
          className="w-48"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            <SelectItem value="todo">Yapılacak</SelectItem>
            <SelectItem value="in-progress">Devam ediyor</SelectItem>
            <SelectItem value="done">Tamamlandı</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Atanan" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value="all">Herkes</SelectItem>
            {data.users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Ekip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm ekipler</SelectItem>
            {data.teams.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filtre adı"
            className="h-8 w-36"
          />
          <Button size="sm" variant="outline" onClick={() => saveCurrentFilter(filterName)}>
            Kaydet
          </Button>
          <Select value={selectedFilter} onValueChange={applySavedFilter}>
            <SelectTrigger className="w-44 h-8">
              <SelectValue placeholder="Kaydedilmiş filtre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Seçilmedi</SelectItem>
              {savedFilters.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={deleteSavedFilter}>
            Sil
          </Button>
          {view === 'board' && (
            <>
              <Button size="sm" variant="outline" onClick={() => saveBoardView()}>
                Board kaydet
              </Button>
              <Select value={boardPick} onValueChange={applyBoardView}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="Board görünümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçilmedi</SelectItem>
                  {savedBoards.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={deleteBoardView}>
                Board sil
              </Button>
            </>
          )}
        </div>
      </div>

      {view === 'table' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Görev listesi</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {filtered.filter((t) => t.status !== 'done').length} açık görev
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <DataTable columns={columns} data={filtered} />
            </div>
          </CardContent>
        </Card>
      ) : view === 'board' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {(['todo', 'in-progress', 'done'] as Task['status'][]).map((st) => (
              <div key={st} className="flex items-center gap-2 rounded border px-2 py-1">
                <span className="font-medium">{taskStatusLabelTR(st)}</span>
                <Input
                  type="number"
                  className="h-8 w-20"
                  value={wipLimits[st]}
                  onChange={(e) => setWipLimits((prev) => ({ ...prev, [st]: Math.max(1, Number(e.target.value) || 1) }))}
                />
                <span>
                  {statusCounts[st]}/{wipLimits[st]}
                </span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
          {boardStatuses.map((st) => (
            <Card
              key={st}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(st)}
              className="min-h-[320px] border-dashed"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{taskStatusLabelTR(st)}</CardTitle>
                  <Badge variant={statusCounts[st] > wipLimits[st] ? 'destructive' : 'secondary'}>
                    {statusCounts[st]}/{wipLimits[st]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.filter((t) => t.status === st).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id)
                    }}
                    onClick={() => window.location.href = `/tasks/${t.id}`}
                    className={cn(
                      'block rounded-lg border bg-card/80 p-3 shadow-sm hover:border-primary/60 hover:shadow-md transition-all cursor-pointer',
                      slaStatus(t) === 'overdue' && 'border-destructive/70'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{t.title}</p>
                      <div className="flex items-center gap-2">
                        {slaStatus(t) && (
                          <Badge variant={slaStatus(t) === 'overdue' ? 'destructive' : 'secondary'}>
                            {taskSlaBucketLabelTR(slaStatus(t)!)}
                          </Badge>
                        )}
                        <Badge variant="outline">{taskPriorityLabelTR(t.priority)}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Atanan: {data.users.find((u) => u.id === t.assignee)?.username || '—'}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={t.priority}
                        onValueChange={(v) => updateTask(t.id, { priority: v as Task['priority'] })}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue placeholder="Öncelik" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Düşük</SelectItem>
                          <SelectItem value="medium">Orta</SelectItem>
                          <SelectItem value="high">Yüksek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault()
                          updateTask(t.id, { status: st === 'todo' ? 'in-progress' : 'done' })
                        }}
                      >
                        {st === 'todo' ? 'Başlat' : 'Tamamla'}
                      </Button>
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        {(t.tags || []).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        <Input
                          placeholder="Etiket ekle"
                          className="h-7 w-24"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const val = e.currentTarget.value.trim()
                              if (!val) return
                              const nextTags = Array.from(new Set([...(t.tags || []), val]))
                              updateTask(t.id, { tags: nextTags })
                              e.currentTarget.value = ''
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>İş yükü (kullanıcı)</CardTitle>
              <CardDescription>Atanan görevlere göre dağılım</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {workloadUsers.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
              {workloadUsers.map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Yapılacak {row.todo} · Devam {row.inProgress} · Tamamlandı {row.done}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{row.total}</p>
                    <p className="text-xs text-muted-foreground">toplam görev</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>İş yükü (ekip)</CardTitle>
              <CardDescription>Ekip bazlı dağılım</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {workloadTeams.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
              {workloadTeams.map((row, idx) => (
                <div key={`${row.name}-${idx}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Yapılacak {row.todo} · Devam {row.inProgress} · Tamamlandı {row.done}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{row.total}</p>
                    <p className="text-xs text-muted-foreground">toplam görev</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Zaman raporu (kullanıcı)</CardTitle>
              <CardDescription>Time entry toplam saat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (timeReportUsers.length === 0) {
                      toast({ title: 'Kayıt yok' })
                      return
                    }
                    const rows = timeReportUsers.map((r) => ({
                      Kullanıcı: r.name,
                      Saat: r.totalHours.toFixed(2),
                      Giris: r.entries,
                    }))
                    downloadCsv('time-users.csv', rows)
                    toast({ title: 'Tablo hazır', description: `${rows.length} satır (CSV)` })
                  }}
                >
                  Dışa aktar
                </Button>
              </div>
              {timeReportUsers.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
              {timeReportUsers.map((row, idx) => (
                <div key={`${row.name}-${idx}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">Giriş: {row.entries}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{row.totalHours.toFixed(1)}s</p>
                    <p className="text-xs text-muted-foreground">toplam saat</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Zaman raporu (ekip)</CardTitle>
              <CardDescription>Ekip bazlı toplam saat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (timeReportTeams.length === 0) {
                      toast({ title: 'Kayıt yok' })
                      return
                    }
                    const rows = timeReportTeams.map((r) => ({
                      Ekip: r.name,
                      Saat: r.totalHours.toFixed(2),
                      Giris: r.entries,
                    }))
                    downloadCsv('time-teams.csv', rows)
                    toast({ title: 'Tablo hazır', description: `${rows.length} satır (CSV)` })
                  }}
                >
                  Dışa aktar
                </Button>
              </div>
              {timeReportTeams.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
              {timeReportTeams.map((row, idx) => (
                <div key={`${row.name}-${idx}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">Giriş: {row.entries}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{row.totalHours.toFixed(1)}s</p>
                    <p className="text-xs text-muted-foreground">toplam saat</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Bütçe / Planlanan vs Gerçekleşen</CardTitle>
              <CardDescription>İlk 50 görev, en yüksek sapmaya göre sıralı</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (timeBudgetTable.length === 0) {
                      toast({ title: 'Kayıt yok' })
                      return
                    }
                    const rows = timeBudgetTable.map((r) => ({
                      Gorev: r.title,
                      Planlanan_saat: r.planned,
                      Gerceklesen_saat: r.actual.toFixed(2),
                      Delta: r.delta.toFixed(2),
                      Atanan: r.assignee,
                    }))
                    downloadCsv('time-budget.csv', rows)
                    toast({ title: 'Tablo hazır', description: `${rows.length} satır (CSV)` })
                  }}
                >
                  Dışa aktar
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">Görev</th>
                      <th className="py-2 text-left">Planlanan</th>
                      <th className="py-2 text-left">Gerçekleşen</th>
                      <th className="py-2 text-left">Delta</th>
                      <th className="py-2 text-left">Atanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeBudgetTable.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2">{row.title}</td>
                        <td className="py-2">{row.planned}</td>
                        <td className="py-2">{row.actual.toFixed(2)}</td>
                        <td className={`py-2 ${row.delta > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {row.delta.toFixed(2)}
                        </td>
                        <td className="py-2">{row.assignee}</td>
                      </tr>
                    ))}
                    {timeBudgetTable.length === 0 && (
                      <tr>
                        <td className="py-3 text-muted-foreground text-center" colSpan={5}>
                          Kayıt yok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function WorkflowStepsEditor({
  teams,
  teamIds,
  targets,
  defaultTargetQty,
  onTeamsChange,
  onTargetsChange,
}: {
  teams: { id: string; name: string }[]
  teamIds: string[]
  targets: number[]
  defaultTargetQty: number
  onTeamsChange: (ids: string[]) => void
  onTargetsChange: (t: number[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const steps = teamIds.length ? teamIds : []
  const tg = targets.length === steps.length ? targets : steps.map((_, i) => targets[i] ?? defaultTargetQty)
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = steps.findIndex((_, i) => `step-${i}` === String(active.id))
    const newIdx = steps.findIndex((_, i) => `step-${i}` === String(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    onTeamsChange(arrayMove([...steps], oldIdx, newIdx))
    onTargetsChange(arrayMove([...tg], oldIdx, newIdx))
  }
  const updateStep = (idx: number, teamId: string) => {
    const next = [...steps]
    next[idx] = teamId
    onTeamsChange(next)
  }
  const updateTarget = (idx: number, n: number) => {
    const next = [...tg]
    next[idx] = n
    onTargetsChange(next)
  }
  const removeStep = (idx: number) => {
    onTeamsChange(steps.filter((_, i) => i !== idx))
    onTargetsChange(tg.filter((_, i) => i !== idx))
  }
  const addStep = () => {
    onTeamsChange([...steps, ''])
    onTargetsChange([...tg, defaultTargetQty])
  }
  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((_, i) => `step-${i}`)} strategy={verticalListSortingStrategy}>
          {steps.map((teamId, i) => (
            <SortableWorkflowStep
              key={`step-${i}`}
              id={`step-${i}`}
              teamId={teamId}
              targetQty={tg[i] ?? defaultTargetQty}
              teams={teams}
              onTeamChange={(v) => updateStep(i, v)}
              onTargetChange={(n) => updateTarget(i, n)}
              onRemove={() => removeStep(i)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={addStep}>
        <Plus className="mr-2 h-4 w-4" />
        Adım ekle
      </Button>
    </div>
  )
}

function SortableWorkflowStep({
  id,
  teamId,
  targetQty,
  teams,
  onTeamChange,
  onTargetChange,
  onRemove,
}: {
  id: string
  teamId: string
  targetQty: number
  teams: { id: string; name: string }[]
  onTeamChange: (teamId: string) => void
  onTargetChange: (n: number) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded border px-3 py-2',
        isDragging && 'opacity-70 shadow-md z-10 bg-background'
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        aria-label="Sırayı değiştir"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <Select value={teamId || 'none'} onValueChange={(v) => onTeamChange(v === 'none' ? '' : v)}>
        <SelectTrigger className="flex-1 min-w-[8rem]">
          <SelectValue placeholder="Ekip seç" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Ekip seç —</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-0.5">
        <Label className="text-[10px] text-muted-foreground">Hedef adet</Label>
        <Input
          type="number"
          min={0}
          className="h-8 w-20"
          value={targetQty}
          onChange={(e) => onTargetChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onRemove} aria-label="Kaldır">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function WorkflowChecklistRow({ item }: { item: TaskChecklistItem }) {
  return (
    <div className="flex items-center gap-3 rounded border border-dashed border-muted-foreground/30 bg-muted/15 px-3 py-2">
      <span className="inline-flex shrink-0" title="İş akışı sırası — sürüklenemez">
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
      </span>
      <Checkbox checked={item.done} disabled title="Aşama tamamlanınca otomatik işaretlenir" />
      <span className={`text-sm flex-1 ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Akış</span>
    </div>
  )
}

function SortableChecklistItem({
  item,
  onToggle,
  onDelete,
}: {
  item: TaskChecklistItem
  onToggle: (checked: boolean) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded border px-3 py-2',
        isDragging && 'opacity-70 shadow-md z-10'
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground mr-1"
        aria-label="Sırayı değiştir"
      >
        ⋮⋮
      </span>
      <Checkbox checked={item.done} onCheckedChange={(c) => onToggle(Boolean(c))} />
      <span className={`text-sm flex-1 ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={onDelete}
        aria-label="Sil"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function TaskDetailPage() {
  const { taskId } = useParams({ from: '/tasks/$taskId' })
  const { data, updateTask, addTaskComment, addChecklistItem, toggleChecklistItem, deleteChecklistItem, reorderChecklistItems, deleteAttachment, addTimeEntry, updateAttachment, hydrateFromApi } =
    useAppStore()
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const task = data.tasks.find((t) => t.id === taskId)
  const { toast } = useToast()
  const quantityInitial = task?.quantity ?? 1
  const [comment, setComment] = useState('')
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'comment' | 'activity' | 'attachment'>('all')
  const [checkTitle, setCheckTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('onboarding')
  const [qtyEdit, setQtyEdit] = useState<number>(Number(quantityInitial))
  const [handoverTeam, setHandoverTeam] = useState<string>((task as any)?.currentTeam || task?.teamId || 'none')
  const [handoverAssignee, setHandoverAssignee] = useState<string>(task?.assignee || 'none')
  const [handoverNote, setHandoverNote] = useState<string>('')
  const [prodQty, setProdQty] = useState('1')
  const [prodDate, setProdDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lineProdInput, setLineProdInput] = useState<Record<number, { q: string; d: string }>>({})
  const [claimBusy, setClaimBusy] = useState(false)
  const [productionShortfallNote, setProductionShortfallNote] = useState('')
  useEffect(() => {
    setProdQty('1')
    setProdDate(new Date().toISOString().slice(0, 10))
    setLineProdInput({})
  }, [taskId])
  if (!task) {
    return (
      <div className="space-y-2">
        <PageHeader title="Görev bulunamadı" />
      </div>
    )
  }
  const ownerName = data.users.find((u) => u.id === task.owner)?.username || task.owner || '—'
  const assigneeName = data.users.find((u) => u.id === task.assignee)?.username || task.assignee || '—'
  const teamName = task.teamId ? data.teams.find((t) => t.id === task.teamId)?.name : '—'
  const productLineQtyTotal = sumProductLineQuantities(task.productLines)
  const productLineProducedTotal = sumProductLineQtyProduced(task.productLines)
  const workflowQtyFallback = workflowTargetFallbackQty(task)
  const currentTeamName = data.teams.find((t) => t.id === task.currentTeam)?.name || ''
  const isPvcStage = /pvc/i.test(currentTeamName)
  const showCncTechFields =
    /cnc/i.test(currentTeamName) || data.settings.role === 'Admin' || data.settings.role === 'Manager'
  const linkedSalesOrder =
    task.salesOrder != null && String(task.salesOrder).trim() !== ''
      ? data.salesOrders.find((s) => s.id === task.salesOrder)
      : undefined
  const salesOrderOrderQty = linkedSalesOrder?.orderQuantity ?? 0
  const salesOrderProduced = linkedSalesOrder?.quantityProduced ?? 0
  const salesOrderRemaining =
    salesOrderOrderQty > 0 ? Math.max(0, salesOrderOrderQty - salesOrderProduced) : null
  const salesOrderFulfilled = salesOrderOrderQty > 0 && salesOrderProduced >= salesOrderOrderQty
  const defaultLineUnit = (task.productLines?.[0]?.unitType === 'metre' || isPvcStage) ? 'metre' : 'adet'
  const checklist = (task.checklist || []) as TaskChecklistItem[]
  const workflowChecklistItems = [...checklist]
    .filter((c) => c.workflowTeamId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const manualChecklistItems = [...checklist]
    .filter((c) => !c.workflowTeamId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const checklistDisplay = [...workflowChecklistItems, ...manualChecklistItems]
  const doneCount = checklist.filter((c) => c.done).length
  const completionPct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0
  const timeEntries: TaskTimeEntry[] = task.time_entries || []
  const openEntry = timeEntries.find((te) => !te.ended_at)
  const totalMs = timeEntries.reduce((sum, te) => {
    const end = te.ended_at ? new Date(te.ended_at).getTime() : Date.now()
    const start = te.started_at ? new Date(te.started_at).getTime() : end
    return sum + Math.max(0, end - start)
  }, 0)
  const totalHours = (totalMs / 1000 / 60 / 60).toFixed(1)
  const timelineAll = [
    ...(task.comments || []).map((c) => ({
      id: `c-${c.id}`,
      type: c.type || 'comment',
      author: c.authorName || c.author || 'Sistem',
      text: c.text,
      at: c.createdAt || '',
    })),
    ...(task.attachments || []).map((a) => ({
      id: `a-${a.id}`,
      type: 'attachment' as const,
      author: a.uploadedBy || '—',
      text: a.description || a.file.split('/').pop() || 'Ek',
      at: a.uploadedAt || '',
      href: a.file,
    })),
    ...(task.history || []).map((h: any, idx: number) => ({
      id: `h-${idx}`,
      type: 'activity' as const,
      author: h.actor || 'Sistem',
      text: h.text || '',
      at: h.at || '',
    })),
  ].filter((i) => i.at)

  const timelineCounts = {
    all: timelineAll.length,
    comment: timelineAll.filter((i) => i.type === 'comment').length,
    activity: timelineAll.filter((i) => i.type === 'activity').length,
    attachment: timelineAll.filter((i) => i.type === 'attachment').length,
  }

  const timeline = timelineAll
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .filter((i) => (timelineFilter === 'all' ? true : i.type === timelineFilter))

  const refreshTask = async () => {
    await hydrateFromApi()
  }

  const handleClaim = async () => {
    if (claimBusy) {
      toast({ title: 'İşlem sürüyor', description: 'Lütfen bekleyin.', variant: 'destructive' })
      return
    }
    setClaimBusy(true)
    try {
      await api.post(`/tasks/${task.id}/claim/`)
      await refreshTask()
      toast({ title: 'Görev üstlenildi' })
    } catch (e: any) {
      const msg = e?.response?.data?.detail
      toast({
        title: 'Üstlenilemedi',
        description: typeof msg === 'string' ? msg : 'Görev başka bir çalışana atanmış veya havuzda değil.',
        variant: 'destructive',
      })
    } finally {
      setClaimBusy(false)
    }
  }

  const handleHandover = async () => {
    await api.post(`/tasks/${task.id}/handover/`, {
      team: handoverTeam && handoverTeam !== 'none' ? handoverTeam : null,
      assignee: handoverAssignee && handoverAssignee !== 'none' ? handoverAssignee : null,
      note: handoverNote || '',
    })
    await refreshTask()
    toast({ title: 'Görev devredildi' })
  }

  const handleSelfHandover = async () => {
    if (!handoverTeam || handoverTeam === 'none') {
      toast({ title: 'Hata', description: 'Hedef takım seçilmeli', variant: 'destructive' })
      return
    }
    await api.post(`/tasks/${task.id}/self_handover/`, {
      team: handoverTeam,
      reason: handoverNote || 'Bölüm değişimi - başka alanda çalışıyorum',
    })
    await refreshTask()
    toast({ title: '🔄 Görev devredildi', description: 'Başka bölümde çalışma kaydedildi' })
  }

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null
  const isAssignee = currentUserId && String(task.assignee) === String(currentUserId)
  const isWorker = data.settings.role === 'Worker'
  const isAdmin = data.settings.role === 'Admin'
  const hasWfTeams = (task.workflowTeamIds?.length ?? 0) > 0
  const sequentialFlow = hasWfTeams && !task.workflowParallel
  const curTeamRowForSeq = task.currentTeam ? data.teams.find((t) => t.id === task.currentTeam) : undefined
  const inCurrentWorkflowTeam = !!(
    currentUserId &&
    (curTeamRowForSeq?.memberIds?.includes(String(currentUserId)) ||
      (curTeamRowForSeq?.leaderId && String(curTeamRowForSeq.leaderId) === String(currentUserId)))
  )
  const curStageSt = task.currentTeam ? task.workflowStageState?.[task.currentTeam] : undefined
  const mayClaimTask =
    task.status !== 'done' && workerMayClaimTask(task, currentUserId, data.teams, data.settings.role)
  const canSubmitSequentialApproval =
    sequentialFlow &&
    task.status === 'in-progress' &&
    !!task.currentTeam &&
    !!task.assignee &&
    inCurrentWorkflowTeam &&
    !curStageSt?.stage_done &&
    !curStageSt?.pending_approval

  const wfState = task.workflowStageState || {}
  const pendingSectionTeamIds = Object.entries(wfState)
    .filter(([_, st]) => st?.pending_approval && !st?.stage_done)
    .map(([k]) => k)
  const isLeaderOfTeamId = (teamId: string) => {
    const row = data.teams.find((t) => t.id === teamId)
    return !!(currentUserId && row?.leaderId && String(row.leaderId) === String(currentUserId))
  }

  const wfStateForGate = task.workflowStageState || {}
  const needsShortfallNoteForComplete = (() => {
    if (task.status !== 'in-progress' || !hasWfTeams) return false
    if (canSubmitSequentialApproval && task.currentTeam) {
      const st = wfStateForGate[task.currentTeam] || {}
      const tgt = Number(st.qty_target ?? 0) || workflowQtyFallback || 1
      const done = Number(st.qty_done ?? 0)
      return done < tgt
    }
    if (task.workflowParallel && isAssignee) {
      const uid = currentUserId ? Number(currentUserId) : NaN
      for (const tid of task.workflowTeamIds || []) {
        const st = wfStateForGate[tid] || {}
        if (st.assignee_id != null && Number(st.assignee_id) === uid && !st.stage_done && !st.pending_approval) {
          const tgt = Number(st.qty_target ?? 0) || workflowQtyFallback || 1
          const done = Number(st.qty_done ?? 0)
          return done < tgt
        }
      }
    }
    return false
  })()

  const sequentialProdLocked = sequentialFlow && !!task.currentTeam && !task.assignee

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Görev: ${task.title}`}
        description={`Durum: ${taskStatusLabelTR(task.status)} • Öncelik: ${taskPriorityLabelTR(task.priority)}`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Detaylar</CardTitle>
          <CardDescription>Görevi takip eden, atanan, tarih ve ekler. Ürün renkleri her ürün kaleminde gösterilir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border p-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{isWorker ? 'Görev' : 'Görev üstlenme / devir'}</p>
                <p className="text-xs text-muted-foreground">
                  Aktif takım: {data.teams.find((t) => t.id === (task as any)?.currentTeam)?.name || teamName || '—'}
                  {sequentialProdLocked && (
                    <span className="block text-amber-700 dark:text-amber-400 mt-1">
                      Sıralı akış: Bu aşamada önce usta başı görevi «Üstlen» ile kabul etmeli; ardından üretim ve onaya gönderme
                      açılır.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(isAssignee || canSubmitSequentialApproval) && task.status !== 'done' ? (
                  <>
                    {isAssignee && task.status === 'todo' && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await updateTask(task.id, { status: 'in-progress' })
                          toast({ title: 'Görev başlatıldı' })
                        }}
                      >
                        Başlat
                      </Button>
                    )}
                    {task.status === 'in-progress' &&
                      ((task.workflowParallel && inCurrentWorkflowTeam) ||
                        canSubmitSequentialApproval ||
                        (!hasWfTeams && isAssignee)) && (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          {needsShortfallNoteForComplete && (
                            <div className="w-full max-w-md space-y-1">
                              <Label className="text-xs text-amber-700 dark:text-amber-400">
                                Üretim hedefinin altındasınız — onaya göndermek için gerekçe zorunlu
                              </Label>
                              <Textarea
                                value={productionShortfallNote}
                                onChange={(e) => setProductionShortfallNote(e.target.value)}
                                placeholder="Örn: malzeme gecikmesi, revizyon, fire…"
                                className="min-h-[72px] text-sm"
                              />
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={async () => {
                              if (needsShortfallNoteForComplete && !productionShortfallNote.trim()) {
                                toast({
                                  title: 'Gerekçe gerekli',
                                  description: 'Hedef adedin altında tamamlıyorsanız üretim eksikliği gerekçesini yazın.',
                                  variant: 'destructive',
                                })
                                return
                              }
                              try {
                                const body =
                                  needsShortfallNoteForComplete && productionShortfallNote.trim()
                                    ? { production_shortfall_reason: productionShortfallNote.trim() }
                                    : {}
                                await api.post(`/tasks/${task.id}/complete-stage/`, body)
                                setProductionShortfallNote('')
                                await hydrateFromApi()
                                const toApproval = canSubmitSequentialApproval
                                toast({
                                  title: toApproval ? 'Onaya gönderildi' : 'Aşama tamamlandı',
                                  description: toApproval
                                    ? sequentialFlow
                                      ? 'Usta başı «Bölümü onayla» ile sıradaki ekibe geçilir.'
                                      : undefined
                                    : undefined,
                                })
                              } catch (e: any) {
                                toast({
                                  title: 'İşlem yapılamadı',
                                  description: e?.response?.data?.detail || String(e?.message || e),
                                  variant: 'destructive',
                                })
                              }
                            }}
                          >
                            {canSubmitSequentialApproval
                              ? 'Bölümü bitir (onaya gönder)'
                              : 'Bitir'}
                          </Button>
                        </div>
                      )}
                    {!isWorker && (
                      <>
                        <Button size="sm" variant="outline" onClick={handleHandover}>
                          Devret
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleSelfHandover}>
                          🔄 Başka bölümde çalışıyorum
                        </Button>
                      </>
                    )}
                  </>
                ) : isWorker && mayClaimTask ? (
                  <Button size="sm" onClick={handleClaim} disabled={claimBusy}>
                    {claimBusy ? '…' : 'Üstlen'}
                  </Button>
                ) : !isWorker && mayClaimTask ? (
                  <Button size="sm" onClick={handleClaim} disabled={claimBusy}>
                    {claimBusy ? '…' : 'Ben üstleniyorum'}
                  </Button>
                ) : null}
              </div>
            </div>
            {sequentialFlow &&
              pendingSectionTeamIds.filter(
                (tid) =>
                  isLeaderOfTeamId(tid) || data.settings.role === 'Admin' || data.settings.role === 'Manager'
              ).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {pendingSectionTeamIds
                    .filter(
                      (tid) =>
                        isLeaderOfTeamId(tid) || data.settings.role === 'Admin' || data.settings.role === 'Manager'
                    )
                    .map((tid) => (
                      <Button
                        key={tid}
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await api.post(`/tasks/${task.id}/approve-section/`, { team: Number(tid) })
                            await hydrateFromApi()
                            toast({ title: 'Bölüm onaylandı' })
                          } catch (e: any) {
                            toast({
                              title: 'Hata',
                              description: e?.response?.data?.detail || 'Onaylanamadı',
                              variant: 'destructive',
                            })
                          }
                        }}
                      >
                        Bölümü onayla: {data.teams.find((t) => t.id === tid)?.name || tid}
                      </Button>
                    ))}
                </div>
              )}
            {!isWorker && (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label>Hedef takım</Label>
                    <Select value={handoverTeam} onValueChange={setHandoverTeam}>
                      <SelectTrigger>
                        <SelectValue placeholder="Takım seç" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 overflow-y-auto">
                        <SelectItem value="none">—</SelectItem>
                        {data.teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hedef kişi</Label>
                    <Select value={handoverAssignee} onValueChange={setHandoverAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kişi seç" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="none">—</SelectItem>
                        {data.users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Not</Label>
                    <Input value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} placeholder="Kısa not" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Son devir: {task.handoverAt ? formatDate(task.handoverAt) : '—'} {task.handoverReason ? `• ${task.handoverReason}` : ''}
                </p>
                {(task as any).handoverHistory && (task as any).handoverHistory.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Devir Geçmişi</p>
                    <div className="space-y-1">
                      {((task as any).handoverHistory || []).slice(-5).reverse().map((h: any, idx: number) => (
                        <div key={idx} className="rounded border bg-muted/30 px-2 py-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {h.from_team_name || h.from_team || '—'} → {h.to_team_name || h.to_team || '—'}
                            </span>
                            <span className="text-muted-foreground">{h.at ? formatDate(h.at) : ''}</span>
                          </div>
                          <div className="mt-0.5 text-muted-foreground">
                            {h.by} {h.type === 'self-initiated' && '(kendi isteği)'} {h.note && `• ${h.note}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">
                {task.productLines && task.productLines.length > 1 ? 'Üretilecek ürün kalemleri' : 'Üretilecek ürün'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {task.productLines && task.productLines.length > 1
                  ? 'Tüm kalemler ekiplerce görünür. Sıralı akışta şu an işlenen kalem vurgulanır; üretim girişi için kalem sırası zorunlu değildir—her kaleme ayrı mutlak üretim değeri girilir.'
                  : task.mode === 'fixed'
                    ? 'Sabit model görevi — model, bıçak ve adet bilgisi üretim için geçerlidir.'
                    : 'Manuel görev — aşağıdaki plan ve ölçüler üretim talimatıdır.'}
              </p>
              {task.productLines && task.productLines.length > 1 && productLineQtyTotal > 0 ? (
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Toplam sipariş adeti (kalemler toplamı): </span>
                  <span className="font-semibold tabular-nums text-foreground">{formatNumber(productLineQtyTotal)}</span>
                  <span className="text-muted-foreground"> adet</span>
                  {productLineProducedTotal > 0 ? (
                    <span className="text-muted-foreground">
                      {' '}
                      • Üretilen toplam:{' '}
                      <span className="font-semibold tabular-nums text-foreground">{formatNumber(productLineProducedTotal)}</span>
                    </span>
                  ) : null}
                </p>
              ) : null}
              {task.productLines && task.productLines.length > 1 ? (
                <p className="text-xs text-amber-800 dark:text-amber-400 mt-1.5">
                  Üretim girişi her ürün kartından ayrı yapılır; toplam üretilen, kalemlerde girilenlere göre otomatik
                  güncellenir (üstte tek alan yoktur).
                </p>
              ) : null}
            </div>
            {task.productLines && task.productLines.length > 0 ? (
              <div className="space-y-2">
                {task.productLines.map((line, lidx) => {
                  const active = (task.activeProductIndex ?? 0) === lidx
                  const hex = cssColorFromProductCode(line.productColorCode)
                  const lineTarget = Math.max(1, Number(line.quantity ?? 1))
                  // Workflow'ta "üretilen" ekip/aşama bazındadır. Sıralı akışta aktif ekip değişince üretilen 0'dan başlar.
                  const stageProduced =
                    sequentialFlow && hasWfTeams && task.currentTeam
                      ? (() => {
                          const st: any = wfState?.[task.currentTeam] || {}
                          const byLine = st?.qty_done_by_line || st?.qtyDoneByLine
                          if (byLine && typeof byLine === 'object') {
                            const v = (byLine[String(lidx)] ?? byLine[lidx]) as any
                            return Math.max(0, Number(v ?? 0))
                          }
                          return Math.max(0, Number(st?.qty_done ?? 0))
                        })()
                      : null
                  const lineProduced = stageProduced != null ? stageProduced : Math.max(0, Number(line.qtyProduced ?? 0))
                  const lineRemaining = Math.max(0, lineTarget - lineProduced)
                  const unit = line.unitType === 'metre' || isPvcStage ? 'metre' : 'adet'
                  const lineEntries = (task.productionEntries || []).filter((e) => {
                    if (e.productLineIndex != null && !Number.isNaN(Number(e.productLineIndex))) {
                      return Number(e.productLineIndex) === lidx
                    }
                    return lidx === 0 && (task.productLines?.length ?? 0) > 0
                  })
                  return (
                    <div
                      key={lidx}
                      className={cn(
                        'rounded-md border bg-background/80 p-3 text-sm space-y-2',
                        active && task.productLines && task.productLines.length > 1 && 'ring-2 ring-primary/40'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">Ürün {lidx + 1}</span>
                        {line.mode === 'fixed' ? (
                          <Badge variant="secondary">Sabit</Badge>
                        ) : (
                          <Badge variant="outline">Manuel</Badge>
                        )}
                        {active && task.productLines && task.productLines.length > 1 ? (
                          <Badge>Şu an bu kalem</Badge>
                        ) : null}
                      </div>
                      {line.briefIntro?.trim() ? (
                        <p className="text-sm text-muted-foreground border-l-2 border-primary/35 pl-2 leading-snug">
                          {line.briefIntro.trim()}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                        <DetailRow label="Model" value={line.modelCode?.trim() ? line.modelCode : '—'} />
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="text-xs uppercase text-muted-foreground">Hedef / üretilen / kalan</span>
                          <span className="font-medium">Hedef: {formatNumber(lineTarget)} {unit}</span>
                          <span className="font-medium">Üretilen: {formatNumber(lineProduced)} {unit}</span>
                          <span className="font-medium">Kalan: {formatNumber(lineRemaining)} {unit}</span>
                        </div>
                        {showCncTechFields ? <DetailRow label="Varyant" value={line.variant?.trim() ? line.variant : '—'} /> : <div />}
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded border bg-muted/30 px-2 py-1.5">
                          {hex ? (
                            <span
                              className="h-8 w-8 shrink-0 rounded border bg-background shadow-sm"
                              style={{ backgroundColor: hex }}
                              title={line.productColorCode!.trim()}
                            />
                          ) : null}
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <DetailRow label="Renk" value={line.productColor?.trim() ? line.productColor : '—'} />
                            <DetailRow label="Renk kodu" value={line.productColorCode?.trim() ? line.productColorCode : '—'} />
                          </div>
                        </div>
                        {showCncTechFields ? (
                          <>
                            <DetailRow label="Bıçak" value={line.modelBladeDepth?.trim() ? line.modelBladeDepth : '—'} />
                            <DetailRow
                              label="Birim süre"
                              value={
                                line.modelDurationMinutes != null && Number(line.modelDurationMinutes) > 0
                                  ? `${line.modelDurationMinutes} dk`
                                  : '—'
                              }
                            />
                            <DetailRow
                              label="Satır plan (dk)"
                              value={
                                line.totalPlannedMinutes != null && Number(line.totalPlannedMinutes) > 0
                                  ? `${line.totalPlannedMinutes} dk`
                                  : '—'
                              }
                            />
                            <div className="sm:col-span-2">
                              <DetailRow
                                label="Ölçüler"
                                value={(line.modelSizes || []).length > 0 ? [...(line.modelSizes || [])].sort().join(', ') : '—'}
                              />
                            </div>
                          </>
                        ) : null}
                        <DetailRow label="Fire" value={`${formatNumber(Number(line.fireQty ?? 0))} ${unit}`} />
                        <DetailRow label="Fire sebebi" value={line.fireReason?.trim() ? line.fireReason : '—'} />
                        {line.fireImageDataUrl ? (
                          <div className="sm:col-span-2">
                            <img src={line.fireImageDataUrl} alt="fire" className="h-20 w-20 rounded border object-cover" />
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-md border border-dashed bg-muted/20 px-2 py-2 space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Üretim — bu kalem</p>
                        <p className="text-xs text-muted-foreground">
                          Girilen değer <span className="font-medium text-foreground">bu kalem için toplam üretilmiş adet</span>
                          (mutlak)dır; ekipler üst üste eklemez — son giriş geçerlidir.
                        </p>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <Label className="text-xs">Toplam üretilen (mutlak, {unit})</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                              className="h-8 w-24"
                              disabled={task.status === 'done' || sequentialProdLocked || salesOrderFulfilled}
                              value={
                                lineProdInput[lidx]?.q ?? String(Math.max(0, Number(lineProduced ?? 0)))
                              }
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '' || /^\d+$/.test(v)) {
                                  setLineProdInput((prev) => ({
                                    ...prev,
                                    [lidx]: { q: v, d: prev[lidx]?.d ?? prodDate },
                                  }))
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tarih</Label>
                            <Input
                              type="date"
                              className="h-8 w-40"
                              disabled={task.status === 'done' || sequentialProdLocked || salesOrderFulfilled}
                              value={lineProdInput[lidx]?.d ?? prodDate}
                              onChange={(e) => {
                                setLineProdInput((prev) => ({
                                  ...prev,
                                  [lidx]: { q: prev[lidx]?.q ?? '1', d: e.target.value },
                                }))
                              }}
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={task.status === 'done' || sequentialProdLocked || salesOrderFulfilled}
                            title={
                              salesOrderFulfilled
                                ? 'Sipariş hedef adedine ulaşıldı'
                                : sequentialProdLocked
                                  ? 'Önce usta başı görevi üstlenmeli'
                                  : undefined
                            }
                            onClick={async () => {
                              const row = lineProdInput[lidx] || {
                                q: String(Math.max(0, Number(lineProduced ?? 0))),
                                d: prodDate,
                              }
                              const raw = (row.q || '').trim()
                              if (!/^\d+$/.test(raw)) {
                                toast({
                                  title: 'Adet gerekli',
                                  description: '0 veya daha büyük bir tam sayı girin.',
                                  variant: 'destructive',
                                })
                                return
                              }
                              const quantity = Math.max(0, parseInt(raw, 10))
                              try {
                                await api.post(`/tasks/${task.id}/log-production/`, {
                                  quantity,
                                  entry_date: row.d || prodDate,
                                  product_line_index: lidx,
                                  ...(task.currentTeam ? { team: task.currentTeam } : {}),
                                })
                                await hydrateFromApi()
                                setLineProdInput((prev) => {
                                  const next = { ...prev }
                                  delete next[lidx]
                                  return next
                                })
                                toast({ title: 'Üretim kaydedildi', description: `Ürün ${lidx + 1}` })
                              } catch (e: any) {
                                toast({
                                  title: 'Hata',
                                  description: e?.response?.data?.detail || 'Kaydedilemedi',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          >
                            Üretimi kaydet
                          </Button>
                        </div>
                        {lineEntries.length > 0 ? (
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-muted-foreground">Kayıt geçmişi (toplanmaz):</p>
                            <ul className="text-[11px] space-y-0.5 max-h-28 overflow-y-auto text-muted-foreground">
                              {lineEntries.slice(0, 30).map((pe) => (
                                <li key={pe.id}>
                                  {pe.entryDate} • bildirilen {pe.quantity} {unit} • {pe.userName || pe.user || '—'}
                                  {pe.teamName ? ` • ${pe.teamName}` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm pt-1 border-t border-primary/10">
                  {task.productLines.length > 1 ? (
                    <DetailRow
                      label="Toplam sipariş adeti"
                      value={
                        productLineQtyTotal > 0
                          ? `${formatNumber(productLineQtyTotal)} adet (satır toplamı)`
                          : '—'
                      }
                    />
                  ) : null}
                  {task.productLines.length > 1 ? (
                    <DetailRow
                      label="Toplam üretilen"
                      value={`${formatNumber(productLineProducedTotal)} adet (kalemler toplamı)`}
                    />
                  ) : null}
                  <DetailRow
                    label="Görev planı (saat, tahmini)"
                    value={task.plannedHours != null && Number(task.plannedHours) > 0 ? `${task.plannedHours} sa` : '—'}
                  />
                  <DetailRow label="Başlangıç" value={task.start ? formatDate(task.start) : '—'} />
                  <DetailRow label="Bitiş" value={task.end ? formatDate(task.end) : '—'} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <DetailRow label="Görev modu" value={task.mode === 'fixed' ? 'Sabit (model bazlı)' : 'Manuel'} />
                {task.productLines?.[0]?.briefIntro?.trim() ? (
                  <p className="sm:col-span-2 text-sm text-muted-foreground border-l-2 border-primary/35 pl-2 -mt-1 mb-0.5 leading-snug">
                    {task.productLines[0].briefIntro!.trim()}
                  </p>
                ) : null}
                <DetailRow label="Hedef adet (toplam)" value={String(task.quantity ?? 1)} />
                <DetailRow label="Model kodu" value={task.modelCode?.trim() ? task.modelCode : '—'} />
                {showCncTechFields ? <DetailRow label="Varyant" value={task.variant?.trim() ? task.variant : '—'} /> : <div />}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  {(() => {
                    const hex = cssColorFromProductCode(task.productColorCode)
                    return hex ? (
                      <span
                        className="h-10 w-10 shrink-0 rounded-md border bg-background shadow-sm"
                        style={{ backgroundColor: hex }}
                        title={task.productColorCode!.trim()}
                      />
                    ) : null
                  })()}
                  <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
                    <DetailRow label="Ürün rengi" value={task.productColor?.trim() ? task.productColor : '—'} />
                    <DetailRow label="Renk kodu" value={task.productColorCode?.trim() ? task.productColorCode : '—'} />
                  </div>
                </div>
                {showCncTechFields ? (
                  <>
                    <DetailRow label="Bıçak derinliği" value={task.modelBladeDepth?.trim() ? task.modelBladeDepth : '—'} />
                    <DetailRow
                      label="Birim süre"
                      value={
                        task.modelDurationMinutes != null && Number(task.modelDurationMinutes) > 0
                          ? `${task.modelDurationMinutes} dk`
                          : '—'
                      }
                    />
                  </>
                ) : null}
                <DetailRow
                  label="Toplam planlanan süre"
                  value={
                    task.totalPlannedMinutes != null && Number(task.totalPlannedMinutes) > 0
                      ? `${task.totalPlannedMinutes} dk`
                      : '—'
                  }
                />
                <DetailRow
                  label="Planlanan süre (saat)"
                  value={task.plannedHours != null && Number(task.plannedHours) > 0 ? `${task.plannedHours} sa` : '—'}
                />
                <div className="sm:col-span-2">
                  <DetailRow
                    label="Ölçüler"
                    value={(task.modelSizes || []).length > 0 ? (task.modelSizes || []).join(', ') : '—'}
                  />
                </div>
                <DetailRow label="Başlangıç" value={task.start ? formatDate(task.start) : '—'} />
                <DetailRow label="Bitiş" value={task.end ? formatDate(task.end) : '—'} />
              </div>
            )}
            {(task.workflowTeamIds || []).length > 0 && (
              <div className="rounded border bg-background/70 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">İş akışı — bölüm hedefleri</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(task.workflowTeamIds || []).map((tid, idx) => {
                    const st = wfState[tid] || {}
                    const isCurrent = String(task.currentTeam || '') === String(tid)
                    const done = !!st?.stage_done
                    return (
                      <div
                        key={`wf-step-${tid}`}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-medium shadow-sm',
                          done &&
                            'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-900 dark:border-emerald-800 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:text-emerald-200',
                          isCurrent &&
                            !done &&
                            'border-sky-300 bg-gradient-to-br from-sky-100 to-blue-100 text-sky-900 ring-2 ring-sky-400/50 dark:border-sky-700 dark:from-sky-900/50 dark:to-blue-900/40 dark:text-sky-100',
                          !done &&
                            !isCurrent &&
                            'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-900 dark:border-amber-700 dark:from-amber-950/30 dark:to-yellow-900/20 dark:text-amber-100'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            <span className="mr-1 font-bold">{idx + 1}.</span>
                            {data.teams.find((t) => t.id === tid)?.name || tid}
                          </span>
                          <span className="shrink-0 text-base">{done ? '✓' : isCurrent ? '●' : '○'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-primary">● Aktif</span> •{' '}
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">✓ Tamamlandı</span> •{' '}
                  <span>○ Bekliyor</span>
                </p>
                <ul className="space-y-1.5 text-sm">
                  {(task.workflowTeamIds || []).map((tid, idx) => {
                    const tname = data.teams.find((t) => t.id === tid)?.name || tid
                    const st = wfState[tid]
                    const tgt =
                      task.workflowStageTargets?.[idx] ??
                      (typeof st?.qty_target === 'number' ? st.qty_target : undefined) ??
                      workflowQtyFallback ??
                      1
                    const done = typeof st?.qty_done === 'number' ? st.qty_done : null
                    return (
                      <li key={tid} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium">{tname}</span>
                        <span className="text-muted-foreground text-xs sm:text-sm">
                          Hedef: <span className="font-medium text-foreground">{tgt}</span> adet
                          {done != null ? ` • Son bildirilen (mutlak): ${done}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <DetailRow label="Görevi takip eden" value={ownerName} />
              <DetailRow label="Atanan" value={assigneeName} />
              <DetailRow label="Ekip" value={teamName || '—'} />
              <DetailRow label="Başlangıç" value={formatDate(task.start ?? '')} />
              <DetailRow label="Bitiş" value={formatDate(task.end ?? '')} />
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Vade tarihi</p>
                <RbacGuard perm="tasks.edit" fallback={<p className="font-medium">{task.due ? formatDate(task.due) : '—'}</p>}>
                  <Input
                    type="datetime-local"
                    value={task.due ? new Date(task.due).toISOString().slice(0, 16) : ''}
                    onChange={async (e) => {
                      const val = e.target.value
                      if (!val) return
                      await updateTask(task.id, { due: new Date(val).toISOString() })
                      toast({ title: 'Vade tarihi güncellendi' })
                    }}
                    className="max-w-[200px]"
                  />
                </RbacGuard>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs uppercase text-muted-foreground">SLA</span>
                {slaStatus(task) ? (
                  <Badge variant={slaStatus(task) === 'overdue' ? 'destructive' : 'secondary'}>
                    {taskSlaBucketLabelTR(slaStatus(task)!)}
                  </Badge>
                ) : (
                  <span className="font-medium">—</span>
                )}
              </div>
            </div>
          )}
          {task.mode === 'fixed' && !isWorker && (
            <div className="rounded border p-3">
              <p className="text-xs uppercase text-muted-foreground mb-2">Sabit model — toplam adet düzenle</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="number"
                  min={1}
                  value={qtyEdit}
                  onChange={(e) => setQtyEdit(Number(e.target.value) || 1)}
                  className="w-full sm:w-32"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    const qty = Math.max(1, Number(qtyEdit) || 1)
                    const duration = Number(task.modelDurationMinutes || 0)
                    const total = duration * qty
                    await updateTask(task.id, {
                      quantity: qty,
                      totalPlannedMinutes: total,
                      plannedHours: Number((total / 60).toFixed(2)),
                    })
                    toast({ title: 'Adet güncellendi', description: `${qty} adet` })
                  }}
                >
                  Kaydet
                </Button>
                <span className="text-xs text-muted-foreground">Güncel: {task.quantity || 1}</span>
              </div>
            </div>
          )}
          {isAdmin && (
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-1">Notlar</p>
              <p className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 text-sm">
                {task.notes || '—'}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Checklist</span>
                <span className="text-xs text-muted-foreground">
                  {doneCount}/{checklist.length} ({completionPct}%)
                </span>
              </div>
              {data.settings.role === 'Admin' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={checkTitle}
                    onChange={(e) => setCheckTitle(e.target.value)}
                    placeholder="Alt görev ekle"
                    className="h-8 w-48"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!checkTitle.trim()) return
                      await addChecklistItem({ task: task.id, title: checkTitle.trim() })
                      setCheckTitle('')
                      toast({ title: 'Alt görev eklendi' })
                    }}
                  >
                    Ekle
                  </Button>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue placeholder="Şablon" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_TEMPLATES.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const tpl = TASK_TEMPLATES.find((t) => t.id === selectedTemplate)
                      if (!tpl) return
                      await Promise.all(tpl.checklist.map((title) => addChecklistItem({ task: task.id, title })))
                      toast({ title: 'Şablon uygulandı', description: tpl.name })
                    }}
                  >
                    Şablon uygula
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {checklistDisplay.length === 0 && <p className="text-sm text-muted-foreground">Checklist boş</p>}
              {data.settings.role === 'Admin' ? (
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e: DragEndEvent) => {
                    const { active, over } = e
                    if (!over || active.id === over.id) return
                    const ids = manualChecklistItems.map((c) => String(c.id))
                    const oldIdx = ids.indexOf(String(active.id))
                    const newIdx = ids.indexOf(String(over.id))
                    if (oldIdx === -1 || newIdx === -1) return
                    const reorderedManual = arrayMove(ids, oldIdx, newIdx)
                    const fullOrder = [...workflowChecklistItems.map((c) => String(c.id)), ...reorderedManual]
                    reorderChecklistItems(task.id, fullOrder)
                    toast({ title: 'Sıra güncellendi' })
                  }}
                >
                  <div className="space-y-2">
                    {workflowChecklistItems.map((item) => (
                      <WorkflowChecklistRow key={item.id} item={item} />
                    ))}
                    <SortableContext
                      items={manualChecklistItems.map((c) => String(c.id))}
                      strategy={verticalListSortingStrategy}
                    >
                      {manualChecklistItems.map((item) => (
                        <SortableChecklistItem
                          key={item.id}
                          item={item}
                          onToggle={async (checked) => {
                            await toggleChecklistItem(item.id, Boolean(checked))
                            toast({ title: 'Checklist güncellendi' })
                          }}
                          onDelete={async () => {
                            await deleteChecklistItem(item.id)
                            toast({ title: 'Checklist öğesi silindi' })
                          }}
                        />
                      ))}
                    </SortableContext>
                  </div>
                </DndContext>
              ) : (
                <div className="space-y-2">
                  {checklistDisplay.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded border px-3 py-2">
                      <span className={`text-sm flex-1 ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                      {item.workflowTeamId && (
                        <span className="text-[10px] uppercase text-muted-foreground shrink-0" title="İş akışı">
                          Akış
                        </span>
                      )}
                      {item.done && <span className="text-xs text-muted-foreground">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <span className="text-sm font-semibold">Ekler</span>
            </div>
            {task.attachments && task.attachments.length > 0 ? (
              <div className="space-y-2">
                {Object.values(
                  task.attachments.reduce<Record<string, typeof task.attachments>>((acc, a) => {
                    const key = a.fileName || a.description || a.file.split('/').pop() || 'dosya'
                    acc[key] = acc[key] ? [...acc[key], a] : [a]
                    return acc
                  }, {})
                ).map((group, idx) => {
                  const sorted = [...group].sort((a, b) => (Number(b.version || 1) - Number(a.version || 1)))
                  return (
                    <div key={idx} className="rounded border">
                      <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                        <span className="font-semibold">
                          {sorted[0].description || sorted[0].fileName || sorted[0].file.split('/').pop()}
                        </span>
                        <span className="text-xs text-muted-foreground">{sorted.length} versiyon</span>
                      </div>
                      <div className="divide-y">
                        {sorted.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                            <a href={a.file} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                              <Download className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span>
                                  v{a.version || 1} {a.fileName || a.file.split('/').pop()}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {a.contentType || ''} {a.size ? `• ${(a.size / 1024 / 1024).toFixed(1)} MB` : ''}{' '}
                                  {a.uploadedAt ? `• ${formatDate(a.uploadedAt)}` : ''}
                                </span>
                              </div>
                            </a>
                            <div className="flex items-center gap-2">
                              {a.version === sorted[0].version && <Badge variant="secondary">Güncel</Badge>}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const newDesc = prompt('Yeni ad/açıklama', a.description || a.fileName || '')
                                  if (!newDesc) return
                                  await updateAttachment(a.id, { description: newDesc })
                                  toast({ title: 'Ek güncellendi', description: newDesc })
                                }}
                              >
                                Yeniden adlandır
                              </Button>
                              <RbacGuard perm="tasks.edit" fallback={null}>
                                <Button variant="ghost" size="sm" onClick={() => deleteAttachment(a.id)}>
                                  Sil
                                </Button>
                              </RbacGuard>
                          <div className="flex flex-wrap items-center gap-1">
                            {(a.tags || []).map((tag) => (
                              <Badge key={tag} variant="outline">
                                {tag}
                              </Badge>
                            ))}
                            <Input
                              placeholder="Etiket"
                              className="h-7 w-24"
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const val = e.currentTarget.value.trim()
                                  if (!val) return
                                  const nextTags = Array.from(new Set([...(a.tags || []), val]))
                                  await updateAttachment(a.id, { tags: nextTags })
                                  toast({ title: 'Etiket eklendi', description: val })
                                  e.currentTarget.value = ''
                                }
                              }}
                            />
                          </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ek yok</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Zaman kayıtları</span>
                <Badge variant="outline">{timeEntries.length} kayıt • {totalHours} saat</Badge>
              </div>
              <RbacGuard perm="tasks.edit">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={openEntry ? 'secondary' : 'default'}
                    onClick={async () => {
                      if (openEntry) {
                        await addTimeEntry({
                          task: task.id,
                          started_at: openEntry.started_at,
                          ended_at: new Date().toISOString(),
                        })
                        toast({ title: 'Zaman kaydı kapandı' })
                      } else {
                        const start = new Date().toISOString()
                        await addTimeEntry({ task: task.id, started_at: start, note: 'Timer' })
                        toast({ title: 'Zaman kaydı başladı' })
                      }
                    }}
                  >
                    {openEntry ? 'Durdur' : 'Başlat'}
                  </Button>
                </div>
              </RbacGuard>
            </div>
            {timeEntries.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok</p>}
            {timeEntries.map((te) => (
              <div key={te.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {te.started_at ? formatDate(te.started_at) : ''} {te.ended_at ? `→ ${formatDate(te.ended_at)}` : '(devam)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {te.user_name || te.user || '—'} {te.note ? `• ${te.note}` : ''}
                  </p>
                </div>
                {!te.ended_at && <Badge variant="secondary">Açık</Badge>}
              </div>
            ))}
            {(task.workflowTeamIds?.length ?? 0) > 0 && (
              <div className="rounded border p-3 space-y-1 mt-3">
                <p className="text-sm font-semibold">Bölüm durumu</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {(task.workflowTeamIds || []).map((tid) => {
                    const st = wfState[tid] || {}
                    const name = data.teams.find((t) => t.id === tid)?.name || tid
                    return (
                      <li key={tid}>
                        <span className="font-medium text-foreground">{name}</span>: hedef {st.qty_target ?? '—'}, son bildirilen{' '}
                        (mutlak) {st.qty_done ?? 0}
                        {st.stage_done ? ' ✓ tamam' : st.pending_approval ? ' — onay bekliyor' : ''}
                        {st.production_shortfall_reason ? (
                          <span className="block mt-0.5 text-amber-700 dark:text-amber-400">
                            Eksik üretim gerekçesi: {st.production_shortfall_reason}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div className="rounded border p-3 space-y-2 mt-3">
              <p className="text-sm font-semibold">Günlük üretim ({defaultLineUnit})</p>
              <p className="text-xs text-muted-foreground">
                Geçmiş satırlar denetim kaydıdır: her satırdaki adet, o anda bildirilen{' '}
                <span className="font-medium text-foreground">mutlak</span> üretimdir. İlk ekip 81 bildirdiyse süreç bu
                sayı üzerinden devam eder; sonraki ekip 80 bildirirse güncel üretilen 80 olur — satırların toplamı (ör.
                81+1+80) anlamlı değildir. Asıl kaynak: ürün kartındaki «Hedef / üretilen / kalan».
              </p>
              {task.productLines && task.productLines.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Bu görevde üretim girişi her ürün kartındaki «Üretim — bu kalem» alanından yapılır; tek bir toplam
                  üretim kutusu yoktur.
                </p>
              ) : null}
              {task.productLines && task.productLines.length > 1 && productLineQtyTotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Görev <span className="font-medium text-foreground">toplam sipariş adeti</span> (kalemler toplamı):{' '}
                  <span className="font-medium tabular-nums text-foreground">{formatNumber(productLineQtyTotal)}</span> adet
                </p>
              ) : null}
              {task.salesOrder && (
                <p className="text-xs text-muted-foreground">
                  Sipariş: {linkedSalesOrder?.number || task.salesOrder}
                  {salesOrderOrderQty > 0 ? (
                    <span>
                      {' '}
                      (sipariş: {formatNumber(salesOrderOrderQty)}, üretilen: {formatNumber(salesOrderProduced)}
                      {salesOrderRemaining != null ? `, kalan: ${formatNumber(salesOrderRemaining)}` : ''})
                    </span>
                  ) : null}
                  {salesOrderFulfilled ? (
                    <span className="block mt-1 font-medium text-amber-800 dark:text-amber-400">
                      Sipariş hedef adedine ulaşıldı — yeni üretim girişi kapalıdır.
                    </span>
                  ) : null}
                </p>
              )}
              {(!task.productLines || task.productLines.length === 0) && (
                <>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <Label className="text-xs">Adet</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        className="h-8 w-24"
                        disabled={task.status === 'done' || sequentialProdLocked || salesOrderFulfilled}
                        value={prodQty}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '' || /^\d+$/.test(v)) setProdQty(v)
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tarih</Label>
                      <Input
                        type="date"
                        className="h-8 w-40"
                        disabled={task.status === 'done' || sequentialProdLocked || salesOrderFulfilled}
                        value={prodDate}
                        onChange={(e) => setProdDate(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={task.status === 'done' || sequentialProdLocked || salesOrderFulfilled}
                      title={
                        salesOrderFulfilled
                          ? 'Sipariş hedef adedine ulaşıldı'
                          : sequentialProdLocked
                            ? 'Önce usta başı görevi üstlenmeli'
                            : undefined
                      }
                      onClick={async () => {
                        const raw = prodQty.trim()
                        if (!raw || !/^\d+$/.test(raw)) {
                          toast({
                            title: 'Adet gerekli',
                            description: '1 veya daha büyük bir tam sayı girin.',
                            variant: 'destructive',
                          })
                          return
                        }
                        const quantity = Math.max(1, parseInt(raw, 10))
                        try {
                          await api.post(`/tasks/${task.id}/log-production/`, {
                            quantity,
                            entry_date: prodDate,
                            ...(task.currentTeam ? { team: task.currentTeam } : {}),
                          })
                          await hydrateFromApi()
                          setProdQty('1')
                          toast({ title: 'Üretim kaydedildi' })
                        } catch (e: any) {
                          toast({
                            title: 'Hata',
                            description: e?.response?.data?.detail || 'Kaydedilemedi',
                            variant: 'destructive',
                          })
                        }
                      }}
                    >
                      Üretimi kaydet
                    </Button>
                  </div>
                  {(task.productionEntries || []).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        Kayıt geçmişi — her satır mutlak bildirim; satırlar toplanmaz.
                      </p>
                      <ul className="text-xs space-y-1 max-h-36 overflow-y-auto text-muted-foreground">
                        {(task.productionEntries || []).slice(0, 40).map((pe) => (
                          <li key={pe.id}>
                            {pe.entryDate} • bildirilen {pe.quantity} {defaultLineUnit} • {pe.userName || pe.user || '—'}
                            {pe.teamName ? ` • ${pe.teamName}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {!isWorker && (
            <RbacGuard perm="tasks.edit">
              <TaskModal
                task={task}
                users={data.users}
                teams={data.teams}
                salesOrders={data.salesOrders}
                uploading={false}
                setUploading={() => {}}
                onSubmit={async (values) => {
                  await updateTask(task.id, values)
                  toast({ title: 'Görev güncellendi' })
                }}
              >
                <Button size="sm" variant="outline">
                  Düzenle
                </Button>
              </TaskModal>
            </RbacGuard>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aktivite & Yorumlar</CardTitle>
          <CardDescription>Durum değişiklikleri, ekler, yorumlar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={timelineFilter} onValueChange={(v) => setTimelineFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Hepsi ({timelineCounts.all})</TabsTrigger>
              <TabsTrigger value="comment">Yorum ({timelineCounts.comment})</TabsTrigger>
              <TabsTrigger value="activity">Aktivite ({timelineCounts.activity})</TabsTrigger>
              <TabsTrigger value="attachment">Ek ({timelineCounts.attachment})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-2">
            {timeline.length > 0 ? (
              timeline.map((item) => (
                <div key={item.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.author}</span>
                    <span>{item.at ? formatDateTime(item.at) : ''}</span>
                  </div>
                  <p className="mt-1">
                    {item.type === 'attachment' && item.href ? (
                      <a href={item.href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        {item.text}
                      </a>
                    ) : (
                      renderMentions(item.text)
                    )}
                  </p>
                  {item.type === 'activity' && <span className="text-[10px] text-orange-500">Aktivite</span>}
                  {item.type === 'attachment' && <span className="text-[10px] text-green-600">Ek</span>}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Kayıt yok</p>
            )}
          </div>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!comment.trim()) return
              await addTaskComment({ task: task.id, text: comment, type: 'comment' })
              setComment('')
              toast({ title: 'Yorum eklendi' })
            }}
          >
            <Label>Yorum ekle</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Not veya yorum yazın" />
            <Button type="submit" size="sm">
              Gönder
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({ label, value, stackedValue }: { label: string; value?: string; stackedValue?: boolean }) {
  return (
    <div
      className={cn(
        'flex gap-2 text-sm',
        stackedValue ? 'flex-col items-start gap-0.5' : 'items-center'
      )}
    >
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className={cn('font-medium', stackedValue && 'text-base leading-none')}>{value || '—'}</span>
    </div>
  )
}

/** Ürün kalemlerinden toplam planlanan dakika (her satırda toplam dk yoksa süre×adet). */
function sumProductLinesPlannedMinutes(
  lines: { totalPlannedMinutes?: number; modelDurationMinutes?: number; quantity?: number }[] | undefined | null
): number {
  if (!lines?.length) return 0
  return lines.reduce((acc, line: any) => {
    const tpm = Number(line?.totalPlannedMinutes)
    const d = Number(line?.modelDurationMinutes) || 0
    const q = Math.max(1, Number(line?.quantity) || 1)
    if (Number.isFinite(tpm) && tpm > 0) return acc + tpm
    return acc + d * q
  }, 0)
}

function TaskModal({
  children,
  users,
  teams,
  salesOrders,
  onSubmit,
  task,
  uploading,
  setUploading,
}: {
  children: React.ReactNode
  users: UserLite[]
  teams: { id: string; name: string }[]
  salesOrders?: { id: string; number: string; customerName?: string }[]
  onSubmit: (values: z.infer<typeof taskSchema>) => void | Promise<void>
  task?: Task
  uploading: boolean
  setUploading: (v: boolean) => void
}) {
  const initialLines = initialProductLinesForForm(task)
  const wfIds = (task?.workflowTeamIds ?? []).filter(Boolean)
  const activeIdxInit = Math.min(
    Math.max(0, task?.activeProductIndex ?? 0),
    Math.max(0, initialLines.length - 1)
  )
  const q0 = Number(initialLines[activeIdxInit]?.quantity ?? task?.quantity ?? 1)
  const wfTargets =
    task?.workflowStageTargets?.length === wfIds.length
      ? task.workflowStageTargets
      : wfIds.map(() => q0)
  const initialPlannedMinutesSum = sumProductLinesPlannedMinutes(initialLines)
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema) as any,
    defaultValues: {
      title: task?.title ?? '',
      owner: pickDefaultTaskOwner(users, task?.owner),
      assignee: task?.assignee ?? '',
      teamId: task?.teamId ?? '',
      status: task?.status ?? 'todo',
      priority: task?.priority ?? 'medium',
      start: task?.start ? toDatetimeLocalFromISO(task.start) : toDatetimeLocalValue(new Date()),
      end: task?.end ? toDatetimeLocalFromISO(task.end) : toDatetimeLocalValue(new Date(Date.now() + 86400000)),
      due: task?.due ? toDatetimeLocalFromISO(task.due) : '',
      notes: '',
      plannedHours:
        initialPlannedMinutesSum > 0
          ? Number((initialPlannedMinutesSum / 60).toFixed(2))
          : task?.plannedHours ?? 0,
      plannedCost: task?.plannedCost ?? 0,
      productLines: initialLines,
      activeProductIndex: task?.activeProductIndex ?? 0,
      workflowTeamIds: task?.workflowTeamIds ?? [],
      workflowStageTargets: wfTargets,
      workflowParallel: task ? task.workflowParallel === true : false,
      salesOrderId: task?.salesOrder ? String(task.salesOrder) : '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'productLines' })
  const [lineOpen, setLineOpen] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [apiTaskModels, setApiTaskModels] = useState<
    {
      code: string
      image_url?: string
      duration_minutes: number
      sizes: string[]
      blade_min?: number
      blade_max?: number
      width_mm?: number
      height_mm?: number
      thickness_mm?: number
    }[]
  >([])
  const [orgSettings, setOrgSettings] = useState<{ working_hours_start: string; working_hours_end: string; working_days: number[] } | null>(null)
  const errors = form.formState.errors

  useEffect(() => {
    api.get('/task-models/').then((r) => setApiTaskModels(r.data || [])).catch(() => setApiTaskModels([]))
  }, [])
  useEffect(() => {
    api.get('/auth/organization-settings/').then((r) => setOrgSettings(r.data)).catch(() => setOrgSettings(null))
  }, [])
  const { toast } = useToast()
  const watchLines =
    useWatch({ control: form.control, name: 'productLines', defaultValue: initialLines }) ?? initialLines
  const watchStart = useWatch({ control: form.control, name: 'start' })
  const watchActiveLineIdx =
    useWatch({ control: form.control, name: 'activeProductIndex', defaultValue: task?.activeProductIndex ?? 0 }) ?? 0
  const watchWorkflowParallel = useWatch({ control: form.control, name: 'workflowParallel' }) === true
  const workflowDefaultTargetQty = useMemo(() => {
    const lines = watchLines || []
    if (!lines.length) return 1
    if (lines.length > 1 && !watchWorkflowParallel) {
      const ai = Math.min(
        Math.max(0, Number(watchActiveLineIdx) || 0),
        Math.max(0, lines.length - 1)
      )
      const q = Math.max(0, Number((lines[ai] as { quantity?: unknown })?.quantity) || 0)
      return q > 0 ? q : 1
    }
    const sum = lines.reduce((s, l) => s + Math.max(0, Number((l as { quantity?: unknown })?.quantity) || 0), 0)
    return sum > 0 ? sum : 1
  }, [watchLines, watchActiveLineIdx, watchWorkflowParallel])
  const totalMinutesSum = useMemo(() => sumProductLinesPlannedMinutes(watchLines), [watchLines])
  const minsPerMesaiDay = useMemo(() => {
    const start = orgSettings?.working_hours_start || '08:00'
    const end = orgSettings?.working_hours_end || '18:00'
    const m = getWorkingMinutesPerDay(start, end)
    return m > 0 ? m : 600
  }, [orgSettings])

  useEffect(() => {
    form.setValue('plannedHours', Number((totalMinutesSum / 60).toFixed(2)))
  }, [totalMinutesSum, form])

  useEffect(() => {
    const n = fields.length
    if (n < 1) return
    const ai = form.getValues('activeProductIndex') ?? 0
    if (ai > n - 1) form.setValue('activeProductIndex', Math.max(0, n - 1))
  }, [fields.length, form])

  useEffect(() => {
    if (!watchStart || !totalMinutesSum || totalMinutesSum <= 0) return
    const start = String(watchStart)
    const workStart = orgSettings?.working_hours_start || '08:00'
    const workEnd = orgSettings?.working_hours_end || '18:00'
    const workDays = orgSettings?.working_days?.length ? orgSettings.working_days : [0, 1, 2, 3, 4]
    const endStr = addWorkingMinutes(start, totalMinutesSum, workStart, workEnd, workDays)
    form.setValue('end', endStr)
  }, [watchStart, totalMinutesSum, orgSettings, form])

  const toggleLineOpen = (index: number) => {
    setLineOpen((prev) => {
      const cur = prev[String(index)] !== false
      return { ...prev, [String(index)]: !cur }
    })
  }

  const uploadAttachments = async (taskId: string, files: File[] | FileList | null) => {
    if (!files || (files as FileList).length === 0) return
    const arr = Array.isArray(files) ? files : Array.from(files)
    const invalid = arr.find((f) => !ALLOWED_FILE_TYPES.includes(f.type) || f.size > MAX_FILE_MB * 1024 * 1024)
    if (invalid) {
      toast({
        title: 'Dosya reddedildi',
        description: 'Yalnızca PNG/JPG/WEBP/PDF ve max 10MB kabul edilir',
        variant: 'destructive',
      })
      return
    }
    setUploading(true)
    try {
      for (const file of arr) {
        // presign step
        const presignRes = await api.post('/uploads/presign/', {
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          size: file.size,
          strategy: file.size > 10 * 1024 * 1024 ? 'chunk' : 'direct',
        })
        const presign = presignRes.data
        const uploadUrl = presign?.upload_url || '/api/task-attachments/'
        const maxSize = presign?.max_size_mb ? Number(presign.max_size_mb) * 1024 * 1024 : MAX_FILE_MB * 1024 * 1024
        if (file.size > maxSize) {
          toast({ title: 'Dosya büyük', description: `Max ${(maxSize / 1024 / 1024).toFixed(0)}MB`, variant: 'destructive' })
          continue
        }
        const partSize = presign?.part_size || maxSize
        const uploadChunk = async (blob: Blob, idx: number) => {
          const formData = new FormData()
          Object.entries(presign?.fields || {}).forEach(([k, v]) => formData.append(k, String(v)))
          formData.append('task', taskId)
          formData.append('file', blob, `${file.name}.part${idx}`)
          if (uploadUrl.startsWith('http')) {
            await fetch(uploadUrl, { method: 'POST', body: formData })
          } else {
            await api.post(uploadUrl.replace(api.defaults.baseURL || '', ''), formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
          }
        }
        if (presign?.strategy === 'chunk' && file.size > partSize && presign?.strategy !== 's3') {
          let offset = 0
          let chunkIdx = 0
          while (offset < file.size) {
            const chunk = file.slice(offset, offset + partSize)
            await uploadChunk(chunk, chunkIdx)
            offset += partSize
            chunkIdx += 1
          }
        } else {
          await uploadChunk(file, 0)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task ? 'Görevi düzenle' : 'Görev oluştur'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
            try {
              const payload = { ...values }
              const normalizeDateTime = (v: unknown): string | null => {
                const s = String(v ?? '').trim()
                if (!s) return null
                const d = new Date(s)
                return Number.isNaN(d.getTime()) ? null : d.toISOString()
              }
              ;(payload as any).start = normalizeDateTime((payload as any).start)
              ;(payload as any).end = normalizeDateTime((payload as any).end)
              ;(payload as any).due = normalizeDateTime((payload as any).due)
              const normalizedLines = (values.productLines || []).map((line) => {
                let row = { ...line }
                if (row.mode === 'fixed') {
                  const preset = MODEL_PRESETS.find((m) => m.code === row.modelCode) || MODEL_PRESETS[0]
                  const variantObj = preset?.variants.find((v) => v.id === row.variant)
                  const duration = Number(row.modelDurationMinutes) || variantObj?.duration || 0
                  const qty = row.quantity ?? 1
                  const total = Number(duration) * Number(qty)
                  row = {
                    ...row,
                    modelDurationMinutes: duration,
                    modelBladeDepth: row.modelBladeDepth ?? variantObj?.blade ?? '',
                    totalPlannedMinutes: Number(total.toFixed(2)),
                    modelCode: row.modelCode || preset?.code || '',
                  }
                } else {
                  const duration = Number(row.modelDurationMinutes || 0)
                  const qty = Number(row.quantity ?? 1)
                  row.totalPlannedMinutes = Number((duration * qty).toFixed(2))
                }
                return row
              })
              const sumMin = normalizedLines.reduce((s, r) => s + Number(r.totalPlannedMinutes || 0), 0)
              ;(payload as any).productLines = normalizedLines
              ;(payload as any).plannedHours = Number((sumMin / 60).toFixed(2))
              ;(payload as any).activeProductIndex = task?.activeProductIndex ?? 0
              const wf = ((payload as any).workflowTeamIds || []).filter((x: string) => x != null && x !== '')
              let wt = [...((payload as any).workflowStageTargets || []).map((n: number) => Number(n))]
              const ai = Math.min(
                Math.max(0, (payload as any).activeProductIndex ?? 0),
                Math.max(0, normalizedLines.length - 1)
              )
              const defQty = Number(normalizedLines[ai]?.quantity ?? 1)
              while (wt.length < wf.length) wt.push(defQty)
              ;(payload as any).workflowStageTargets = wt.slice(0, wf.length)
              await onSubmit(payload as any)
              if (task?.id) {
                const buffered = droppedFiles.length > 0 ? droppedFiles : fileInputRef.current?.files ?? null
                await uploadAttachments(task.id, buffered)
                setDroppedFiles([])
              }
              toast({ title: task ? 'Güncellendi' : 'Oluşturuldu' })
            } catch (err: any) {
              const detail = err?.response?.data
              // backend validation errors: map to RHF
              if (detail && typeof detail === 'object') {
                Object.entries(detail).forEach(([field, msg]) => {
                  if (typeof msg === 'string') {
                    form.setError(field as any, { message: msg })
                  } else if (Array.isArray(msg) && typeof msg[0] === 'string') {
                    form.setError(field as any, { message: msg[0] })
                  }
                })
              }
              toast({ title: 'Hata', description: detail?.detail || 'Kaydedilemedi', variant: 'destructive' })
            }
          })}
        >
          <div className="space-y-1">
            <Label>Başlık</Label>
            <Input {...form.register('title')} className={cn(errors.title && 'border-destructive')} />
            <FormError message={errors.title?.message} />
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-base">Ürün kalemleri</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Her kalem için model, adet, süre ve renk ayrı girilir. Sıralı iş akışında tamamlanan üretimden sonra
                  sıradaki kalem otomatik devreye girer.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  append(emptyProductLineRow())
                  setLineOpen((prev) => ({ ...prev, [String(fields.length)]: true }))
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ürün ekle
              </Button>
            </div>
            <FormError message={(errors.productLines as any)?.message} />
            {fields.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Toplam sipariş adeti (kalemler toplamı):{' '}
                <span className="font-medium tabular-nums text-foreground">{formatNumber(workflowDefaultTargetQty)}</span> adet
              </p>
            )}
            {totalMinutesSum > 0 && (
              <p className="text-xs text-muted-foreground">
                Tüm kalemler toplamı: <span className="font-medium text-foreground">{formatNumber(totalMinutesSum)} dk</span>
                {' · '}
                ≈ {formatNumber(totalMinutesSum / minsPerMesaiDay)} mesai günü
              </p>
            )}
            <div className="space-y-2">
              {fields.map((field, index) => {
                const line = watchLines?.[index]
                const open = lineOpen[String(index)] !== false
                const isActive =
                  task?.id &&
                  (task.activeProductIndex ?? 0) === index &&
                  (task.productLines?.length ?? 0) > 1
                const summaryMode = line?.mode === 'fixed' ? 'Sabit' : 'Manuel'
                const summaryModel = line?.modelCode?.trim() || '—'
                const summaryQty = line?.quantity ?? '—'
                return (
                  <div key={field.id} className="rounded-lg border bg-card overflow-hidden">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => toggleLineOpen(index)}
                    >
                      <ChevronDown
                        className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                      />
                      <span className="font-medium text-sm">Ürün {index + 1}</span>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {summaryMode}
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                        {summaryModel} · adet {summaryQty}
                      </span>
                      {isActive ? (
                        <Badge className="shrink-0 text-[10px]">Şu an üretimde</Badge>
                      ) : null}
                    </button>
                    {open ? (
                      <div className="border-t px-3 py-3 space-y-3">
                        <TaskProductLineFields
                          form={form}
                          index={index}
                          task={task}
                          apiTaskModels={apiTaskModels}
                          orgSettings={orgSettings}
                          modelPresets={MODEL_PRESETS}
                        />
                        {fields.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Bu kalemi sil
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Görevi takip eden</Label>
              <Select value={form.watch('owner')} onValueChange={(v) => form.setValue('owner', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.owner?.message} />
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Atanan ve ekip</p>
              <p className="mt-1">
                Yeni görevde süreç adımlarındaki ilk ekibin usta başı otomatik atanır; ekip sırası iş akışı adımlarından
                gelir. Değişiklik için görev detayında devir / üstlenme kullanın.
              </p>
            </div>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-4">
              <Label className="text-sm font-medium">Süreç adımları (iş akışı)</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="workflow-parallel"
                  checked={form.watch('workflowParallel') === true}
                  onCheckedChange={(c) => form.setValue('workflowParallel', Boolean(c))}
                />
                <label htmlFor="workflow-parallel" className="text-xs cursor-pointer">
                  Paralel bölümler (beklemeden başlasın; usta başı onayı ile kapanır)
                </label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Her adım için ekip ve hedef adet seçin. Birden fazla ürün kaleminde varsayılan hedef,{' '}
              <span className="font-medium text-foreground">aktif ürün satırının</span> sipariş adedidir (paralel modda
              tüm kalemlerin toplamı arka planda kullanılır). Paralel bölümler aynı anda; sıralı akışta önceki bölüm
              bitince sonrakine geçilir.
            </p>
            <WorkflowStepsEditor
              teams={teams}
              teamIds={form.watch('workflowTeamIds') || []}
              targets={form.watch('workflowStageTargets') || []}
              defaultTargetQty={workflowDefaultTargetQty}
              onTeamsChange={(ids) => form.setValue('workflowTeamIds', ids)}
              onTargetsChange={(t) => form.setValue('workflowStageTargets', t)}
            />
          </div>
          <div>
            <Label>Bağlı satış siparişi (üretim düşümü) — isteğe bağlı</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Boş bırakabilirsiniz; bağlı sipariş yalnızca üretim kaydında stoğa düşüm için kullanılır.
            </p>
            <Select
              value={form.watch('salesOrderId') ? String(form.watch('salesOrderId')) : 'none'}
              onValueChange={(v) => form.setValue('salesOrderId', v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sipariş seçmeyin veya seçin" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="none">— Bağlı sipariş yok —</SelectItem>
                {(salesOrders || []).map((so) => (
                  <SelectItem key={so.id} value={so.id}>
                    {so.number} {so.customerName ? `• ${so.customerName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Durum</Label>
              <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Yapılacak</SelectItem>
                  <SelectItem value="in-progress">Devam ediyor</SelectItem>
                  <SelectItem value="done">Tamamlandı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Öncelik</Label>
              <Select value={form.watch('priority')} onValueChange={(v) => form.setValue('priority', v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Düşük</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="high">Yüksek</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label>Başlangıç</Label>
              <Input type="datetime-local" {...form.register('start')} className={cn(errors.start && 'border-destructive')} />
              <FormError message={errors.start?.message} />
            </div>
            <div>
              <Label>Bitiş</Label>
              <Input type="datetime-local" {...form.register('end')} className={cn(errors.end && 'border-destructive')} />
              <FormError message={errors.end?.message} />
            </div>
            <div>
              <Label>Vade (due)</Label>
              <Input type="datetime-local" {...form.register('due')} className={cn(errors.due && 'border-destructive')} />
              <FormError message={errors.due?.message} />
            </div>
          </div>
          {totalMinutesSum > 0 ? (
            <p className="text-xs text-muted-foreground -mt-1">
              Bitiş, başlangıç tarihi ve tüm ürün kalemlerinin toplam üretim yükü (
              <span className="font-medium text-foreground">{formatNumber(totalMinutesSum)} dk</span>, yaklaşık{' '}
              <span className="font-medium text-foreground">{formatNumber(totalMinutesSum / minsPerMesaiDay)}</span> mesai
              günü) üzerinden mesai saatleri ve çalışma günleriyle hesaplanarak güncellenir.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Planlanan gün (mesai)</Label>
              <Input
                type="number"
                readOnly
                tabIndex={-1}
                step="0.001"
                min={0}
                className={cn('bg-muted', errors.plannedHours && 'border-destructive')}
                value={totalMinutesSum > 0 ? Number((totalMinutesSum / minsPerMesaiDay).toFixed(3)) : 0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ürün kalemlerindeki süre ve adetlere göre otomatik hesaplanır. 1 mesai günü ={' '}
                {formatNumber(minsPerMesaiDay / 60)} saat ({orgSettings?.working_hours_start ?? '08:00'}–
                {orgSettings?.working_hours_end ?? '18:00'}).
              </p>
              <FormError message={errors.plannedHours?.message} />
            </div>
            <div>
              <Label>Bütçe (para)</Label>
              <Input type="number" step="1" {...form.register('plannedCost')} className={cn(errors.plannedCost && 'border-destructive')} />
              <FormError message={errors.plannedCost?.message} />
            </div>
          </div>
          <div>
            <Label>Notlar</Label>
            <Textarea {...form.register('notes')} placeholder="İşle ilgili kısa not ekleyin" />
          </div>
          <div className="space-y-2">
            <Label>Dosya/Foto/PDF</Label>
            <div
              className="flex items-center gap-2 rounded-md border border-dashed p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const files = Array.from(e.dataTransfer.files || [])
                const accepted = files.filter(
                  (f) =>
                    f.size <= MAX_FILE_MB * 1024 * 1024 &&
                    (f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === '')
                )
                if (accepted.length !== files.length) {
                  toast({ title: 'Bazı dosyalar tip/limit nedeniyle reddedildi (10MB, image/pdf)', variant: 'destructive' })
                }
                setDroppedFiles(accepted)
              }}
            >
              <Input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" />
              {uploading && <span className="text-xs text-muted-foreground">Yükleniyor...</span>}
            </div>
            {droppedFiles.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {droppedFiles.map((f) => (
                  <div key={f.name} className="flex items-center justify-between">
                    <span className="truncate">{f.name}</span>
                    <span>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={uploading}>{task ? 'Kaydet' : 'Oluştur'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

