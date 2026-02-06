import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import api from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'

type RolePerms = Record<string, string[]>

export function RolesPage() {
  const { toast } = useToast()
  const [permCatalog, setPermCatalog] = useState<string[]>([])
  const [rolePerms, setRolePerms] = useState<RolePerms>({})
  const [selectedRole, setSelectedRole] = useState<string>('Admin')
  const [filter, setFilter] = useState('')

  const load = async () => {
    try {
      const [p, r] = await Promise.all([api.get('/auth/permissions/'), api.get('/auth/role-perms/')])
      setPermCatalog(p.data?.permissions || [])
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
      toast({ title: 'İzinler güncellendi' })
    } catch {
      toast({ title: 'Kaydedilemedi', variant: 'destructive' })
    }
  }

  const roles = ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse', 'Worker']
  const filtered = permCatalog.filter((c) => !filter || c.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-4">
      <PageHeader title="Rol / İzin Yönetimi" description="Alan bazlı izinleri düzenle" />
      <Card>
        <CardHeader>
          <CardTitle>Roller</CardTitle>
          <CardDescription>Bir rol seç ve izinleri düzenle</CardDescription>
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
            <Input placeholder="İzin filtrele" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
            <Button onClick={save} size="sm">Kaydet</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto border rounded p-2">
            {filtered.map((code) => {
              const checked = (rolePerms[selectedRole] || []).includes(code)
              return (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={checked} onCheckedChange={() => togglePerm(code)} />
                  <span className="font-mono text-xs">{code}</span>
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

