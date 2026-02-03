import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'
import { useTheme } from '@/components/theme-provider'
import { useEffect, useState } from 'react'
import type { AutomationRule } from '@/types'
import api from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import type { Team, UserLite } from '@/types'

export function SettingsPage() {
  const { data, resetDemo, setLocale } = useAppStore()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [notifMuted, setNotifMuted] = useState(false)
  const [notifSlack, setNotifSlack] = useState('')
  const [notifEmail, setNotifEmail] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('Worker')
  const [userTeamId, setUserTeamId] = useState<string | undefined>(undefined)
  const [generatedPass, setGeneratedPass] = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')
  const [automationName, setAutomationName] = useState('')
  const [automationTrigger, setAutomationTrigger] = useState<'task_status_changed' | 'task_due_soon'>('task_status_changed')
  const [automationAction, setAutomationAction] = useState<'add_comment' | 'set_assignee' | 'notify' | 'add_tag' | 'set_field'>('add_comment')
  const [automationCondition, setAutomationCondition] = useState<any>({})
  const [automationPayload, setAutomationPayload] = useState<any>({})
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyWebhook, setNotifyWebhook] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [rules, setRules] = useState<AutomationRule[]>([])
  const icsUrl = `${window.location.origin}/api/calendar/ics/`

  const userColumns: ColumnDef<UserLite>[] = [
    { accessorKey: 'username', header: 'Kullanıcı' },
    { accessorKey: 'email', header: 'E-posta' },
    { accessorKey: 'role', header: 'Rol' },
  ]

  const teamColumns: ColumnDef<Team>[] = [
    { accessorKey: 'name', header: 'Ekip' },
    {
      header: 'Üye',
      cell: ({ row }) => row.original.memberIds.length,
    },
  ]

  const loadRules = async () => {
    const res = await api.get('/automation-rules/')
    setRules(res.data || [])
  }

  useEffect(() => {
    loadRules()
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('notification-settings')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setNotifMuted(!!parsed.muted)
        setNotifSlack(parsed.slack || '')
        setNotifEmail(parsed.email || '')
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
      })
      .catch(() => null)
  }, [])

  const saveNotifSettings = () => {
    const payload = { muted: notifMuted, slack: notifSlack, email: notifEmail }
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
            <CardDescription>Demo workspace bilgisini güncelle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Ad</Label>
              <Input defaultValue="Omni Demo" />
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
            <Button onClick={() => toast({ title: 'Profil kaydedildi (mock)' })}>Kaydet</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcılar & roller</CardTitle>
            <CardDescription>Yeni kullanıcı oluştur ve ekibe ata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Yeni kullanıcı e-posta</Label>
              <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="ornek@firma.com" />
              <Label>Rol</Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Worker', 'Support', 'Sales', 'Finance', 'Manager', 'Warehouse', 'Admin'].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Ekip</Label>
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
                    const resp = await api.post('/auth/create-user/', { email: userEmail, role: userRole })
                    const newUser = resp.data
                    if (userTeamId) {
                      const team = data.teams.find((t) => t.id === userTeamId)
                      const memberIds = team ? team.memberIds : []
                      await api.patch(`/teams/${userTeamId}/`, { members: [...memberIds, newUser.id] })
                    }
                    await useAppStore.getState().hydrateFromApi()
                    setGeneratedPass(resp.data.password)
                    toast({ title: 'Kullanıcı oluşturuldu', description: `Şifre: ${resp.data.password}` })
                  } catch (err: any) {
                    toast({ title: 'Hata', description: err?.response?.data?.detail || 'Oluşturulamadı', variant: 'destructive' })
                  }
                }}
              >
                Kullanıcı oluştur
              </Button>
              {generatedPass && <p className="text-xs text-muted-foreground">Üretilen şifre: {generatedPass}</p>}
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
            <div className="space-y-2">
              <Label>Slack webhook</Label>
              <Input value={notifSlack} onChange={(e) => setNotifSlack(e.target.value)} placeholder="https://hooks.slack.com/..." />
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
            <CardTitle>Tema & Demo</CardTitle>
            <CardDescription>Açık/koyu, veri reset, demo filigranı</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              Tema: {theme === 'dark' ? 'açık' : 'koyu'}
            </Button>
            <Button variant="destructive" onClick={() => { resetDemo(); toast({ title: 'Demo data reset' }) }}>
              Demo verisini sıfırla
            </Button>
            <div className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
              API anahtarları ve entegrasyonlar sadece görsel amaçlıdır. Kendi placeholderlarınızı ekleyin.
            </div>
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
                  <Input value={notifyWebhook} onChange={(e) => setNotifyWebhook(e.target.value)} placeholder="Slack webhook URL" />
                </div>
                <div>
                  <Label>E-posta</Label>
                  <Input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} placeholder="ops@firma.com" />
                </div>
              </div>
            )}
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
        <Card>
          <CardHeader>
            <CardTitle>Ekipler</CardTitle>
            <CardDescription>Oluştur ve üyeleri görüntüle</CardDescription>
          </CardHeader>
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
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ekip adı" />
              <Button
                onClick={async () => {
                  try {
                    await api.post('/teams/', { name: teamName })
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
            <DataTable columns={teamColumns} data={data.teams} searchKey="name" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}

