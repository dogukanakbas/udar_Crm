export const QUOTE_WORKFLOW_STATUSES = [
  { value: 'Rejected', label: 'Ret' },
  { value: 'Pending', label: 'Beklemede' },
  { value: 'Approved', label: 'Onaylandı' },
] as const

export type QuoteWorkflowStatus = (typeof QUOTE_WORKFLOW_STATUSES)[number]['value']

export function normalizeQuoteWorkflowStatus(status?: string | null): QuoteWorkflowStatus {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'approved' || normalized === 'onaylandı' || normalized === 'onaylandi') return 'Approved'
  if (normalized === 'rejected' || normalized === 'ret' || normalized === 'reddedildi') return 'Rejected'
  return 'Pending'
}

export function quoteStatusLabelTr(status?: string | null) {
  return QUOTE_WORKFLOW_STATUSES.find((item) => item.value === normalizeQuoteWorkflowStatus(status))?.label || 'Beklemede'
}
