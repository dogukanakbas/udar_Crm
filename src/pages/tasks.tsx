import { useMemo, useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import { formatDate } from '@/lib/utils'
import type { Task } from '@/types'
import { Calendar, Plus, Paperclip, Download } from 'lucide-react'
import { RbacGuard } from '@/components/rbac'
import { useRef, useState as useReactState } from 'react'
import { Link } from '@tanstack/react-router'
import { useRouterState, useParams } from '@tanstack/react-router'
import { CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormEvent, useState as useStateReact } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { downloadCsv } from '@/utils/download-csv'
import { downloadICS } from '@/utils/ics'
import { cn } from '@/lib/utils'
import type { TaskTimeEntry } from '@/types'

const MENTION_REGEX = /@([\w.-]+)/g
const MAX_FILE_MB = 10
const TASK_TEMPLATES: { id: string; name: string; checklist: string[] }[] = [
  { id: 'onboarding', name: 'Onboarding', checklist: ['Gereksinim topla', 'Ölçümleri tanımla', 'Kickoff planla'] },
  { id: 'bugfix', name: 'Bug fix', checklist: ['Reprodüksiyon', 'Kök neden analizi', 'Fix PR', 'Test ve onay'] },
  { id: 'delivery', name: 'Teslimat', checklist: ['Ekip ataması', 'Takvim doğrula', 'Müşteri bilgilendir', 'QA tamamla'] },
]
const WIP_DEFAULTS: Record<Task['status'], number> = { todo: 5, 'in-progress': 4, done: 999 }

const taskSchema = z
  .object({
    title: z.string().min(2, 'Başlık en az 2 karakter olmalı'),
    owner: z.string().min(1, 'Sahip seçilmeli'),
    assignee: z.string().min(1, 'Atanan seçilmeli'),
    teamId: z.string().optional(),
    status: z.enum(['todo', 'in-progress', 'done']),
    priority: z.enum(['low', 'medium', 'high']),
    start: z.string(),
    end: z.string(),
    notes: z.string().optional(),
    plannedHours: z.string().optional(),
    plannedCost: z.string().optional(),
  })
  .refine((v) => new Date(v.end).getTime() >= new Date(v.start).getTime(), {
    message: 'Bitiş tarihi başlangıçtan önce olamaz',
    path: ['end'],
  })

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
  const { data, createTask, updateTask, deleteTask, updateAttachment, deleteAttachment } = useAppStore()
  const logAccess = useAppStore((s: any) => s.logAccess)
  const tasks = data.tasks ?? []
  const { toast } = useToast()
  const [notifMuted, setNotifMuted] = useState(false)
  const [status, setStatus] = useState('all')
  const [assignee, setAssignee] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useReactState(false)
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
      variant: 'warning',
    })
  }, [tasks, notifMuted, toast])

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (status === 'all' || t.status === status) &&
          (assignee === 'all' || t.assignee === assignee) &&
          (teamFilter === 'all' || t.teamId === teamFilter) &&
          (search.trim().length === 0 ||
            t.title.toLowerCase().includes(search.trim().toLowerCase()) ||
            (t.notes || '').toLowerCase().includes(search.trim().toLowerCase()))
      ),
    [tasks, status, assignee, teamFilter, search]
  )

  const statusCounts = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1
        return acc
      },
      { todo: 0, 'in-progress': 0, done: 0 } as Record<Task['status'], number>
    )
  }, [filtered])

  const exportCsv = () => {
    const rows = filtered.map((t) => ({
      Başlık: t.title,
      Durum: t.status,
      Öncelik: t.priority,
      Atanan: data.users.find((u) => u.id === t.assignee)?.username || '',
      Sahip: data.users.find((u) => u.id === t.owner)?.username || '',
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
    toast({ title: 'CSV hazır', description: `${rows.length} kayıt` })
  }

  const exportICS = () => {
    const events = filtered
      .filter((t) => t.start || t.due || t.end)
      .map((t) => ({
        uid: `${t.id}@udarcrm`,
        summary: t.title,
        description: `Durum: ${t.status} • Öncelik: ${t.priority}`,
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
    { accessorKey: 'title', header: 'Görev' },
    {
      accessorKey: 'assignee',
      header: 'Atanan',
      cell: ({ row }) => data.users.find((u) => u.id === row.original.assignee)?.username ?? row.original.assignee,
    },
    {
      accessorKey: 'owner',
      header: 'Sahip',
      cell: ({ row }) => data.users.find((u) => u.id === row.original.owner)?.username ?? row.original.owner,
    },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    { accessorKey: 'priority', header: 'Öncelik', cell: ({ row }) => <Badge variant="outline">{row.original.priority}</Badge> },
    { accessorKey: 'start', header: 'Başlangıç', cell: ({ row }) => formatDate(row.original.start ?? '') },
    { accessorKey: 'end', header: 'Bitiş', cell: ({ row }) => formatDate(row.original.end ?? '') },
    {
      id: 'sla',
      header: 'SLA',
      cell: ({ row }) => {
        const sla = slaStatus(row.original)
        if (!sla) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <Badge variant={sla === 'overdue' ? 'destructive' : 'default'}>{sla === 'overdue' ? 'Gecikti' : '<24s'}</Badge>
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
          <Link
            to={`/tasks/${row.original.id}`}
            className="text-xs text-blue-600 underline underline-offset-4"
          >
            Detay
          </Link>
          <RbacGuard perm="tasks.edit">
            <TaskModal
              task={row.original}
              users={data.users}
              teams={data.teams}
              uploading={uploading}
              setUploading={setUploading}
              onSubmit={(values) => {
                updateTask(row.original.id, values)
                toast({ title: 'Görev güncellendi' })
              }}
            >
              <Button variant="ghost" size="sm">Düzenle</Button>
            </TaskModal>
            <Button variant="ghost" size="sm" onClick={() => deleteTask(row.original.id)}>Sil</Button>
          </RbacGuard>
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
      toast({ title: 'WIP limiti dolu', description: `${newStatus} için limit: ${wipLimits[newStatus]}`, variant: 'destructive' })
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
            <RbacGuard perm="tasks.edit">
              <TaskModal
                users={data.users}
                teams={data.teams}
                uploading={uploading}
                setUploading={setUploading}
                onSubmit={(values) => {
                  createTask(values as any)
                  toast({ title: 'Görev oluşturuldu' })
                }}
              >
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Görev oluştur
                </Button>
              </TaskModal>
            </RbacGuard>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV dışa aktar
          </Button>
          <Button size="sm" variant="outline" onClick={exportICS}>
            <Calendar className="mr-2 h-4 w-4" />
            ICS dışa aktar
          </Button>
          </div>
        }
      />
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
          <SelectContent>
            <SelectItem value="all">Herkes</SelectItem>
            {data.users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
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
              <SelectItem key={t.id} value={t.id}>
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
            <DataTable columns={columns} data={filtered} />
          </CardContent>
        </Card>
      ) : view === 'board' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {(['todo', 'in-progress', 'done'] as Task['status'][]).map((st) => (
              <div key={st} className="flex items-center gap-2 rounded border px-2 py-1">
                <span className="uppercase">{st}</span>
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
                  <CardTitle className="text-sm uppercase">{st}</CardTitle>
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
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    className={cn(
                      'rounded-lg border bg-card/80 p-3 shadow-sm hover:border-primary/60',
                      slaStatus(t) === 'overdue' && 'border-destructive/70'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{t.title}</p>
                      <div className="flex items-center gap-2">
                        {slaStatus(t) && (
                          <Badge variant={slaStatus(t) === 'overdue' ? 'destructive' : 'secondary'}>
                            {slaStatus(t) === 'overdue' ? 'Gecikti' : '<24s'}
                          </Badge>
                        )}
                        <Badge variant="outline">{t.priority}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Atanan: {data.users.find((u) => u.id === t.assignee)?.username || '—'}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
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
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="xs" variant="outline" onClick={handleDrop(st === 'todo' ? 'in-progress' : 'done', t.id)}>
                        {st === 'todo' ? 'Başlat' : 'Tamamla'}
                      </Button>
                      <Link to={`/tasks/${t.id}`} className="text-xs text-blue-600 underline underline-offset-4">
                        Detay
                      </Link>
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
                      Todo {row.todo} • Devam {row.inProgress} • Tamam {row.done}
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
                      Todo {row.todo} • Devam {row.inProgress} • Tamam {row.done}
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
        </div>
      )}
    </div>
  )
}

export function TaskDetailPage() {
  const { taskId } = useParams({ from: '/tasks/$taskId' })
  const { data, updateTask, addTaskComment, addChecklistItem, toggleChecklistItem, deleteAttachment, addTimeEntry } = useAppStore()
  const task = data.tasks.find((t) => t.id === taskId)
  const { toast } = useToast()
  const [comment, setComment] = useStateReact('')
  const [timelineFilter, setTimelineFilter] = useStateReact<'all' | 'comment' | 'activity' | 'attachment'>('all')
  const [checkTitle, setCheckTitle] = useStateReact('')
  const [selectedTemplate, setSelectedTemplate] = useStateReact<string>('onboarding')
  const [timerState, setTimerState] = useStateReact<{ running: boolean; start?: string }>({ running: false })
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
  const checklist = task.checklist || []
  const doneCount = checklist.filter((c) => c.done).length
  const completionPct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0
  const timeEntries: TaskTimeEntry[] = (task as any).time_entries || []
  const openEntry = timeEntries.find((te) => !te.ended_at)
  const totalMs = timeEntries.reduce((sum, te) => {
    const end = te.ended_at ? new Date(te.ended_at).getTime() : Date.now()
    const start = te.started_at ? new Date(te.started_at).getTime() : end
    return sum + Math.max(0, end - start)
  }, 0)
  const totalHours = (totalMs / 1000 / 60 / 60).toFixed(1)
  const timeline = [
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
    // backend activity logs already add status/assignee/due/priority changes as comments
    ...(task.history || []).map((h: any, idx: number) => ({
      id: `h-${idx}`,
      type: 'activity' as const,
      author: h.actor || 'Sistem',
      text: h.text || '',
      at: h.at || '',
    })),
  ]
    .filter((i) => i.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .filter((i) => (timelineFilter === 'all' ? true : i.type === timelineFilter))
  return (
    <div className="space-y-4">
      <PageHeader
        title={`Görev: ${task.title}`}
        description={`Durum: ${task.status} • Öncelik: ${task.priority || '-'}`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Detaylar</CardTitle>
          <CardDescription>Sahip, atanan, tarih ve ekler</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow label="Sahip" value={ownerName} />
            <DetailRow label="Atanan" value={assigneeName} />
            <DetailRow label="Ekip" value={teamName || '—'} />
            <DetailRow label="Başlangıç" value={formatDate(task.start ?? '')} />
            <DetailRow label="Bitiş" value={formatDate(task.end ?? '')} />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs uppercase text-muted-foreground">SLA</span>
              {slaStatus(task) ? (
                <Badge variant={slaStatus(task) === 'overdue' ? 'destructive' : 'secondary'}>
                  {slaStatus(task) === 'overdue' ? 'Gecikti' : '24s içinde'}
                </Badge>
              ) : (
                <span className="font-medium">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-1">Notlar</p>
            <p className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 text-sm">
              {task.notes || '—'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Checklist</span>
                <span className="text-xs text-muted-foreground">
                  {doneCount}/{checklist.length} ({completionPct}%)
                </span>
              </div>
              <RbacGuard perm="tasks.edit">
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
              </RbacGuard>
            </div>
            <div className="space-y-2">
              {checklist.length === 0 && <p className="text-sm text-muted-foreground">Checklist boş</p>}
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded border px-3 py-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={async (checked) => {
                      await toggleChecklistItem(item.id, Boolean(checked))
                      toast({ title: 'Checklist güncellendi' })
                    }}
                  />
                  <span className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                </div>
              ))}
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
                              <RbacGuard perm="tasks.edit">
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
                        setTimerState({ running: false, start: undefined })
                        toast({ title: 'Zaman kaydı kapandı' })
                      } else {
                        const start = new Date().toISOString()
                        await addTimeEntry({ task: task.id, started_at: start, note: 'Timer' })
                        setTimerState({ running: true, start })
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
          </div>
          <RbacGuard perm="tasks.edit">
            <TaskModal
              task={task}
              users={data.users}
              teams={data.teams}
              uploading={false}
              setUploading={() => {}}
              onSubmit={async (values) => {
                await updateTask(task.id, values)
                toast({ title: 'Görev güncellendi' })
              }}
            >
              <Button size="sm" variant="outline">Düzenle</Button>
            </TaskModal>
          </RbacGuard>
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
              <TabsTrigger value="all">Hepsi</TabsTrigger>
              <TabsTrigger value="comment">Yorum</TabsTrigger>
              <TabsTrigger value="activity">Aktivite</TabsTrigger>
              <TabsTrigger value="attachment">Ek</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-2">
            {timeline.length > 0 ? (
              timeline.map((item) => (
                <div key={item.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.author}</span>
                    <span>{item.at ? formatDate(item.at) : ''}</span>
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

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}

function TaskModal({
  children,
  users,
  teams,
  onSubmit,
  task,
  uploading,
  setUploading,
}: {
  children: React.ReactNode
  users: { id: string; username: string }[]
  teams: { id: string; name: string }[]
  onSubmit: (values: z.infer<typeof taskSchema>) => void
  task?: Task
  uploading: boolean
  setUploading: (v: boolean) => void
}) {
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? '',
      owner: task?.owner ?? users[0]?.id ?? '',
      assignee: task?.assignee ?? users[0]?.id ?? '',
      teamId: task?.teamId ?? '',
      status: task?.status ?? 'todo',
      priority: task?.priority ?? 'medium',
      start: task?.start ?? new Date().toISOString(),
      end: task?.end ?? new Date(Date.now() + 86400000).toISOString(),
      notes: '',
      plannedHours: (task as any)?.plannedHours ? String((task as any).plannedHours) : '',
      plannedCost: (task as any)?.plannedCost ? String((task as any).plannedCost) : '',
    },
  })

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [droppedFiles, setDroppedFiles] = useStateReact<File[]>([])
  const errors = form.formState.errors
  const { toast } = useToast()

  const uploadAttachments = async (taskId: string, files: File[] | FileList | null) => {
    if (!files || (files as FileList).length === 0) return
    const arr = Array.isArray(files) ? files : Array.from(files)
    setUploading(true)
    try {
      for (const file of arr) {
        // presign step
        const presign = await api
          .post('/uploads/presign/', {
            filename: file.name,
            content_type: file.type || 'application/octet-stream',
            size: file.size,
            strategy: file.size > 10 * 1024 * 1024 ? 'chunk' : 'direct',
          })
          .then((res) => res.data)
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
          await api.post(uploadUrl.replace(api.defaults.baseURL || '', ''), formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }
        if (presign?.strategy === 'chunk' && file.size > partSize) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Görevi düzenle' : 'Görev oluştur'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await onSubmit(values as any)
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sahip</Label>
              <Select value={form.watch('owner')} onValueChange={(v) => form.setValue('owner', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.owner?.message} />
            </div>
            <div>
              <Label>Atanan</Label>
              <Select value={form.watch('assignee')} onValueChange={(v) => form.setValue('assignee', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.assignee?.message} />
            </div>
          <div>
            <Label>Ekip</Label>
            <Select
              value={form.watch('teamId') ?? 'none'}
              onValueChange={(v) => form.setValue('teamId', v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ekip seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Planlanan saat</Label>
              <Input type="number" step="0.5" {...form.register('plannedHours')} />
            </div>
            <div>
              <Label>Bütçe (para)</Label>
              <Input type="number" step="1" {...form.register('plannedCost')} />
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
                const accepted = files.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
                if (accepted.length !== files.length) {
                  toast({ title: 'Bazı dosyalar 10MB üstü veya reddedildi', variant: 'destructive' })
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

