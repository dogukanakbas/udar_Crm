import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { RbacGuard } from '@/components/rbac'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

type WorkerDetailData = {
  worker_id: number
  worker_name: string
  worker_email: string
  primary_teams: string[]
  active_tasks: { id: number; title: string; status: string; priority: string; due: string | null; start: string | null; end: string | null; updated_at: string }[]
  completed_tasks: { id: number; title: string; status: string; priority: string; due: string | null; start: string | null; end: string | null; updated_at: string }[]
  daily_hours: Record<string, number>
  monthly_hours: Record<string, number>
}

export function WorkerDetailPage() {
  const { workerId } = useParams({ from: '/worker-tracking/$workerId' })
  const [data, setData] = useState<WorkerDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true)
        const res = await api.get('/tasks/worker-detail/', { params: { worker_id: workerId } })
        setData(res.data)
        setError(null)
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Veri yüklenemedi')
      } finally {
        setLoading(false)
      }
    }
    if (workerId) fetchDetail()
  }, [workerId])

  if (loading && !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Çalışan bulunamadı'}</p>
          <Link to="/worker-tracking" className="text-blue-600 hover:underline mt-2 inline-block">
            ← Çalışan listesine dön
          </Link>
        </div>
      </div>
    )
  }

  const dailyEntries = Object.entries(data.daily_hours || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)
  const monthlyEntries = Object.entries(data.monthly_hours || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)

  return (
    <RbacGuard perm="tasks.view">
      <div className="p-8">
        <Link
          to="/worker-tracking"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Çalışan listesine dön
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{data.worker_name}</h1>
          <p className="text-slate-600">{data.worker_email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.primary_teams.map((team) => (
              <span
                key={team}
                className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {team}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Günlük çalışma süreleri (son 14 gün)</h2>
            {dailyEntries.length === 0 ? (
              <p className="text-sm text-slate-500">Kayıt yok</p>
            ) : (
              <div className="space-y-2">
                {dailyEntries.map(([date, hours]) => (
                  <div key={date} className="flex justify-between text-sm">
                    <span>{formatDate(date)}</span>
                    <span className="font-medium">{hours.toFixed(1)} saat</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Aylık çalışma süreleri (son 12 ay)</h2>
            {monthlyEntries.length === 0 ? (
              <p className="text-sm text-slate-500">Kayıt yok</p>
            ) : (
              <div className="space-y-2">
                {monthlyEntries.map(([month, hours]) => (
                  <div key={month} className="flex justify-between text-sm">
                    <span>{month}</span>
                    <span className="font-medium">{hours.toFixed(1)} saat</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Aktif görevler ({data.active_tasks.length})</h2>
            {data.active_tasks.length === 0 ? (
              <p className="text-sm text-slate-500">Aktif görev yok</p>
            ) : (
              <div className="space-y-2">
                {data.active_tasks.map((t) => (
                  <Link
                    key={t.id}
                    to="/tasks/$taskId"
                    params={{ taskId: String(t.id) }}
                    className="block rounded border p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="font-medium">{t.title}</div>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{t.status}</span>
                      <span>{t.priority}</span>
                      {t.due && <span>Vade: {formatDate(t.due)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Tamamlanan görevler (son 50)</h2>
            {data.completed_tasks.length === 0 ? (
              <p className="text-sm text-slate-500">Tamamlanan görev yok</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.completed_tasks.map((t) => (
                  <Link
                    key={t.id}
                    to="/tasks/$taskId"
                    params={{ taskId: String(t.id) }}
                    className="block rounded border p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="font-medium">{t.title}</div>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{t.status}</span>
                      {t.updated_at && <span>Bitiş: {formatDate(t.updated_at)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </RbacGuard>
  )
}
