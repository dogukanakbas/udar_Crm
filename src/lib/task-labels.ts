import type { Task } from '@/types'

/** API değerleri aynı kalır; yalnızca arayüz metni Türkçe. */
export const TASK_STATUS_LABELS_TR: Record<Task['status'], string> = {
  todo: 'Yapılacak',
  'in-progress': 'Devam ediyor',
  done: 'Tamamlandı',
}

export const TASK_PRIORITY_LABELS_TR = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
} as const

export function taskStatusLabelTR(status: Task['status'] | string | undefined | null): string {
  if (status == null || status === '') return '—'
  if (Object.prototype.hasOwnProperty.call(TASK_STATUS_LABELS_TR, status)) {
    return TASK_STATUS_LABELS_TR[status as Task['status']]
  }
  return String(status)
}

export function taskPriorityLabelTR(priority: Task['priority'] | string | undefined | null): string {
  if (priority == null || priority === '') return '—'
  if (Object.prototype.hasOwnProperty.call(TASK_PRIORITY_LABELS_TR, priority)) {
    return TASK_PRIORITY_LABELS_TR[priority as keyof typeof TASK_PRIORITY_LABELS_TR]
  }
  return String(priority)
}

/** slaStatus() / tablo: 'overdue' | 'soon' */
export function taskSlaBucketLabelTR(bucket: 'overdue' | 'soon' | string | undefined | null): string {
  if (bucket === 'overdue') return 'Gecikti'
  if (bucket === 'soon') return '24 saat içinde'
  if (bucket == null || bucket === '') return '—'
  return String(bucket)
}
