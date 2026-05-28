export function resolveBrandingUrl(value?: string, kind?: 'logo' | 'favicon') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (typeof window === 'undefined') return raw
  try {
    const url = new URL(raw, window.location.origin)
    if (url.pathname.startsWith('/media/branding/') && kind) {
      return `/api/auth/branding-asset/${kind}/?v=${encodeURIComponent(raw)}`
    }
    if (url.host === window.location.host) return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return raw
  }
  return raw
}
