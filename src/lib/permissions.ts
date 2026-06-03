import type { Role } from '@/types'

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ['*'],
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
