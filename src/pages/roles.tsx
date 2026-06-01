import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import api from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'

type RolePerms = Record<string, string[]>
type PermissionCatalogModule = {
  key: string
  label: string
  description?: string
  permissions: [string, string][]
}

export function RolesPermissionPanel({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast()
  const [permCatalog, setPermCatalog] = useState<string[]>([])
  const [catalogModules, setCatalogModules] = useState<PermissionCatalogModule[]>([])
  const [rolePerms, setRolePerms] = useState<RolePerms>({})
  const [selectedRole, setSelectedRole] = useState<string>('Admin')
  const [filter, setFilter] = useState('')

  const load = async () => {
    try {
      const [p, r] = await Promise.all([api.get('/auth/permissions/'), api.get('/auth/role-perms/')])
      setPermCatalog(p.data?.permissions || [])
      setCatalogModules(p.data?.catalog || [])
      setRolePerms(r.data || {})
    } catch {
      toast({ title: 'Rol/izinler yüklenemedi', variant: 'destructive' })
    }
  }

  useEffect(() => {
    load()
  }, [])

  const togglePerm = (code: string) => {
    setRolePerms((prev) => {
      const next = { ...prev }
      const list = new Set(next[selectedRole] || [])
      if (list.has(code)) list.delete(code)
      else list.add(code)
      next[selectedRole] = Array.from(list)
      return next
    })
  }

  const save = async () => {
    try {
      await api.post('/auth/role-perms/', { role: selectedRole, permissions: rolePerms[selectedRole] || [] })
      await useAppStore.getState().hydrateFromApi({ force: true })
      toast({ title: 'İzinler güncellendi' })
    } catch {
      toast({ title: 'Kaydedilemedi', variant: 'destructive' })
    }
  }

  const roles = ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse', 'Worker']
  const normalizedFilter = filter.trim().toLowerCase()
  const catalog =
    catalogModules.length > 0
      ? catalogModules
      : [{ key: 'all', label: 'Tüm izinler', permissions: permCatalog.map((code) => [code, code] as [string, string]) }]
  const filteredCatalog = catalog
    .map((module) => ({
      ...module,
      permissions: module.permissions.filter(([code, label]) => {
        if (!normalizedFilter) return true
        return code.toLowerCase().includes(normalizedFilter) || label.toLowerCase().includes(normalizedFilter) || module.label.toLowerCase().includes(normalizedFilter)
      }),
    }))
    .filter((module) => module.permissions.length > 0)

  return (
    <div className="space-y-4">
      {!embedded ? <PageHeader title="Rol / İzin Yönetimi" description="XenForo mantığında grup bazlı modüler izinleri düzenle" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Yetki grupları</CardTitle>
          <CardDescription>Bir kullanıcı grubu seçin; modüllere göre görüntüleme, oluşturma, düzenleme ve silme izinlerini belirleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <Button
                key={r}
                variant={selectedRole === r ? 'default' : 'outline'}
                onClick={() => setSelectedRole(r)}
                size="sm"
              >
                {r} <Badge variant="secondary" className="ml-2">{(rolePerms[r] || []).length}</Badge>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="İzin veya modül ara" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
            <Button onClick={save} size="sm">Kaydet</Button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {filteredCatalog.map((module) => (
              <div key={module.key} className="rounded-lg border border-border/70 bg-background/60 p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{module.label}</p>
                    {module.description ? <p className="text-xs text-muted-foreground">{module.description}</p> : null}
                  </div>
                  <Badge variant="secondary">{module.permissions.filter(([code]) => (rolePerms[selectedRole] || []).includes(code)).length}/{module.permissions.length}</Badge>
                </div>
                <div className="space-y-2">
                  {module.permissions.map(([code, label]) => {
                    const checked = (rolePerms[selectedRole] || []).includes(code)
                    return (
                      <label key={code} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                        <Checkbox checked={checked} onCheckedChange={() => togglePerm(code)} />
                        <span>
                          <span className="block font-medium leading-none">{label}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{code}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function RolesPage() {
  return <RolesPermissionPanel />
}
