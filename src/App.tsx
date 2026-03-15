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
          const currentUserId = localStorage.getItem('current-user-id')
          const userRole = localStorage.getItem('current-user-role') || ''
          const assigneeId = ev?.assignee_id ? String(ev.assignee_id) : null
          const isForMe = assigneeId && currentUserId && assigneeId === currentUserId
          const isAdminOrManager = ['Admin', 'Manager'].includes(userRole)

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
          } else if (t === 'task.created' && (isForMe || isAdminOrManager)) {
            toast({
              title: isForMe ? 'Yeni görev atandı' : 'Yeni görev oluşturuldu',
              description: ev.title || (isForMe ? 'Size yeni bir görev atandı' : 'Yeni görev oluşturuldu'),
            })
          } else if (t === 'task.updated' && (isForMe || isAdminOrManager) && ev.changes?.assignee) {
            toast({
              title: isForMe ? 'Görev atandı' : 'Görev güncellendi',
              description: ev.title ? `${ev.title} ${isForMe ? 'size atandı' : 'güncellendi'}` : 'Görev güncellendi',
            })
          } else if (t === 'task.handover' && (isForMe || isAdminOrManager)) {
            toast({
              title: isForMe ? 'Görev devredildi' : 'Görev devri',
              description: ev.title ? `${ev.title} ${isForMe ? 'size devredildi' : 'devredildi'}` : 'Görev devredildi',
            })
          } else if (t === 'task.status' && ev.status === 'done' && (isForMe || isAdminOrManager)) {
            toast({
              title: 'Görev tamamlandı',
              description: ev.title ? `${ev.title} tamamlandı` : 'Bir görev tamamlandı',
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
