import type { Product } from '@/types'

export type PriceListOption = {
  key: string
  label: string
  is_default?: boolean
}

export const DEFAULT_PRICE_LISTS: PriceListOption[] = [
  { key: 'list_1', label: '2026/1. LİSTE', is_default: true },
  { key: 'list_2', label: '2026/2. LİSTE', is_default: false },
]

export const normalizePriceListKey = (value?: string, fallback = 'list_1') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

export const normalizePriceLists = (value?: any): PriceListOption[] => {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_PRICE_LISTS
  const seen = new Set<string>()
  const normalized = source
    .map((item: any, index: number) => {
      const label = String(typeof item === 'string' ? item : item?.label || item?.name || '').trim()
      if (!label) return null
      const baseKey = normalizePriceListKey(typeof item === 'string' ? label : item?.key || item?.id || label, `list_${index + 1}`)
      let key = baseKey
      let suffix = 2
      while (seen.has(key)) {
        key = `${baseKey}_${suffix}`
        suffix += 1
      }
      seen.add(key)
      return { key, label, is_default: Boolean(item?.is_default || item?.default) }
    })
    .filter(Boolean) as PriceListOption[]

  const result = normalized.length ? normalized : DEFAULT_PRICE_LISTS
  if (!result.some((item) => item.is_default)) result[0] = { ...result[0], is_default: true }
  let defaultSeen = false
  return result.map((item) => {
    if (item.is_default && !defaultSeen) {
      defaultSeen = true
      return item
    }
    return { ...item, is_default: false }
  })
}

export const getDefaultPriceList = (priceLists?: any) =>
  normalizePriceLists(priceLists).find((item) => item.is_default) || normalizePriceLists(priceLists)[0]

export const getPriceListByKey = (priceLists: any, key?: string) => {
  const lists = normalizePriceLists(priceLists)
  return lists.find((item) => item.key === key) || getDefaultPriceList(lists)
}

export const resolveProductPrice = (product?: Product, priceListKey?: string) => {
  if (!product) return 0
  const prices = product.priceLists || {}
  const selectedPrice = priceListKey ? prices[priceListKey] : undefined
  const basePrice = prices.list_1 ?? product.price ?? 0
  const resolved = Number(selectedPrice ?? basePrice)
  return Number.isFinite(resolved) ? resolved : Number(product.price || 0)
}
