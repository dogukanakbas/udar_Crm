import { useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toast'
import { AppRouter } from '@/router'
import { useAppStore } from '@/state/use-app-store'
import { getTokens } from '@/lib/auth'

function App() {
  const hydrate = useAppStore((s) => s.hydrateFromApi)
  const startSse = useAppStore((s) => s.startSse)

  useEffect(() => {
    // Login sayfasında veya token yoksa hydrate tetikleme
    const tokens = getTokens()
    if (!tokens) return
    hydrate()
    const stop = startSse ? startSse() : undefined
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
