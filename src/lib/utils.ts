import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value: number, currency = 'USD', locale = 'tr-TR') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)

export const formatDate = (value: string | number | Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))

export const formatDateTime = (value: string | number | Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

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
  return d.toISOString().slice(0, 16)
}

