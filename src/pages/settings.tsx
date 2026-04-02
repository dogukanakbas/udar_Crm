import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { useTheme } from '@/components/theme-provider'
import { useEffect, useState } from 'react'
import type { AutomationRule } from '@/types'
import api from '@/lib/api'
import { ROLE_LABEL_TR } from '@/lib/role-labels'
import { DataTable } from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import type { UserLite } from '@/types'
import { AlertCircle, ShieldCheck, Plus, Trash2, ImageIcon } from 'lucide-react'
import { RbacGuard } from '@/components/rbac'

function formatApiError(err: unknown): string {
  const e = err as { response?: { data?: Record<string, unknown> | string } }
  const d = e?.response?.data
  if (!d) return 'İşlem başarısız'
  if (typeof d === 'string') return d
  const detail = (d as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(String).join(', ')
  const parts: string[] = []
  for (const [k, v] of Object.entries(d)) {
    if (k === 'detail') continue
    parts.push(`${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
  }
  if (parts.length) return parts.join(' · ')
  return 'İşlem başarısız'
}

export function SettingsPage() {
  const { data, resetDemo, setLocale } = useAppStore()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [notifMuted, setNotifMuted] = useState(false)
  const [notifSlack, setNotifSlack] = useState('')
  const [notifEmail, setNotifEmail] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userUsername, setUserUsername] = useState('')
  const [userFullName, setUserFullName] = useState('')
  const [userRole, setUserRole] = useState('Worker')
  const [userTeamId, setUserTeamId] = useState<string | undefined>(undefined)
  const [generatedPass, setGeneratedPass] = useState<string | null>(null)
  const [bulkUserLines, setBulkUserLines] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [automationName, setAutomationName] = useState('')
  const [automationTrigger, setAutomationTrigger] = useState<'task_status_changed' | 'task_due_soon' | 'task_created'>('task_status_changed')
  const [automationAction, setAutomationAction] = useState<
    'add_comment' | 'set_assignee' | 'notify' | 'multi_notify' | 'add_tag' | 'set_field'
  >('add_comment')
  const [automationCondition, setAutomationCondition] = useState<any>({})
  const [automationPayload, setAutomationPayload] = useState<any>({})
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyWebhook, setNotifyWebhook] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [tagValue, setTagValue] = useState('')
  const [fieldName, setFieldName] = useState<'priority' | 'status' | ''>('')
  const [fieldValue, setFieldValue] = useState('')
  const [multiEmails, setMultiEmails] = useState('')
  const [multiWebhooks, setMultiWebhooks] = useState('')
  const [viewOnly, setViewOnly] = useState(false)
  const [rules, setRules] = useState<AutomationRule[]>([])
  const icsUrl = `${window.location.origin}/api/calendar/ics/`
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [health, setHealth] = useState<{ backend?: string; db?: string; redis?: string }>({})
  const [taskModels, setTaskModels] = useState<
    { id: number; code: string; name: string; image_url?: string; duration_minutes: number; blade_min?: number; blade_max?: number; thickness_mm?: number; sizes: string[] }[]
  >([])
  const [newModelCode, setNewModelCode] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newModelDuration, setNewModelDuration] = useState(4)
  const [newModelWidth, setNewModelWidth] = useState('')
  const [newModelHeight, setNewModelHeight] = useState('')
  const [newModelSizes, setNewModelSizes] = useState('73x210, 83x210, 93x210')
  const [newModelBladeMin, setNewModelBladeMin] = useState('1.5')
  const [newModelBladeMax, setNewModelBladeMax] = useState('1.5')
  const [newModelThickness, setNewModelThickness] = useState('')
  const [workingHoursStart, setWorkingHoursStart] = useState('08:00')
  const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00')
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4])
  type TeamAssociateRow = {
    id: number
    full_name: string
    phone: string
    notes: string
    teams: number[]
    is_active: boolean
  }
  const [teamAssociates, setTeamAssociates] = useState<TeamAssociateRow[]>([])
  const [assocName, setAssocName] = useState('')
  const [assocPhone, setAssocPhone] = useState('')
  const [assocNotes, setAssocNotes] = useState('')
  const [assocTeamIds, setAssocTeamIds] = useState<number[]>([])

  const loadTeamAssociates = async () => {
    try {
      const res = await api.get('/team-associates/')
      const raw = res.data?.results ?? res.data
      setTeamAssociates(Array.isArray(raw) ? raw : [])
    } catch {
      setTeamAssociates([])
    }
  }

  const userColumns: ColumnDef<UserLite>[] = [
    {
      accessorKey: 'username',
      header: 'Kullanıcı',
      cell: ({ row }) => {
        const d = [row.original.firstName, row.original.lastName].filter(Boolean).join(' ').trim()
        return d ? `${d} · @${row.original.username}` : row.original.username
      },
    },
    { accessorKey: 'email', header: 'E-posta' },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => ROLE_LABEL_TR[row.original.role] ?? row.original.role,
    },
    ...(data.settings.role === 'Admin'
      ? ([
          {
            id: 'user-actions',
            header: '',
            cell: ({ row }: { row: { original: UserLite } }) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                onClick={async () => {
                  if (
                    !confirm(
                      `${row.original.username} kullanıcısını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
                    )
                  )
                    return
                  try {
                    await api.delete(`/auth/users/${row.original.id}/`)
                    await useAppStore.getState().hydrateFromApi()
                    toast({ title: 'Kullanıcı silindi' })
                  } catch (err: any) {
                    const d = err?.response?.data
                    const msg =
                      (typeof d?.detail === 'string' && d.detail) ||
                      (Array.isArray(d?.detail) && d.detail[0]) ||
                      (d && typeof d === 'object' && Object.values(d).flat().find((x) => typeof x === 'string')) ||
                      'Silinemedi'
                    toast({ title: 'Hata', description: String(msg), variant: 'destructive' })
                  }
                }}
              >
                Sil
              </Button>
            ),
          },
        ] as ColumnDef<UserLite>[])
      : []),
  ]


  const loadRules = async () => {
    const res = await api.get('/automation-rules/')
    setRules(res.data || [])
  }

  const loadTaskModels = async () => {
    try {
      const res = await api.get('/task-models/')
      setTaskModels(res.data || [])
    } catch {
      setTaskModels([])
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  useEffect(() => {
    loadTaskModels()
  }, [])

  useEffect(() => {
    loadTeamAssociates()
  }, [])

  useEffect(() => {
    api
      .get('/auth/organization-settings/')
      .then((res) => {
        const d = res.data || {}
        setWorkingHoursStart(d.working_hours_start || '08:00')
        setWorkingHoursEnd(d.working_hours_end || '18:00')
        setWorkingDays(Array.isArray(d.working_days) ? d.working_days : [0, 1, 2, 3, 4])
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    api
      .get('/health/')
      .then((res) => setHealth(res.data || {}))
      .catch(() => setHealth({ backend: 'fail' }))
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('notification-settings')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setNotifMuted(!!parsed.muted)
        setNotifSlack(parsed.slack || '')
        setNotifEmail(parsed.email || '')
        setViewOnly(!!parsed.view_only)
      } catch {
        /* ignore */
      }
    }
    // remote prefs
    api
      .get('/auth/notification-prefs/')
      .then((res) => {
        const p = res.data || {}
        setNotifMuted(!!p.muted)
        setNotifSlack(p.slack || '')
        setNotifEmail(p.email || '')
        setViewOnly(!!p.view_only)
      })
      .catch(() => null)
  }, [])

  const saveNotifSettings = () => {
    const payload = { muted: notifMuted, slack: notifSlack, email: notifEmail, view_only: viewOnly }
    localStorage.setItem('notification-settings', JSON.stringify(payload))
    api
      .post('/auth/notification-prefs/', payload)
      .then(() => toast({ title: 'Bildirim ayarlandı', description: notifMuted ? 'Sessize alındı' : 'Aktif' }))
      .catch(() => toast({ title: 'Kaydedilemedi', variant: 'destructive' }))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ayarlar" description="Çalışma alanı tercihleri, kullanıcılar, tema" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organizasyon profili</CardTitle>
            <CardDescription>Organizasyon adı ve yerel ayarlar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Ad</Label>
              <Input defaultValue="" placeholder="Organizasyon adı" />
            </div>
            <div>
              <Label>Yerel ayar</Label>
              <Select value={data.settings.locale} onValueChange={(v) => setLocale(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">İngilizce (US)</SelectItem>
                  <SelectItem value="tr-TR">Türkçe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => toast({ title: 'Profil kaydedildi' })}>Kaydet</Button>
          </CardContent>
        </Card>
        <RbacGuard perm="teams.edit">
          <Card>
            <CardHeader>
              <CardTitle>Mesai saatleri</CardTitle>
              <CardDescription>Worker ekibi sadece mesai saatleri ve günleri içinde giriş yapabilir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mesai başlangıç</Label>
                  <Input
                    type="time"
                    value={workingHoursStart}
                    onChange={(e) => setWorkingHoursStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Mesai bitiş</Label>
                  <Input
                    type="time"
                    value={workingHoursEnd}
                    onChange={(e) => setWorkingHoursEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Mesai günleri</Label>
                <p className="text-xs text-muted-foreground mb-2">Worker girişi için izin verilen günler (Pzt=0, Paz=6)</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 0, l: 'Pzt' },
                    { v: 1, l: 'Sal' },
                    { v: 2, l: 'Çar' },
                    { v: 3, l: 'Per' },
                    { v: 4, l: 'Cum' },
                    { v: 5, l: 'Cmt' },
                    { v: 6, l: 'Paz' },
                  ].map(({ v, l }) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workingDays.includes(v)}
                        onChange={(e) => {
                          if (e.target.checked) setWorkingDays((d) => [...d, v].sort((a, b) => a - b))
                          else setWorkingDays((d) => d.filter((x) => x !== v))
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button
                onClick={async () => {
                  try {
                    await api.patch('/auth/organization-settings/', {
                      working_hours_start: workingHoursStart,
                      working_hours_end: workingHoursEnd,
                      working_days: workingDays,
                    })
                    toast({ title: 'Mesai ayarları kaydedildi' })
                  } catch (err: any) {
                    toast({ title: 'Hata', description: err?.response?.data?.detail || 'Kaydedilemedi', variant: 'destructive' })
                  }
                }}
              >
                Kaydet
              </Button>
            </CardContent>
          </Card>
        </RbacGuard>
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcılar & roller</CardTitle>
            <CardDescription>
              Tek tek: kullanıcı adı veya e-posta ile oluşturun (e-postası yoksa yalnızca kullanıcı adı + ad soyad yeterli;
              giriş ekranında şifre ile bu kullanıcı adı kullanılır). Toplu: her satıra bir kişi yazın, sistem kullanıcı adını
              üretir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tek kullanıcı — kullanıcı adı (e-posta yoksa zorunlu)</Label>
              <Input
                value={userUsername}
                onChange={(e) => setUserUsername(e.target.value)}
                placeholder="örn. ali.yilmaz"
                autoComplete="off"
              />
              <Label>Tek kullanıcı — ad soyad (isteğe bağlı, listede görünür)</Label>
              <Input
                value={userFullName}
                onChange={(e) => setUserFullName(e.target.value)}
                placeholder="örn. Ali Yılmaz"
              />
              <Label>Tek kullanıcı — e-posta (isteğe bağlı; doluysa hem e-posta hem giriş adı olur)</Label>
              <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="ornek@firma.com" />
              <Label>Rol</Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Worker', 'Support', 'Sales', 'Finance', 'Manager', 'Warehouse', 'Admin'].map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL_TR[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Ekip (isteğe bağlı)</Label>
              <Select value={userTeamId ?? 'none'} onValueChange={(v) => setUserTeamId(v === 'none' ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ekip seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {data.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const payload: Record<string, string> = { role: userRole }
                    const u = userUsername.trim()
                    const em = userEmail.trim()
                    const fn = userFullName.trim()
                    if (u) payload.username = u
                    if (em) payload.email = em
                    if (fn) payload.full_name = fn
                    if (!payload.username && !payload.email) {
                      toast({
                        title: 'Eksik bilgi',
                        description: 'Kullanıcı adı veya e-postadan en az biri gerekli.',
                        variant: 'destructive',
                      })
                      return
                    }
                    const resp = await api.post('/auth/create-user/', payload)
                    const newUser = resp.data
                    if (userTeamId) {
                      const team = data.teams.find((t) => String(t.id) === String(userTeamId))
                      const memberNums = (team ? team.memberIds : []).map((id) => Number(id))
                      const uid = Number(newUser.id)
                      await api.patch(`/teams/${userTeamId}/`, {
                        members: [...new Set([...memberNums, uid])].filter((n) => Number.isFinite(n)),
                      })
                    }
                    await useAppStore.getState().hydrateFromApi()
                    setGeneratedPass(resp.data.password)
                    toast({
                      title: 'Kullanıcı oluşturuldu',
                      description: `Giriş adı: ${resp.data.username} — Şifre: ${resp.data.password}`,
                    })
                    setUserUsername('')
                    setUserFullName('')
                    setUserEmail('')
                  } catch (err: unknown) {
                    toast({ title: 'Hata', description: formatApiError(err), variant: 'destructive' })
                  }
                }}
              >
                Kullanıcı oluştur
              </Button>
              {generatedPass && (
                <p className="text-xs text-muted-foreground">
                  Son üretilen şifre (kopyalayın): <span className="font-mono">{generatedPass}</span>
                </p>
              )}
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold">Toplu kullanıcı (sadece ad soyad listesi)</p>
              <p className="text-xs text-muted-foreground">
                Her satıra bir kişi: örn. <span className="font-mono">Mehmet Yılmaz</span>. Sistem kullanıcı adını
                (mehmet.yilmaz vb.) ve rastgele şifreyi üretir. Çıktıyı mutlaka kaydedin.
              </p>
              <Label>Rol (toplu)</Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Worker', 'Support', 'Sales', 'Finance', 'Manager', 'Warehouse', 'Admin'].map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL_TR[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={bulkUserLines}
                onChange={(e) => setBulkUserLines(e.target.value)}
                placeholder={'Ahmet Yılm\nAyşe Demir\nVeli Kaya'}
                className="min-h-[140px] font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={bulkBusy || !bulkUserLines.trim()}
                  onClick={async () => {
                    setBulkBusy(true)
                    try {
                      const res = await api.post('/auth/bulk-create-users/', { lines: bulkUserLines, role: userRole })
                      const created = res.data?.created || []
                      const errors = res.data?.errors || []
                      if (created.length) {
                        const lines = ['kullanici_adi;sifre;ad_soyad', ...created.map((c: any) => `${c.username};${c.password};${c.full_name}`)]
                        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `yeni_kullanicilar_${new Date().toISOString().slice(0, 10)}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }
                      toast({
                        title: res.data?.summary || 'Toplu oluşturma bitti',
                        description:
                          errors.length > 0
                            ? `${errors.length} satır atlandı. Ayrıntı konsol veya yanıt gövdesinde.`
                            : 'CSV indirildi; şifreleri güvenli paylaşın.',
                      })
                      await useAppStore.getState().hydrateFromApi()
                      setBulkUserLines('')
                    } catch (err: unknown) {
                      toast({ title: 'Hata', description: formatApiError(err), variant: 'destructive' })
                    } finally {
                      setBulkBusy(false)
                    }
                  }}
                >
                  Toplu oluştur ve CSV indir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bildirimler</CardTitle>
            <CardDescription>E-posta, masaüstü, Slack ayarları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-sm">Sessize al</span>
              <Switch checked={notifMuted} onCheckedChange={setNotifMuted} />
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-sm">Salt okunur görünüm</span>
              <Switch checked={viewOnly} onCheckedChange={setViewOnly} />
            </div>
            <div className="space-y-2">
              <Label>Slack bildirim adresi (webhook)</Label>
              <Input value={notifSlack} onChange={(e) => setNotifSlack(e.target.value)} placeholder="https://… (webhook URL)" />
            </div>
            <div className="space-y-2">
              <Label>Bildirim e-postası</Label>
              <Input value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} placeholder="ops@firma.com" />
            </div>
            <Button onClick={saveNotifSettings}>Kaydet</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Şifre değiştir</CardTitle>
            <CardDescription>Eski şifreyi doğrulayarak yeni şifre belirle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Eski şifre</Label>
              <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Yeni şifre</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Yeni şifre (tekrar)</Label>
              <Input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
            </div>
            <Button
              onClick={async () => {
                if (!oldPassword || !newPassword || !newPassword2) {
                  toast({ title: 'Hata', description: 'Tüm alanlar gerekli', variant: 'destructive' })
                  return
                }
                if (newPassword !== newPassword2) {
                  toast({ title: 'Hata', description: 'Yeni şifreler eşleşmiyor', variant: 'destructive' })
                  return
                }
                try {
                  await api.post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword })
                  toast({ title: 'Şifre güncellendi' })
                  setOldPassword('')
                  setNewPassword('')
                  setNewPassword2('')
                } catch (err: any) {
                  toast({
                    title: 'Hata',
                    description: err?.response?.data?.detail || 'Güncellenemedi',
                    variant: 'destructive',
                  })
                }
              }}
            >
              Şifreyi güncelle
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tema ve yerel veri</CardTitle>
            <CardDescription>Açık/koyu tema; tarayıcıda önbelleğe alınan çalışma alanı verisini temizleme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              Tema: {theme === 'dark' ? 'açık' : 'koyu'}
            </Button>
            <Button variant="destructive" onClick={() => { resetDemo(); toast({ title: 'Yerel veri sıfırlandı' }) }}>
              Yerel önbelleği temizle
            </Button>
            <div className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
              API anahtarları ve üçüncü taraf entegrasyonları yalnızca yetkili ortamınızda yapılandırın.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sağlık / Bağımlılıklar</CardTitle>
            <CardDescription>Uygulama, veritabanı ve önbellek durumu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {['backend', 'db', 'redis'].map((k) => {
              const val = (health as any)?.[k] || 'unknown'
              const ok = val === 'ok'
              const valTr = val === 'ok' ? 'tamam' : val === 'fail' ? 'hata' : val === 'unknown' ? 'bilinmiyor' : String(val)
              return (
                <div key={k} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {ok ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                    <span>
                      {k === 'backend' ? 'Uygulama' : k === 'db' ? 'Veritabanı' : k === 'redis' ? 'Redis' : k}
                    </span>
                  </div>
                  <Badge variant={ok ? 'secondary' : 'destructive'}>{valTr}</Badge>
                </div>
              )
            })}
            <Button variant="outline" size="sm" onClick={() => api.get('/health/').then((res) => setHealth(res.data || {}))}>
              Yenile
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Otomasyon kuralları</CardTitle>
            <CardDescription>Koşul → aksiyon (durum, SLA, atama)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ad</Label>
                <Input value={automationName} onChange={(e) => setAutomationName(e.target.value)} placeholder="Örn. Done yorumu ekle" />
              </div>
              <div>
                <Label>Trigger</Label>
                <Select value={automationTrigger} onValueChange={(v) => setAutomationTrigger(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task_status_changed">Durum değişti</SelectItem>
                    <SelectItem value="task_due_soon">Vade yaklaşıyor</SelectItem>
                    <SelectItem value="task_created">Görev oluşturuldu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Aksiyon</Label>
                <Select value={automationAction} onValueChange={(v) => setAutomationAction(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add_comment">Yorum ekle</SelectItem>
                    <SelectItem value="set_assignee">Atayan değiştir</SelectItem>
                    <SelectItem value="notify">Bildirim</SelectItem>
                    <SelectItem value="multi_notify">Çoklu bildirim</SelectItem>
                    <SelectItem value="add_tag">Etiket ekle</SelectItem>
                    <SelectItem value="set_field">Alan değiştir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Koşul (JSON)</Label>
                <Input
                  placeholder='{"from":"todo","to":"done"} veya {"hours":24}'
                  onChange={(e) => {
                    try {
                      setAutomationCondition(JSON.parse(e.target.value || '{}'))
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Aksiyon verisi (JSON)</Label>
              <Input
                placeholder='{"comment":"Tamamlandı"} veya {"assignee": 3} veya {"tag":"SLA"} veya {"field":"priority","value":"high"}'
                onChange={(e) => {
                  try {
                    setAutomationPayload(JSON.parse(e.target.value || '{}'))
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </div>
            {automationAction === 'notify' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mesaj</Label>
                  <Input value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Bildirim mesajı" />
                </div>
                <div>
                  <Label>Webhook</Label>
                  <Input value={notifyWebhook} onChange={(e) => setNotifyWebhook(e.target.value)} placeholder="Slack webhook adresi" />
                </div>
                <div>
                  <Label>E-posta</Label>
                  <Input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} placeholder="ops@firma.com" />
                </div>
              </div>
            )}
            {automationAction === 'multi_notify' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mesaj</Label>
                  <Input value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Bildirim mesajı" />
                </div>
                <div>
                  <Label>E-postalar (virgül)</Label>
                  <Input value={multiEmails} onChange={(e) => setMultiEmails(e.target.value)} placeholder="a@b.com,c@d.com" />
                </div>
                <div>
                  <Label>Webhooklar (virgül)</Label>
                  <Input value={multiWebhooks} onChange={(e) => setMultiWebhooks(e.target.value)} placeholder="https://hook1,https://hook2" />
                </div>
              </div>
            )}
            {automationAction === 'add_tag' && (
              <div>
                <Label>Etiket</Label>
                <Input value={tagValue} onChange={(e) => setTagValue(e.target.value)} placeholder="SLA" />
              </div>
            )}
            {automationAction === 'set_field' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Alan</Label>
                  <Select value={fieldName} onValueChange={(v) => setFieldName(v as any)}>
                    <SelectTrigger><SelectValue placeholder="öncelik / durum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">priority</SelectItem>
                      <SelectItem value="status">status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Değer</Label>
                  <Input value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} placeholder="örn. yüksek / tamamlandı" />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    const payload = {
                      ...(automationPayload || {}),
                      ...(automationAction === 'notify'
                        ? {
                            message: notifyMessage || undefined,
                            webhook: notifyWebhook || undefined,
                            email: notifyEmail || undefined,
                          }
                        : {}),
                      ...(automationAction === 'multi_notify'
                        ? {
                            message: notifyMessage || undefined,
                            emails: multiEmails
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                            webhooks: multiWebhooks
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          }
                        : {}),
                      ...(automationAction === 'add_tag'
                        ? {
                            tag: tagValue || undefined,
                          }
                        : {}),
                      ...(automationAction === 'set_field'
                        ? {
                            field: fieldName || undefined,
                            value: fieldValue || undefined,
                          }
                        : {}),
                    }
                    await api.post('/automation-rules/', {
                      name: automationName || 'Yeni kural',
                      trigger: automationTrigger,
                      condition: automationCondition,
                      action: automationAction,
                      action_payload: payload,
                    })
                    await loadRules()
                    toast({ title: 'Kural eklendi' })
                    setAutomationName('')
                  } catch (err: any) {
                    toast({ title: 'Hata', description: err?.response?.data?.detail || 'Oluşturulamadı', variant: 'destructive' })
                  }
                }}
              >
                Kaydet
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const payload = {
                      ...(automationPayload || {}),
                      ...(automationAction === 'notify'
                        ? { message: notifyMessage || undefined, webhook: notifyWebhook || undefined, email: notifyEmail || undefined }
                        : {}),
                      ...(automationAction === 'multi_notify'
                        ? {
                            message: notifyMessage || undefined,
                            emails: multiEmails
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                            webhooks: multiWebhooks
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          }
                        : {}),
                      ...(automationAction === 'add_tag' ? { tag: tagValue || undefined } : {}),
                      ...(automationAction === 'set_field' ? { field: fieldName || undefined, value: fieldValue || undefined } : {}),
                    }
                    const res = await api.post('/automation-rules/test/', {
                      trigger: automationTrigger,
                      condition: automationCondition,
                      action: automationAction,
                      action_payload: payload,
                      sample_task: {},
                      extra: {},
                    })
                    toast({
                      title: res.data?.would_run ? 'Koşul sağlandı' : 'Koşul sağlanmadı',
                      description: JSON.stringify(res.data),
                    })
                  } catch (err: any) {
                    toast({
                      title: 'Test hata',
                      description: err?.response?.data?.detail || 'Test çalıştırılamadı',
                      variant: 'destructive',
                    })
                  }
                }}
              >
                Test et (dry-run)
              </Button>
            </div>
            <div className="space-y-2">
              {rules.length === 0 && <p className="text-sm text-muted-foreground">Kural yok</p>}
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.trigger} → {r.action}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.is_active ? 'Aktif' : 'Pasif'}</Badge>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={async (val) => {
                        await api.patch(`/automation-rules/${r.id}/`, { is_active: val })
                        loadRules()
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <RbacGuard perm="tasks.edit">
          <Card>
            <CardHeader>
              <CardTitle>Görev modelleri</CardTitle>
              <CardDescription>Sabit görevler için model/ürün tanımları. Resim ekleyebilir, model ekleyip silebilirsiniz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Kod</Label>
                  <Input value={newModelCode} onChange={(e) => setNewModelCode(e.target.value)} placeholder="AY-01" className="w-24" />
                </div>
                <div>
                  <Label className="text-xs">Ad</Label>
                  <Input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Model adı" className="w-32" />
                </div>
                <div>
                  <Label className="text-xs">Süre (dk)</Label>
                  <Input type="number" value={newModelDuration} onChange={(e) => setNewModelDuration(Number(e.target.value) || 4)} className="w-20" />
                </div>
                <div>
                  <Label className="text-xs">En (mm)</Label>
                  <Input
                    value={newModelWidth}
                    onChange={(e) => setNewModelWidth(e.target.value)}
                    placeholder="73"
                    className="w-16"
                  />
                </div>
                <div>
                  <Label className="text-xs">Boy (mm)</Label>
                  <Input
                    value={newModelHeight}
                    onChange={(e) => setNewModelHeight(e.target.value)}
                    placeholder="210"
                    className="w-16"
                  />
                </div>
                <div>
                  <Label className="text-xs">Ek ölçüler</Label>
                  <Input value={newModelSizes} onChange={(e) => setNewModelSizes(e.target.value)} placeholder="83x210, 93x210" className="w-40" />
                </div>
                <div>
                  <Label className="text-xs">Bıçak min (mm)</Label>
                  <Input
                    value={newModelBladeMin}
                    onChange={(e) => setNewModelBladeMin(e.target.value)}
                    className="w-16"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bıçak max (mm)</Label>
                  <Input
                    value={newModelBladeMax}
                    onChange={(e) => setNewModelBladeMax(e.target.value)}
                    className="w-16"
                  />
                </div>
                <div>
                  <Label className="text-xs">Kalınlık (mm)</Label>
                  <Input
                    value={newModelThickness}
                    onChange={(e) => setNewModelThickness(e.target.value)}
                    placeholder="—"
                    className="w-16"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const w = newModelWidth.trim() ? Number(newModelWidth) : null
                      const h = newModelHeight.trim() ? Number(newModelHeight) : null
                      const fromWh =
                        w != null && h != null && !Number.isNaN(w) && !Number.isNaN(h) ? [`${w}x${h}`] : []
                      const extraSizes = newModelSizes.split(',').map((s) => s.trim()).filter(Boolean)
                      const bmin = Number(newModelBladeMin)
                      const bmax = Number(newModelBladeMax)
                      const thick = newModelThickness.trim() ? Number(newModelThickness) : null
                      await api.post('/task-models/', {
                        code: newModelCode.trim(),
                        name: newModelName.trim(),
                        duration_minutes: newModelDuration,
                        width_mm: w,
                        height_mm: h,
                        thickness_mm: thick != null && !Number.isNaN(thick) ? thick : null,
                        sizes: [...fromWh, ...extraSizes.filter((s) => !fromWh.includes(s))],
                        blade_min: Number.isFinite(bmin) ? bmin : 1.5,
                        blade_max: Number.isFinite(bmax) ? bmax : 1.5,
                      })
                      await loadTaskModels()
                      setNewModelCode('')
                      setNewModelName('')
                      toast({ title: 'Model eklendi' })
                    } catch (err: any) {
                      toast({ title: 'Hata', description: err?.response?.data?.detail || 'Eklenemedi', variant: 'destructive' })
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ekle
                </Button>
              </div>
              <div className="space-y-2">
                {taskModels.length === 0 && <p className="text-sm text-muted-foreground">Henüz model yok. Yukarıdan ekleyin.</p>}
                {taskModels.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded border p-2">
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.code} className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{m.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.name || '—'} • {m.duration_minutes} dk
                        {m.thickness_mm != null ? ` • Kalınlık ${m.thickness_mm} mm` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`model-img-${m.id}`}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const fd = new FormData()
                          fd.append('image', file)
                          try {
                            await api.patch(`/task-models/${m.id}/`, fd)
                            await loadTaskModels()
                            toast({ title: 'Resim yüklendi' })
                          } catch (err: any) {
                            toast({ title: 'Hata', description: err?.response?.data?.detail || 'Yüklenemedi', variant: 'destructive' })
                          }
                          e.target.value = ''
                        }}
                      />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById(`model-img-${m.id}`)?.click()}>
                        Resim
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={async () => {
                          try {
                            await api.delete(`/task-models/${m.id}/`)
                            await loadTaskModels()
                            toast({ title: 'Model silindi' })
                          } catch (err: any) {
                            toast({ title: 'Hata', description: err?.response?.data?.detail || 'Silinemedi', variant: 'destructive' })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </RbacGuard>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcı listesi</CardTitle>
            <CardDescription>Sistem kullanıcıları</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={userColumns} data={data.users} searchKey="username" />
          </CardContent>
        </Card>
        <RbacGuard perm="teams.edit">
          <Card>
            <CardHeader>
              <CardTitle>Ekipler</CardTitle>
              <CardDescription>
                Üye ekleme/çıkarma, usta başı (lider) atama. Görevler ekibe düşünce önce lidere gider; lider “Ekibe aç” ile havuza
                alır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Yeni ekip adı" className="max-w-xs" />
                <Button
                  onClick={async () => {
                    try {
                      await api.post('/teams/', { name: teamName.trim() || 'Ekip' })
                      await useAppStore.getState().hydrateFromApi()
                      setTeamName('')
                      toast({ title: 'Ekip oluşturuldu' })
                    } catch (err: any) {
                      toast({ title: 'Hata', description: err?.response?.data?.detail || 'Oluşturulamadı', variant: 'destructive' })
                    }
                  }}
                >
                  Oluştur
                </Button>
              </div>
              <div className="space-y-4">
                {data.teams.map((team) => {
                  const members = team.memberIds
                    .map((id) => data.users.find((u) => u.id === id))
                    .filter(Boolean) as UserLite[]
                  const addCandidates = data.users.filter((u) => !team.memberIds.includes(u.id))
                  return (
                    <div key={team.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{team.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-8"
                          onClick={async () => {
                            if (!confirm(`${team.name} ekibini silmek istediğinize emin misiniz?`)) return
                            try {
                              await api.delete(`/teams/${team.id}/`)
                              await useAppStore.getState().hydrateFromApi()
                              toast({ title: 'Ekip silindi' })
                            } catch (err: any) {
                              toast({ title: 'Hata', description: err?.response?.data?.detail || 'Silinemedi', variant: 'destructive' })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                        <Label className="text-xs whitespace-nowrap">Usta başı (lider)</Label>
                        <Select
                          value={team.leaderId != null && String(team.leaderId) !== '' ? String(team.leaderId) : 'none'}
                          onValueChange={async (v) => {
                            const leader = v === 'none' ? null : Number(v)
                            try {
                              await api.patch(`/teams/${team.id}/`, {
                                leader,
                                members: team.memberIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)),
                              })
                              await useAppStore.getState().hydrateFromApi()
                              toast({ title: 'Lider güncellendi' })
                            } catch (err: unknown) {
                              toast({ title: 'Hata', description: formatApiError(err), variant: 'destructive' })
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-64">
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Lider yok</SelectItem>
                            {members.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Üyeler</p>
                        <div className="flex flex-wrap gap-1">
                          {members.length === 0 && <span className="text-xs text-muted-foreground">Henüz üye yok</span>}
                          {members.map((u) => (
                            <Badge key={u.id} variant="secondary" className="gap-1 pr-0.5">
                              {u.username}
                              <button
                                type="button"
                                className="ml-1 rounded-sm hover:bg-muted p-0.5"
                                aria-label="Çıkar"
                                onClick={async () => {
                                  try {
                                    const nextMembers = team.memberIds
                                      .filter((id) => String(id) !== String(u.id))
                                      .map(Number)
                                    const patch: { members: number[]; leader?: null } = { members: nextMembers }
                                    if (team.leaderId != null && String(team.leaderId) === String(u.id))
                                      patch.leader = null
                                    await api.patch(`/teams/${team.id}/`, patch)
                                    await useAppStore.getState().hydrateFromApi()
                                    toast({ title: 'Üye çıkarıldı' })
                                  } catch (err: unknown) {
                                    toast({
                                      title: 'Hata',
                                      description: formatApiError(err),
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                        <Label className="text-xs whitespace-nowrap">Üye ekle</Label>
                        <Select
                          key={`add-${team.id}-${team.memberIds.join(',')}`}
                          value="none"
                          onValueChange={async (uid) => {
                            if (uid === 'none') return
                            try {
                              await api.patch(`/teams/${team.id}/`, {
                                members: [...new Set([...team.memberIds.map((id) => Number(id)), Number(uid)])].filter(
                                  (n) => Number.isFinite(n),
                                ),
                              })
                              await useAppStore.getState().hydrateFromApi()
                              toast({ title: 'Üye eklendi' })
                            } catch (err: unknown) {
                              toast({ title: 'Hata', description: formatApiError(err), variant: 'destructive' })
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-64">
                            <SelectValue placeholder="Kullanıcı seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {addCandidates.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.username} ({u.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </RbacGuard>
      </div>
      <RbacGuard perm="teams.edit">
        <Card>
          <CardHeader>
            <CardTitle>Hesapsız ekip çalışanları</CardTitle>
            <CardDescription>
              Sistem hesabı olmayan fakat ekiplerde çalışan kişileri kaydedin. Çalışan Takibi sayfasında &quot;Saha&quot;
              listesinde görünür; görev ataması için önce sistem kullanıcısı oluşturmanız gerekir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="text-xs">Ad soyad</Label>
                <Input value={assocName} onChange={(e) => setAssocName(e.target.value)} placeholder="Örn. Ali Yılmaz" />
              </div>
              <div>
                <Label className="text-xs">Telefon (isteğe bağlı)</Label>
                <Input value={assocPhone} onChange={(e) => setAssocPhone(e.target.value)} placeholder="05xx..." />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Not</Label>
                <Input value={assocNotes} onChange={(e) => setAssocNotes(e.target.value)} placeholder="Kısa not" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Ekipler</Label>
              <div className="flex flex-wrap gap-3">
                {data.teams.length === 0 && (
                  <span className="text-sm text-muted-foreground">Önce ekip oluşturun</span>
                )}
                {data.teams.map((t) => {
                  const tid = Number(t.id)
                  const checked = assocTeamIds.includes(tid)
                  return (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          if (c) setAssocTeamIds((prev) => [...new Set([...prev, tid])])
                          else setAssocTeamIds((prev) => prev.filter((x) => x !== tid))
                        }}
                      />
                      {t.name}
                    </label>
                  )
                })}
              </div>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                if (!assocName.trim()) {
                  toast({ title: 'Ad soyad gerekli', variant: 'destructive' })
                  return
                }
                try {
                  await api.post('/team-associates/', {
                    full_name: assocName.trim(),
                    phone: assocPhone.trim(),
                    notes: assocNotes.trim(),
                    teams: assocTeamIds,
                    is_active: true,
                  })
                  setAssocName('')
                  setAssocPhone('')
                  setAssocNotes('')
                  setAssocTeamIds([])
                  await loadTeamAssociates()
                  toast({ title: 'Kayıt eklendi' })
                } catch (err: unknown) {
                  toast({ title: 'Hata', description: formatApiError(err), variant: 'destructive' })
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ekle
            </Button>
            <div className="space-y-2 border-t pt-4">
              {teamAssociates.length === 0 && (
                <p className="text-sm text-muted-foreground">Henüz hesapsız çalışan yok.</p>
              )}
              {teamAssociates.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{a.full_name}</p>
                    {a.phone ? <p className="text-xs text-muted-foreground">{a.phone}</p> : null}
                    {a.notes ? <p className="text-xs text-muted-foreground mt-1">{a.notes}</p> : null}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(a.teams || []).length === 0 && (
                        <span className="text-xs text-amber-600">Ekip seçilmedi</span>
                      )}
                      {(a.teams || []).map((tid) => (
                        <Badge key={`${a.id}-${tid}`} variant="secondary">
                          {data.teams.find((t) => Number(t.id) === tid)?.name || tid}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex flex-wrap gap-2 max-w-md">
                      {data.teams.map((t) => {
                        const tid = Number(t.id)
                        const on = (a.teams || []).includes(tid)
                        return (
                          <label key={`${a.id}-e-${t.id}`} className="flex items-center gap-1 text-xs cursor-pointer">
                            <Checkbox
                              checked={on}
                              onCheckedChange={async (c) => {
                                const next = c
                                  ? [...new Set([...(a.teams || []), tid])]
                                  : (a.teams || []).filter((x) => x !== tid)
                                try {
                                  await api.patch(`/team-associates/${a.id}/`, { teams: next })
                                  await loadTeamAssociates()
                                  toast({ title: 'Ekipler güncellendi' })
                                } catch (err: unknown) {
                                  toast({
                                    title: 'Hata',
                                    description: formatApiError(err),
                                    variant: 'destructive',
                                  })
                                }
                              }}
                            />
                            {t.name}
                          </label>
                        )
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`${a.full_name} kaydını silinsin mi?`)) return
                        try {
                          await api.delete(`/team-associates/${a.id}/`)
                          await loadTeamAssociates()
                          toast({ title: 'Silindi' })
                        } catch (err: unknown) {
                          toast({ title: 'Hata', description: formatApiError(err), variant: 'destructive' })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </RbacGuard>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Takvim senkron</CardTitle>
            <CardDescription>iCal feed (Okuma)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-sm">
              <Label>ICS feed</Label>
              <Input readOnly value={icsUrl} />
              <p className="text-xs text-muted-foreground">Google/Outlook’a tek yön abone olun.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(icsUrl)
                toast({ title: 'Kopyalandı', description: 'ICS feed URL panoda' })
              }}
            >
              Kopyala
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

