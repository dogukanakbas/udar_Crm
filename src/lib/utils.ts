import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const normalizeSearchText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const normalizeCurrency = (currency?: string) => (['TRY', 'USD', 'EUR'].includes(String(currency || '').toUpperCase()) ? String(currency).toUpperCase() : 'TRY')

export const getCurrencySymbol = (currency?: string) =>
  ({
    TRY: '₺',
    USD: '$',
    EUR: '€',
  }[normalizeCurrency(currency)])

export const getCurrencyLabel = (currency?: string) =>
  ({
    TRY: 'Türk Lirası',
    USD: 'Dolar',
    EUR: 'Euro',
  }[normalizeCurrency(currency)])

export const formatCurrency = (value: number, currency = 'TRY', locale = 'tr-TR') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(value)

export const formatExchangeRate = (rate: number | string, currency?: string) => {
  const normalizedRate = Number(rate)
  const normalizedCurrency = normalizeCurrency(currency)
  if (normalizedCurrency === 'TRY') return '1 ₺ = 1 ₺'
  if (!Number.isFinite(normalizedRate)) return '-'
  return `1 ${getCurrencySymbol(normalizedCurrency)} = ${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(normalizedRate)} ₺`
}

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)

export const formatDate = (value: string | number | Date) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export const formatDateTime = (value: string | number | Date) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** datetime-local input için yerel tarih-saat (UTC ISO kullanmayın). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toDatetimeLocalFromISO(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return toDatetimeLocalValue(d)
}

/** Günlük mesai süresi (dakika). Örn. 08:00–18:00 → 600. */
export function getWorkingMinutesPerDay(workStart: string, workEnd: string): number {
  const [startH, startM] = workStart.split(':').map(Number)
  const [endH, endM] = workEnd.split(':').map(Number)
  const start = startH * 60 + startM
  const end = endH * 60 + endM
  return Math.max(0, end - start)
}

/** Mesai günleri ve saatleri dikkate alarak başlangıç + planlanan dakika = bitiş hesaplar. */
export function addWorkingMinutes(
  startISO: string,
  totalMinutes: number,
  workStart: string,
  workEnd: string,
  workDays: number[]
): string {
  const [startH, startM] = workStart.split(':').map(Number)
  const [endH, endM] = workEnd.split(':').map(Number)
  const workStartMins = startH * 60 + startM
  const workEndMins = endH * 60 + endM
  // Backend: 0=Pzt, 1=Sal, ..., 6=Paz. JS getDay(): 0=Paz, 1=Pzt, ..., 6=Cmt
  const isWorkDay = (jsDay: number) => workDays.includes(jsDay === 0 ? 6 : jsDay - 1)
  const nextWorkDay = (d: Date) => {
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    next.setHours(startH, startM, 0, 0)
    while (!isWorkDay(next.getDay())) next.setDate(next.getDate() + 1)
    return next
  }

  let d = new Date(startISO)
  let remaining = totalMinutes

  const dDay = d.getDay()
  const dMins = d.getHours() * 60 + d.getMinutes()

  if (!isWorkDay(dDay)) {
    d = nextWorkDay(d)
  } else if (dMins < workStartMins) {
    d.setHours(startH, startM, 0, 0)
  } else if (dMins >= workEndMins) {
    d = nextWorkDay(d)
  }

  while (remaining > 0) {
    const day = d.getDay()
    if (!isWorkDay(day)) {
      d = nextWorkDay(d)
      continue
    }
    const currentMins = d.getHours() * 60 + d.getMinutes()
    const minsUntilEnd = workEndMins - currentMins
    const toAdd = Math.min(remaining, minsUntilEnd)
    remaining -= toAdd
    d = new Date(d.getTime() + toAdd * 60 * 1000)
    if (remaining > 0) d = nextWorkDay(d)
  }
  return toDatetimeLocalValue(d)
}

