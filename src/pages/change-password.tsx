import { useState } from 'react'
import { KeyRound } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'

export function ChangePasswordPage() {
  const { toast } = useToast()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')

  return (
    <div>
      <PageHeader
        title="Şifre değiştir"
        description="Eski şifrenizi doğrulayarak yeni şifre belirleyin"
      />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Güvenlik
          </CardTitle>
          <CardDescription>Şifre en az bir kez doğrulanır; başarılı olunca oturumunuz açık kalır.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Eski şifre</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Yeni şifre</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Yeni şifre (tekrar)</Label>
            <Input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={async () => {
              if (!oldPassword || !newPassword || !newPassword2) {
                toast({ title: 'Hata', description: 'Tüm alanlar gerekli', variant: 'destructive' })
                return
              }
              if (newPassword !== newPassword2) {
                toast({ title: 'Hata', description: 'Yeni şifreler eşleşmiyor', variant: 'destructive' })
                return
              }
              try {
                await api.post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword })
                toast({ title: 'Şifre güncellendi' })
                setOldPassword('')
                setNewPassword('')
                setNewPassword2('')
              } catch (err: any) {
                toast({
                  title: 'Hata',
                  description: err?.response?.data?.detail || 'Güncellenemedi',
                  variant: 'destructive',
                })
              }
            }}
          >
            Şifreyi güncelle
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
