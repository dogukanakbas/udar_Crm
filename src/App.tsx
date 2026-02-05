// @ts-nocheck
import { useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'
import { AppRouter } from '@/router'
import { useAppStore } from '@/state/use-app-store'
import { getTokens } from '@/lib/auth'

function App() {
  const hydrate = useAppStore((s) => s.hydrateFromApi)
  const startSse = useAppStore((s) => s.startSse)
  const { toast } = useToast()

  useEffect(() => {
    // Login sayfasında veya token yoksa hydrate tetikleme
    const tokens = getTokens()
    if (!tokens) return
    hydrate()
    const stop = startSse
      ? startSse((ev) => {
          const t = ev?.type || ''
          if (t === 'notification.mention') {
            toast({
              title: 'Mention',
              description: ev.task_title || ev.ticket_subject || 'Bir yorumda bahsedildiniz',
            })
          } else if (t === 'notification.sla_due_soon') {
            toast({
              title: 'SLA uyarısı',
              description: ev.task_title ? `${ev.task_title} vadesi yaklaşıyor` : 'Görev vadesi yaklaşıyor',
            })
          } else if (t === 'notification.automation') {
            toast({
              title: 'Otomasyon',
              description: ev.message || 'Otomasyon bildirimi',
            })
          }
        })
      : undefined
    return () => {
      if (stop) stop()
    }
  }, [hydrate, startSse])

  return (
    <ThemeProvider>
      <AppRouter />
      <Toaster />
    </ThemeProvider>
  )
}

export default App
