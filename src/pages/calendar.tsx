// @ts-nocheck
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/app-shell'
import { useAppStore } from '@/state/use-app-store'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import type { Task } from '@/types'

export function CalendarPage() {
  const { data } = useAppStore()
  const meetings = data.today?.meetings || []
  const tasks = data.tasks ?? []
  const [status, setStatus] = useState<'all' | Task['status']>('all')
  const [assignee, setAssignee] = useState<string>('all')
  const [team, setTeam] = useState<string>('all')
  const [view, setView] = useState<'tasks' | 'meetings'>('tasks')

  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (status === 'all' || t.status === status) &&
          (assignee === 'all' || t.assignee === assignee) &&
          (team === 'all' || t.teamId === team)
      ),
    [tasks, status, assignee, team]
  )

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string
        items: typeof tasks
      }
    >()
    filteredTasks.forEach((t) => {
      const date = t.due || t.start || t.end
      if (!date) return
      const key = date.slice(0, 10)
      const entry = map.get(key) || { date: key, items: [] as typeof tasks }
      entry.items.push(t)
      map.set(key, entry)
    })
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [filteredTasks])

  const totalOpen = filteredTasks.filter((t) => t.status !== 'done').length

  return (
    <div className="space-y-4">
      <PageHeader title="Takvim & Toplantılar" description="Kişisel/ekip görev ve toplantı görünümü" />

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="tasks">Görev takvimi</TabsTrigger>
          <TabsTrigger value="meetings">Toplantılar</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
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
              <SelectTrigger className="w-48">
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
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger className="w-48">
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
            <div className="text-sm text-muted-foreground">Açık görev: {totalOpen}</div>
          </div>

          <div className="mt-4 space-y-3">
            {grouped.length === 0 && <p className="text-sm text-muted-foreground">Görev bulunamadı</p>}
            {grouped.map((group) => (
              <Card key={group.date}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{formatDate(group.date)}</CardTitle>
                    <p className="text-xs text-muted-foreground">{group.items.length} görev</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.items.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded border px-3 py-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Link to={`/tasks/${t.id}`} className="font-semibold hover:underline">
                            {t.title}
                          </Link>
                          <Badge variant="outline">{t.priority}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {data.users.find((u) => u.id === t.assignee)?.username || '—'} •{' '}
                          {t.teamId ? data.teams.find((tm) => tm.id === t.teamId)?.name : 'Ekip yok'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={t.status === 'done' ? 'secondary' : 'default'}>{t.status}</Badge>
                        <Badge variant="outline">{formatDate(t.due || t.start || t.end)}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="meetings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Toplantılar</CardTitle>
                <p className="text-xs text-muted-foreground">Günlük/haftalık görünüm</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a href="mailto:" aria-label="toplantı ekle">Toplantı ekle</a>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {meetings.length === 0 && <p className="text-sm text-muted-foreground">Toplantı yok</p>}
              {meetings.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-semibold">{m.subject}</p>
                    <p className="text-xs text-muted-foreground">{m.owner}</p>
                  </div>
                  <Badge variant="outline">{m.time || formatDate(m.date)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

