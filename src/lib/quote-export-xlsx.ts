import * as XLSX from 'xlsx'
import type { Quote, QuoteLine } from '@/types'

export function downloadQuoteAsXlsx(quote: Quote, customerName: string) {
  const vatPct = (quote as Quote & { vatRate?: number }).vatRate ?? 20
  const subtotal = quote.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const disc = quote.lines.reduce((s, l) => s + (l.discount ?? 0) / 100 * l.qty * l.unitPrice, 0)
  const exVat = subtotal - disc
  const tax = quote.taxTotal
  const total = quote.total

  const wb = XLSX.utils.book_new()
  const header = [
    ['Teklif No', quote.number],
    ['Müşteri', customerName],
    ['Durum', quote.status],
    ['Geçerlilik', quote.validUntil ?? ''],
    ['Para birimi', quote.currency],
    ['KDV oranı (%)', vatPct],
    [],
  ]
  const tableHead = [['Kalem açıklaması', 'Miktar', 'Birim fiyat', 'İskonto %', 'Vergi %', 'Satır (vergi öncesi tutar)']]
  const tableBody = quote.lines.map((l: QuoteLine) => {
    const lineSub = l.qty * l.unitPrice
    const lineDisc = ((l.discount ?? 0) / 100) * lineSub
    return [l.name, l.qty, l.unitPrice, l.discount ?? 0, l.tax ?? 0, lineSub - lineDisc]
  })
  const footer = [
    [],
    ['Ara toplam (liste)', subtotal],
    ['İskonto toplamı', disc],
    ['KDV hariç net', exVat],
    ['KDV tutarı', tax],
    ['Genel toplam', total],
  ]
  const ws = XLSX.utils.aoa_to_sheet([...header, ...tableHead, ...tableBody, ...footer])
  XLSX.utils.book_append_sheet(wb, ws, 'Teklif')

  const notes = quote.terms.notes?.trim() || ''
  const wsNotes = XLSX.utils.aoa_to_sheet([['Şablon / taraflar / notlar'], [notes]])
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Notlar')

  const safeName = quote.number.replace(/[^\w.-]+/g, '_')
  XLSX.writeFile(wb, `teklif_${safeName}.xlsx`)
}
