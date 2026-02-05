import api from './api'
import { getTokens } from './auth'

export type SseHandler = (event: { type: string; [k: string]: any }) => void

export function startSse(onEvent: SseHandler) {
  const tokens = getTokens()
  if (!tokens?.access) return () => {}
  const base = (api.defaults.baseURL || '').replace(/\/$/, '')
  const root = base.endsWith('/api') ? base.slice(0, -4) : base
  const url = `${root}/api/stream/?token=${tokens.access}`
  const es = new EventSource(url)

  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data)
      onEvent(data)
    } catch {
      /* ignore */
    }
  }

  es.onerror = () => {
    es.close()
    // basit retry
    setTimeout(() => startSse(onEvent), 3000)
  }

  return () => es.close()
}

