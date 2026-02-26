import type { ReactNode } from 'react'
import { useAppStore } from '@/state/use-app-store'

type Props = { perm?: string; children: ReactNode; fallback?: ReactNode }

export function RbacGuard({ perm, children, fallback = null }: Props) {
  const role = useAppStore((s) => s.data.settings.role)
  const dynamicPerms = useAppStore((s) => s.data.rolePermissions || [])
  if (!perm) return <>{children}</>
  // Dynamic role-perm mapping from backend; fallback to static map
  const staticMap: Record<string, string[]> = {
    Admin: ['*'],
    Manager: ['*'],
    Sales: ['quotes.view', 'quotes.edit', 'products.view', 'partners.view', 'orders.view', 'tasks.view', 'tasks.edit', 'leads.view', 'leads.edit', 'opportunities.view', 'opportunities.edit'],
    Finance: ['quotes.view', 'quotes.approve', 'invoices.view', 'invoices.edit', 'invoices.pay', 'approvals.view', 'orders.view'],
    Support: ['tickets.view', 'tickets.edit', 'tasks.view', 'tasks.edit'],
    Warehouse: ['products.view', 'orders.view', 'orders.receive', 'inventory.view', 'inventory.edit'],
    Worker: ['tasks.view', 'tasks.edit'],
  }
  const allowed = dynamicPerms.length ? dynamicPerms : (staticMap[role] || [])
  if (allowed.includes('*') || allowed.includes(perm)) return <>{children}</>
  return <>{fallback}</>
}

type FormGuardProps = { 
  perm?: string
  children: ReactNode
}

export function RbacFormGuard({ perm, children }: FormGuardProps) {
  const role = useAppStore((s) => s.data.settings.role)
  const dynamicPerms = useAppStore((s) => s.data.rolePermissions || [])
  
  // Eğer perm belirtilmişse, önce yetki kontrolü yap
  if (perm) {
    const staticMap: Record<string, string[]> = {
      Admin: ['*'],
      Manager: ['*'],
      Sales: ['quotes.view', 'quotes.edit', 'products.view', 'partners.view', 'orders.view', 'tasks.view', 'tasks.edit', 'leads.view', 'leads.edit', 'opportunities.view', 'opportunities.edit'],
      Finance: ['quotes.view', 'quotes.approve', 'invoices.view', 'invoices.edit', 'invoices.pay', 'approvals.view', 'orders.view'],
      Support: ['tickets.view', 'tickets.edit', 'tasks.view', 'tasks.edit'],
      Warehouse: ['products.view', 'orders.view', 'orders.receive', 'inventory.view', 'inventory.edit'],
      Worker: ['tasks.view', 'tasks.edit'],
    }
    const allowed = dynamicPerms.length ? dynamicPerms : (staticMap[role] || [])
    const hasEditPerm = allowed.includes('*') || allowed.includes(perm)
    
    if (!hasEditPerm) {
      return (
        <div className="relative">
          <div className="pointer-events-none opacity-60">
            {children}
          </div>
          <div className="absolute inset-0 bg-background/30 cursor-not-allowed" />
          <p className="text-sm text-muted-foreground mt-2">
            Bu işlem için yetkiniz yok
          </p>
        </div>
      )
    }
  }
  
  return <>{children}</>
}


