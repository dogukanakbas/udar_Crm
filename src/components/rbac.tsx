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

