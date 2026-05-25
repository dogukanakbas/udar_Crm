import type { Role } from '@/types'

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ['*'],
  Manager: ['*'],
  Sales: [
    'quotes.view',
    'quotes.edit',
    'quotes.prepare',
    'products.view',
    'partners.view',
    'partners.edit',
  ],
  Finance: ['quotes.view', 'quotes.approve', 'invoices.view', 'invoices.edit', 'invoices.pay', 'approvals.view', 'orders.view', 'audit.view'],
  Support: ['tickets.view', 'tickets.edit', 'tasks.view', 'tasks.edit', 'teams.view'],
  Warehouse: ['products.view', 'orders.view', 'orders.receive', 'inventory.view', 'inventory.edit', 'logistics.view', 'logistics.edit', 'tasks.view', 'tasks.edit', 'teams.view'],
  Worker: ['tasks.view', 'tasks.edit', 'tasks.handover', 'products.view', 'partners.view', 'tickets.view', 'vehicles.view', 'teams.view', 'quotes.view'],
}

export function permissionsForRole(role?: string | Role, dynamicPerms: string[] = []) {
  if (dynamicPerms.length) return dynamicPerms
  return ROLE_PERMISSIONS[String(role || '')] || []
}

export function hasPermission(role: string | Role | undefined, dynamicPerms: string[] = [], perm?: string) {
  if (!perm) return true
  const permissions = permissionsForRole(role, dynamicPerms)
  return permissions.includes('*') || permissions.includes(perm)
}

export function canSeeAllQuotes(role?: string | Role) {
  return ['Admin', 'Manager', 'Finance'].includes(String(role || ''))
}
