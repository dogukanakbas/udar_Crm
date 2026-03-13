import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { RbacGuard } from '@/components/rbac'
import api from '@/lib/api'

type WorkerTracking = {
  worker_id: number
  worker_name: string
  worker_email: string
  primary_teams: string[]
  current_department: string | null
  active_tasks_count: number
  last_handover: {
    from_team_name: string
    to_team_name: string
    by: string
    note: string
    at: string
  } | null
  last_activity: string | null
}

type TrackingResponse = {
  workers: WorkerTracking[]
  total_workers: number
  timestamp: string
}

export function WorkerTrackingPage() {
  const [data, setData] = useState<TrackingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTracking = async () => {
    try {
      setLoading(true)
      const res = await api.get('/tasks/worker-tracking/')
      setData(res.data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTracking()
    // Her 30 saniyede bir güncelle
    const interval = setInterval(fetchTracking, 30000)
    return () => clearInterval(interval)
  }, [])

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

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <RbacGuard perm="tasks.view">
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Çalışan Takibi</h1>
            <p className="text-sm text-slate-600 mt-1">
              Çalışanların hangi departmanda çalıştığını gerçek zamanlı takip edin
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              Son güncelleme: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('tr-TR') : '-'}
            </div>
            <button
              onClick={fetchTracking}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Yenile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-600">Toplam Çalışan</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{data?.total_workers || 0}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-600">Aktif Görevli</div>
            <div className="text-3xl font-bold text-green-600 mt-1">
              {data?.workers.filter((w) => w.active_tasks_count > 0).length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-600">Departman Değişimi</div>
            <div className="text-3xl font-bold text-orange-600 mt-1">
              {data?.workers.filter((w) => w.last_handover).length || 0}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Çalışan</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Ana Ekip</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Şu An Çalıştığı Departman</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Aktif Görev</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Son Aktivite</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Son Departman Değişimi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data?.workers.map((worker) => (
                <tr key={worker.worker_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to="/worker-tracking/$workerId"
                      params={{ workerId: String(worker.worker_id) }}
                      className="block font-medium text-slate-900 hover:text-blue-600"
                    >
                      {worker.worker_name}
                    </Link>
                    <div className="text-sm text-slate-600">{worker.worker_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {worker.primary_teams.map((team) => (
                        <span
                          key={team}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {team}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {worker.current_department ? (
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          worker.last_handover
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {worker.current_department}
                        {worker.last_handover && ' 🔄'}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        worker.active_tasks_count > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {worker.active_tasks_count} görev
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {worker.last_activity ? (
                      <div className="text-sm text-slate-600">
                        {new Date(worker.last_activity).toLocaleString('tr-TR')}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {worker.last_handover ? (
                      <div className="text-sm">
                        <div className="font-medium text-slate-900">
                          {worker.last_handover.from_team_name} → {worker.last_handover.to_team_name}
                        </div>
                        <div className="text-slate-600 mt-1">{worker.last_handover.note}</div>
                        <div className="text-slate-400 text-xs mt-1">
                          {new Date(worker.last_handover.at).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.workers.length === 0 && (
            <div className="p-8 text-center text-slate-600">Henüz çalışan kaydı yok</div>
          )}
        </div>
      </div>
    </RbacGuard>
  )
}
