import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { login } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { useAppStore } from '@/state/use-app-store'
import type { Role } from '@/types'

const KNOWN_ROLES: Role[] = ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse', 'Worker']
const isKnownRole = (v: unknown): v is Role => typeof v === 'string' && KNOWN_ROLES.includes(v as Role)
const defaultLandingForRole = (role?: Role) => (role === 'Admin' ? '/' : role === 'Worker' ? '/task-history' : '/crm/quotes')

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branding, setBranding] = useState<{ name: string; brand_name: string; logo_url: string } | null>(null)
  const setRole = useAppStore((s) => s.setRole)
  const hydrate = useAppStore((s) => s.hydrateFromApi)

  useEffect(() => {
    api.get('/auth/branding/')
      .then((res) => {
        if (res.data) setBranding(res.data)
      })
      .catch(() => null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      let nextPath = '/crm/quotes'
      
      // CRITICAL: Role bilgisi gelene kadar bekle
      setHydrating(true)
      try {
        const me = await api.get('/auth/me/')
        if (isKnownRole(me?.data?.role)) {
          setRole(me.data.role)
          localStorage.setItem('current-user-role', me.data.role)
          nextPath = defaultLandingForRole(me.data.role)
        }
      } catch {
        /* ignore */
      }
      
      // Store'u tazele (SSE App seviyesinde tek noktadan başlatılıyor)
      await hydrate()
      setHydrating(false)
      
      navigate({ to: nextPath as any })
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
    <main className="fixed inset-0 overflow-y-auto bg-[#f3f6f4] text-left text-[#172321]">
      <div className="grid min-h-dvh w-full lg:grid-cols-2">
        <section className="relative min-h-[260px] overflow-hidden bg-[#173f38] text-white lg:min-h-dvh">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_38%),linear-gradient(180deg,#1f594e_0%,#113932_52%,#0d2725_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(199,151,67,0.28),rgba(199,151,67,0))]" />
          <div className="relative flex min-h-[260px] w-full flex-col justify-between gap-8 px-6 py-7 sm:px-10 lg:min-h-dvh lg:px-16 lg:py-14 xl:px-20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md font-semibold overflow-hidden">
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-lg font-bold text-[#173f38] shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
                    {(branding?.brand_name || branding?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/60 lg:text-sm">
                  {branding?.brand_name || branding?.name || 'UDAR'}
                </p>
                <h1 className="text-xl font-semibold lg:text-2xl">CRM</h1>
              </div>
            </div>

            <div className="max-w-xl space-y-4 lg:space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-[#f4c56a]" />
                Yetkili kullanıcı girişi
              </div>
              <div className="space-y-3">
                <p className="max-w-lg text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                  Teklif, sözleşme ve operasyon tek yerde.
                </p>
                <p className="max-w-md text-sm leading-6 text-white/70 sm:text-base lg:text-lg lg:leading-8">
                  Ürün, müşteri, teklif ve üretim akışlarına hızlı ve güvenli erişim.
                </p>
              </div>
            </div>

            <div className="hidden grid-cols-3 gap-3 text-sm text-white/75 sm:grid lg:max-w-lg">
              <div className="rounded-md border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-lg font-semibold text-white lg:text-xl">CRM</p>
                <p>Müşteri akışı</p>
              </div>
              <div className="rounded-md border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-lg font-semibold text-white lg:text-xl">ERP</p>
                <p>Stok takibi</p>
              </div>
              <div className="rounded-md border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-lg font-semibold text-white lg:text-xl">PDF</p>
                <p>Belge çıktıları</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100dvh-260px)] items-center justify-center px-5 py-8 sm:px-8 lg:min-h-dvh lg:bg-[#f3f6f4]">
          <form
            onSubmit={handleSubmit}
            autoComplete="on"
            method="post"
            className="w-full max-w-[460px] rounded-lg border border-[#d7dfdc] bg-white p-6 shadow-[0_24px_80px_rgba(18,32,31,0.12)] sm:p-8 lg:p-9"
          >
            <div className="mb-8 space-y-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-normal text-[#14201f]">Giriş yap</h2>
                <p className="mt-2 text-sm leading-6 text-[#66736f]">Kullanıcı adı veya e-posta adresinizle devam edin.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-username" className="text-sm font-medium text-[#33413f]">
                  E-posta veya kullanıcı adı
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#87938f]" />
                  <Input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ornek@firma.com"
                    className="h-12 rounded-md border-[#cdd8d4] bg-[#f7faf9] pl-10 text-[#14201f] shadow-none placeholder:text-[#8a9894] focus-visible:ring-[#173f38]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-[#33413f]">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#87938f]" />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifreniz"
                    className="h-12 rounded-md border-[#cdd8d4] bg-[#f7faf9] pl-10 pr-11 text-[#14201f] shadow-none placeholder:text-[#8a9894] focus-visible:ring-[#173f38]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#66736f] transition hover:bg-[#e8efed] hover:text-[#173f38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173f38]"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full gap-2 rounded-md bg-[#173f38] text-white shadow-[0_12px_30px_rgba(23,63,56,0.24)] hover:bg-[#21544b]"
                disabled={loading || hydrating}
              >
                {hydrating ? 'Yükleniyor...' : loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
                {!loading && !hydrating && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
