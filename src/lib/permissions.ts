import type { Role } from '@/types'

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ['*'],
  Manager: [
    'quotes.view.all', 'quotes.create', 'quotes.edit.all', 'quotes.status.change', 'quotes.convert', 'quotes.download', 'quotes.prepare',
    'partners.view', 'partners.create', 'partners.edit', 'partners.export',
    'templates.view', 'templates.products.edit', 'templates.seller_companies.edit', 'templates.document_terms.edit', 'templates.pricing.edit', 'templates.payment_options.edit', 'templates.service_tax.edit', 'templates.excel.upload',
    'products.view', 'products.create', 'products.edit', 'products.import', 'products.export',
    'erp.view', 'orders.view', 'orders.create', 'orders.edit', 'orders.receive', 'inventory.view', 'inventory.edit', 'logistics.view', 'logistics.edit', 'vehicles.view', 'vehicles.edit',
    'tickets.view', 'tickets.edit', 'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.assign', 'teams.view', 'teams.edit', 'worker_tracking.view', 'reports.view', 'audit.view',
    'settings.view', 'settings.organization.edit',
  ],
  Sales: [
    'quotes.view.own',
    'quotes.create',
    'quotes.edit.own',
    'quotes.status.change',
    'quotes.convert',
    'quotes.download',
    'quotes.prepare',
    'products.view',
    'partners.view',
    'partners.create',
    'partners.edit',
    'templates.view',
  ],
  Finance: ['quotes.view.all', 'quotes.download', 'quotes.approve', 'partners.view', 'erp.view', 'invoices.view', 'invoices.edit', 'invoices.pay', 'approvals.view', 'orders.view', 'audit.view', 'reports.view'],
  Support: ['tickets.view', 'tickets.edit', 'tasks.view', 'tasks.edit', 'teams.view'],
  Warehouse: ['erp.view', 'products.view', 'orders.view', 'orders.receive', 'inventory.view', 'inventory.edit', 'logistics.view', 'logistics.edit', 'tasks.view', 'tasks.edit', 'teams.view'],
  Worker: ['tasks.view.own', 'tasks.edit', 'tasks.handover', 'products.view', 'partners.view', 'tickets.view', 'vehicles.view', 'teams.view', 'quotes.view.own'],
}

const IMPLIED_PERMISSIONS: Record<string, string[]> = {
  'quotes.view.own': ['quotes.view.all'],
  'quotes.edit.own': ['quotes.edit.all'],
  'tasks.view.own': ['tasks.view'],
  'quotes.view': ['quotes.view.own', 'quotes.view.all'],
  'quotes.edit': ['quotes.create', 'quotes.edit.own', 'quotes.edit.all', 'quotes.status.change', 'quotes.convert', 'quotes.download'],
  'pricing.manage': ['templates.view', 'templates.products.edit', 'templates.seller_companies.edit', 'templates.document_terms.edit', 'templates.pricing.edit', 'templates.payment_options.edit', 'templates.service_tax.edit', 'templates.excel.upload'],
  'partners.edit': ['partners.create', 'partners.edit'],
  'products.edit': ['products.create', 'products.edit', 'products.delete', 'products.import', 'products.export'],
  'orders.edit': ['orders.create', 'orders.edit', 'orders.delete'],
  'tasks.edit': ['tasks.create', 'tasks.edit', 'tasks.assign'],
}

export function permissionsForRole(role?: string | Role, dynamicPerms: string[] = []) {
  if (dynamicPerms.length) return dynamicPerms
  return ROLE_PERMISSIONS[String(role || '')] || []
}

export function hasPermission(role: string | Role | undefined, dynamicPerms: string[] = [], perm?: string) {
  if (!perm) return true
  const permissions = permissionsForRole(role, dynamicPerms)
  const acceptable = [perm, ...(IMPLIED_PERMISSIONS[perm] || [])]
  return permissions.includes('*') || acceptable.some((code) => permissions.includes(code))
}

export function canSeeAllQuotes(role?: string | Role, dynamicPerms: string[] = []) {
  return hasPermission(role, dynamicPerms, 'quotes.view.all')
}
