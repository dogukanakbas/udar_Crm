import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { login } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { useAppStore } from '@/state/use-app-store'
import type { Role } from '@/types'

const KNOWN_ROLES: Role[] = ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse', 'Worker']
const isKnownRole = (v: unknown): v is Role => typeof v === 'string' && KNOWN_ROLES.includes(v as Role)

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setRole = useAppStore((s) => s.setRole)
  const hydrate = useAppStore((s) => s.hydrateFromApi)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      
      // CRITICAL: Role bilgisi gelene kadar bekle
      setHydrating(true)
      try {
        const me = await api.get('/auth/me/')
        if (isKnownRole(me?.data?.role)) {
          setRole(me.data.role)
          localStorage.setItem('current-user-role', me.data.role)
        }
      } catch {
        /* ignore */
      }
      
      // Store'u tazele (SSE App seviyesinde tek noktadan başlatılıyor)
      await hydrate()
      setHydrating(false)
      
      navigate({ to: '/' })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(
        Array.isArray(detail) ? detail[0] : typeof detail === 'string' ? detail : 'Giriş başarısız'
      )
    } finally {
      setLoading(false)
      setHydrating(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-xl p-8 w-full max-w-sm space-y-4 border">
        <h1 className="text-xl font-semibold text-slate-900">Udar CRM Giriş</h1>
        <p className="text-xs text-slate-500">
          Oturum açmak için size verilen kullanıcı adı ve şifreyi kullanın. Hesabınız e-posta ile açıldıysa giriş alanına
          o e-postayı yazmanız yeterlidir.
        </p>
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Kullanıcı adı veya e-posta</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanıcı adı" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Şifre</label>
          <Input
            type="text"
            autoComplete="current-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || hydrating}>
          {hydrating ? 'Yükleniyor...' : loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </Button>
      </form>
    </div>
  )
}

