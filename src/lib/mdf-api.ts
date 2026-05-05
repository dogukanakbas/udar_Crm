import { api } from '@/lib/api'

export type ApiMdfSku = {
  id: number
  thickness_mm: number
  width_cm: number
  height_cm: number
  min_threshold: number
  quantity: number
}

export type StockRow = {
  id: string
  thicknessMm: number
  widthCm: number
  heightCm: number
  totalQty: number
  minThreshold: number
}

export function mapSku(s: ApiMdfSku): StockRow {
  return {
    id: String(s.id),
    thicknessMm: s.thickness_mm,
    widthCm: s.width_cm,
    heightCm: s.height_cm,
    totalQty: s.quantity,
    minThreshold: s.min_threshold,
  }
}

export async function fetchMdfSkus(): Promise<StockRow[]> {
  const res = await api.get<ApiMdfSku[]>('/mdf-skus/')
  return (res.data || []).map(mapSku)
}

export type ConsumptionSeriesItem = { key: string; label: string; value: number; pct: number; fill: string }

const CHART_FILLS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#14b8a6', '#6366f1', '#ec4899']

export type ConsumptionResponse = {
  year: number
  month: number
  month_label: string
  total: number
  series: { thickness_mm: number; value: number; pct: number; label: string }[]
}

export async function fetchMdfConsumption(year?: number, month?: number): Promise<{
  chartData: ConsumptionSeriesItem[]
  monthLabel: string
  total: number
}> {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1
  const res = await api.get<ConsumptionResponse>('/mdf-skus/consumption/', { params: { year: y, month: m } })
  const d = res.data
  const chartData: ConsumptionSeriesItem[] = (d.series || []).map((row, i) => ({
    key: `t-${row.thickness_mm}`,
    label: row.label,
    value: row.value,
    pct: row.pct,
    fill: CHART_FILLS[i % CHART_FILLS.length],
  }))
  return { chartData, monthLabel: d.month_label, total: d.total }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadMdfStockPdf() {
  const res = await api.get('/mdf-skus/export-stock-pdf/', { responseType: 'blob' })
  triggerBlobDownload(res.data as Blob, 'mdf-stok.pdf')
}

export async function downloadMdfExitsPdf(dateFrom?: string, dateTo?: string) {
  const res = await api.get('/mdf-skus/export-exits-pdf/', {
    responseType: 'blob',
    params: {
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    },
  })
  triggerBlobDownload(res.data as Blob, 'mdf-cikis.pdf')
}

export type ApiMovement = {
  id: number
  kind: 'in' | 'out'
  quantity: number
  movement_date: string
  note: string
  thickness_mm: number
  width_cm: number
  height_cm: number
}

export type HistoryResponse = { entries: ApiMovement[]; exits: ApiMovement[] }

export async function fetchMdfHistory(dateFrom?: string, dateTo?: string): Promise<HistoryResponse> {
  const res = await api.get<HistoryResponse>('/mdf-skus/history/', {
    params: {
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    },
  })
  return res.data
}

export function formatApiError(err: unknown): string {
  const ax = err as { response?: { data?: Record<string, unknown> | string } }
  const data = ax.response?.data
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const detail = data.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map(String).join(', ')
    const parts: string[] = []
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`)
      else if (v != null) parts.push(`${k}: ${String(v)}`)
    }
    if (parts.length) return parts.join(' · ')
  }
  return 'İstek başarısız oldu.'
}
