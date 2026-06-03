import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2, Users } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'

type PermissionValue = 'unset' | 'allow' | 'deny'
type PermissionValues = Record<string, PermissionValue>
type PermissionCatalogModule = {
  key: string
  label: string
  description?: string
  permissions: [string, string][]
}
type UserGroup = {
  id: number
  group_id: string
  title: string
  description?: string
  is_system: boolean
  display_order: number
}
type UserLite = {
  id: number
  username?: string
  email?: string
  full_name?: string
  first_name?: string
  last_name?: string
  role?: string
}

const valueLabel: Record<PermissionValue, string> = {
  unset: 'Yok',
  allow: 'İzin',
  deny: 'Engel',
}

function userLabel(user: UserLite) {
  return user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || `#${user.id}`
}

function slugifyGroupId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ğ]/g, 'g')
    .replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function RolesPermissionPanel({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast()
  const [catalogModules, setCatalogModules] = useState<PermissionCatalogModule[]>([])
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [permissions, setPermissions] = useState<PermissionValues>({})
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState({ group_id: '', title: '', description: '' })
  const [busy, setBusy] = useState(false)

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)

  const loadBase = async () => {
    try {
      const [permissionResponse, groupResponse, userResponse] = await Promise.all([
        api.get('/auth/permissions/'),
        api.get('/auth/user-groups/'),
        api.get('/auth/users/'),
      ])
      const modules = permissionResponse.data?.catalog || []
      setCatalogModules(modules.length ? modules : [{ key: 'all', label: 'Tüm izinler', permissions: (permissionResponse.data?.permissions || []).map((code: string) => [code, code]) }])
      const loadedGroups = Array.isArray(groupResponse.data) ? groupResponse.data : groupResponse.data?.results || []
      setGroups(loadedGroups)
      setUsers(Array.isArray(userResponse.data) ? userResponse.data : userResponse.data?.results || [])
      setSelectedGroupId((current) => current || loadedGroups[0]?.id || null)
    } catch {
      toast({ title: 'Rol/izinler yüklenemedi', variant: 'destructive' })
    }
  }

  const loadGroupDetail = async (groupId: number) => {
    const [permissionResponse, memberResponse] = await Promise.all([
      api.get(`/auth/user-groups/${groupId}/permissions/`),
      api.get(`/auth/user-groups/${groupId}/members/`),
    ])
    setPermissions(permissionResponse.data?.permissions || {})
    setMemberIds((memberResponse.data?.members || []).map((item: any) => Number(item.user_id)))
  }

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    if (selectedGroupId) void loadGroupDetail(selectedGroupId)
  }, [selectedGroupId])

  const filteredCatalog = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return catalogModules
      .map((module) => ({
        ...module,
        permissions: module.permissions.filter(([code, label]) => {
          if (!q) return true
          return code.toLowerCase().includes(q) || label.toLowerCase().includes(q) || module.label.toLowerCase().includes(q)
        }),
      }))
      .filter((module) => module.permissions.length > 0)
  }, [catalogModules, filter])

  const setPermissionValue = (code: string, value: PermissionValue) => {
    setPermissions((current) => ({ ...current, [code]: value }))
  }

  const createGroup = async () => {
    const title = draft.title.trim()
    const groupId = draft.group_id.trim() || slugifyGroupId(title)
    if (!title || !groupId) {
      toast({ title: 'Grup adı gerekli', variant: 'destructive' })
      return
    }
    const response = await api.post('/auth/user-groups/', {
      group_id: groupId,
      title,
      description: draft.description,
      display_order: groups.length * 10 + 100,
    })
    setDraft({ group_id: '', title: '', description: '' })
    toast({ title: 'Kullanıcı grubu oluşturuldu' })
    await loadBase()
    setSelectedGroupId(response.data.id)
  }

  const saveGroup = async () => {
    if (!selectedGroup) return
    await api.patch(`/auth/user-groups/${selectedGroup.id}/`, {
      title: selectedGroup.title,
      description: selectedGroup.description || '',
      display_order: selectedGroup.display_order,
    })
    toast({ title: 'Grup bilgileri kaydedildi' })
    await loadBase()
  }

  const savePermissions = async () => {
    if (!selectedGroupId) return
    setBusy(true)
    try {
      await api.patch(`/auth/user-groups/${selectedGroupId}/permissions/`, { permissions })
      await useAppStore.getState().hydrateFromApi({ force: true })
      toast({ title: 'Grup izinleri kaydedildi' })
    } finally {
      setBusy(false)
    }
  }

  const saveMembers = async () => {
    if (!selectedGroupId) return
    setBusy(true)
    try {
      await api.patch(`/auth/user-groups/${selectedGroupId}/members/`, { user_ids: memberIds })
      await useAppStore.getState().hydrateFromApi({ force: true })
      toast({ title: 'Grup üyeleri kaydedildi' })
    } finally {
      setBusy(false)
    }
  }

  const deleteGroup = async () => {
    if (!selectedGroup || selectedGroup.is_system) return
    if (!window.confirm(`${selectedGroup.title} grubu silinsin mi?`)) return
    await api.delete(`/auth/user-groups/${selectedGroup.id}/`)
    toast({ title: 'Kullanıcı grubu silindi' })
    setSelectedGroupId(null)
    await loadBase()
  }

  return (
    <div className="space-y-4">
      {!embedded ? <PageHeader title="Rol / İzin Yönetimi" description="Dinamik kullanıcı grupları, üyelikler ve modüler izinleri yönetin." /> : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rol grupları</CardTitle>
              <CardDescription>Üretim, depo veya satış gibi özel gruplar oluşturun.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {groups.map((group) => (
                <Button
                  key={group.id}
                  variant={selectedGroupId === group.id ? 'default' : 'outline'}
                  className="w-full justify-between"
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <span className="truncate">{group.title}</span>
                  {group.is_system ? <Badge variant="secondary">Sistem</Badge> : null}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Yeni rol grubu</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Grup adı</Label>
                <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Çelik Kapı Üretim" />
              </div>
              <div className="space-y-1">
                <Label>Grup anahtarı</Label>
                <Input value={draft.group_id} onChange={(event) => setDraft((current) => ({ ...current, group_id: event.target.value }))} placeholder="celik_kapi_uretim" />
              </div>
              <div className="space-y-1">
                <Label>Açıklama</Label>
                <Input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Pres, kaynak, montaj çalışanları" />
              </div>
              <Button onClick={createGroup} className="w-full"><Plus className="mr-2 h-4 w-4" /> Rol grubu oluştur</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedGroup ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedGroup.title}</CardTitle>
                <CardDescription>
                  <span className="font-mono">{selectedGroup.group_id}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={selectedGroup.title}
                  onChange={(event) => setGroups((current) => current.map((group) => group.id === selectedGroup.id ? { ...group, title: event.target.value } : group))}
                />
                <Input
                  value={selectedGroup.description || ''}
                  onChange={(event) => setGroups((current) => current.map((group) => group.id === selectedGroup.id ? { ...group, description: event.target.value } : group))}
                  placeholder="Açıklama"
                />
                <div className="flex gap-2">
                  <Button onClick={saveGroup}><Save className="mr-2 h-4 w-4" /> Kaydet</Button>
                  {!selectedGroup.is_system && (
                    <Button variant="outline" className="text-destructive" onClick={deleteGroup}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Grup üyeleri</CardTitle>
              <CardDescription>Bu role dahil olacak kullanıcıları seçin. Çelik kapı üretiminde çalışacak kişileri buradan gruba bağlayın.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {users.map((user) => {
                  const checked = memberIds.includes(user.id)
                  return (
                    <label key={user.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setMemberIds((current) => value ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))
                        }}
                      />
                      <span>
                        <span className="block font-medium leading-none">{userLabel(user)}</span>
                        <span className="text-xs text-muted-foreground">{user.role || 'Rol yok'} · {user.username || user.email}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <Button onClick={saveMembers} disabled={!selectedGroupId || busy}><Users className="mr-2 h-4 w-4" /> Üyeleri kaydet</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grup izinleri</CardTitle>
              <CardDescription>İzin verilirse kullanıcı bu işlemi yapabilir. Engel, diğer grup izinlerinin üstüne geçer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input placeholder="İzin veya modül ara" value={filter} onChange={(event) => setFilter(event.target.value)} className="max-w-xs" />
                <Button onClick={savePermissions} disabled={!selectedGroupId || busy}><Save className="mr-2 h-4 w-4" /> İzinleri kaydet</Button>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {filteredCatalog.map((module) => (
                  <div key={module.key} className="rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{module.label}</p>
                        {module.description ? <p className="text-xs text-muted-foreground">{module.description}</p> : null}
                      </div>
                      <Badge variant="secondary">{module.permissions.filter(([code]) => permissions[code] === 'allow').length}/{module.permissions.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {module.permissions.map(([code, label]) => {
                        const value = permissions[code] || 'unset'
                        return (
                          <div key={code} className="rounded-md border p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium leading-none">{label}</p>
                                <p className="font-mono text-[11px] text-muted-foreground">{code}</p>
                              </div>
                              <div className="flex rounded-md border p-1">
                                {(['unset', 'allow', 'deny'] as PermissionValue[]).map((next) => (
                                  <Button
                                    key={next}
                                    type="button"
                                    size="sm"
                                    variant={value === next ? 'default' : 'ghost'}
                                    className={next === 'deny' && value === next ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                                    onClick={() => setPermissionValue(code, next)}
                                  >
                                    {valueLabel[next]}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function RolesPage() {
  return <RolesPermissionPanel />
}
