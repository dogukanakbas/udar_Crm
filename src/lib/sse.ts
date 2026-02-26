import api from './api'
import { getTokens } from './auth'

export type SseHandler = (event: { type: string; [k: string]: any }) => void

export function startSse(onEvent: SseHandler) {
  const tokens = getTokens()
  if (!tokens?.access) return () => {}

  const base = (api.defaults.baseURL || '').replace(/\/$/, '')
  const root = base.endsWith('/api') ? base.slice(0, -4) : base
  const url = `${root}/api/stream/?token=${tokens.access}`

  let es: EventSource | null = null
  let reconnectTimer: any = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 10
  let isStopped = false

  const connect = () => {
    if (isStopped) return
    
    try {
      es = new EventSource(url)
      
      es.onopen = () => {
        console.log('SSE connected')
        reconnectAttempts = 0 // Reset on successful connection
      }
      
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          onEvent(data)
        } catch (err) {
          console.error('SSE parse error', err)
        }
      }
      
      es.onerror = (err) => {
        console.error('SSE error', err)
        es?.close()
        
        // Reconnect with exponential backoff
        if (!isStopped && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          console.log(`SSE reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`)
          
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++
            connect()
          }, delay)
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error('SSE max reconnect attempts reached')
        }
      }
    } catch (err) {
      console.error('SSE connection failed', err)
    }
  }

  connect()

  return () => {
    isStopped = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (es) {
      es.close()
      es = null
    }
  }
}
