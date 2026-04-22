import { Link } from '@tanstack/react-router'

import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/state/use-app-store'
import { formatDate } from '@/lib/utils'

export function TaskHistoryPage() {
  const { data } = useAppStore()
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null
  const myTeamIds = data.teams
    .filter((t) => t.memberIds?.includes(String(currentUserId || '')) || String(t.leaderId || '') === String(currentUserId || ''))
    .map((t) => t.id)

  const completed = (data.tasks || [])
    .filter((t) => t.status === 'done' && !!t.salesOrder)
    .filter((t) => {
      if (!currentUserId) return true
      if (String(t.assignee || '') === String(currentUserId)) return true
      if (t.currentTeam && myTeamIds.includes(String(t.currentTeam))) return true
      if (t.teamId && myTeamIds.includes(String(t.teamId))) return true
      return false
    })
    .sort((a, b) => new Date(b.end || b.due || 0).getTime() - new Date(a.end || a.due || 0).getTime())

  return (
    <div className="space-y-4">
      <PageHeader title="Geçmiş Görevler" description="Tamamlanan sipariş görevleri" />
      <Card>
        <CardHeader>
          <CardTitle>Tamamlanan Siparişler</CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="space-y-2">
              {completed.map((t) => (
                <Link
                  key={t.id}
                  to="/tasks/$taskId"
                  params={{ taskId: t.id }}
                  className="flex items-center justify-between rounded border p-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Sipariş: {t.salesOrder} • Bitiş: {t.end ? formatDate(t.end) : '—'}
                    </p>
                  </div>
                  <Badge variant="secondary">Tamamlandı</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
