// @ts-nocheck
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'

export function ActivatePage() {
  const { toast } = useToast()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token') || ''
    setToken(t)
  }, [])

  const submit = async () => {
    if (!token) {
      toast({ title: 'Hata', description: 'Token eksik', variant: 'destructive' })
      return
    }
    if (!password || password !== password2) {
      toast({ title: 'Hata', description: 'Şifreler eşleşmiyor', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/activate/', { token, password })
      toast({ title: 'Hesap aktifleştirildi', description: 'Giriş yapabilirsiniz' })
      window.location.href = '/login'
    } catch (err: any) {
      toast({ title: 'Hata', description: err?.response?.data?.detail || 'Aktifleştirilemedi', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Hesap aktivasyonu</CardTitle>
          <CardDescription>Davet e-postasındaki şifreyi belirleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Yeni şifre" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input type="password" placeholder="Şifre (tekrar)" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Gönderiliyor...' : 'Aktifleştir'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

