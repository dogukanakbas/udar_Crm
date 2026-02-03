import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { login } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { useAppStore } from '@/state/use-app-store'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setRole = useAppStore((s) => s.setRole)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      try {
        const me = await api.get('/auth/me/')
        if (me?.data?.role) {
          setRole(me.data.role)
        }
      } catch {
        /* ignore */
      }
      navigate({ to: '/' })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-xl p-8 w-full max-w-sm space-y-4 border">
        <h1 className="text-xl font-semibold text-slate-900">Udar CRM Giriş</h1>
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Kullanıcı adı</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Şifre</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </Button>
        <p className="text-xs text-slate-500">Demo kullanıcı: admin / password</p>
      </form>
    </div>
  )
}

