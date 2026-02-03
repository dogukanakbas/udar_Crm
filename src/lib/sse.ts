import api from './api'

export type SseHandler = (event: { type: string; [k: string]: any }) => void

export function startSse(onEvent: SseHandler) {
  const base = (api.defaults.baseURL || '').replace(/\/$/, '')
  const root = base.endsWith('/api') ? base.slice(0, -4) : base
  const url = `${root}/api/stream/`
  const es = new EventSource(url, { withCredentials: true })

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

