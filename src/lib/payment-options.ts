export const DEFAULT_PAYMENT_OPTIONS = [
  '%100 Nakit',
  '%50 peşin / %50 teslimde',
  '%30 peşin / %70 sevkiyat öncesi',
  '%20 nakit / %80 çek 90 gün',
  'Kredi kartı tek çekim',
  'Kredi kartı 3 taksit',
  'Kredi kartı 6 taksit',
  'Barter',
]

export const normalizePaymentOptions = (value?: any): string[] => {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_PAYMENT_OPTIONS
  const seen = new Set<string>()
  const normalized = source
    .map((item: any) => String(typeof item === 'string' ? item : item?.label || '').trim())
    .filter((label: string) => {
      if (!label) return false
      const key = label.toLocaleLowerCase('tr-TR')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return normalized.length ? normalized : DEFAULT_PAYMENT_OPTIONS
}
