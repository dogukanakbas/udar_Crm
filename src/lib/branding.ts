export function resolveBrandingUrl(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (typeof window === 'undefined') return raw
  try {
    const url = new URL(raw, window.location.origin)
    if (url.host === window.location.host) return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return raw
  }
  return raw
}
