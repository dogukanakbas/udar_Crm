import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'

import api from '@/lib/api'
import { RbacGuard } from '@/components/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useAppStore } from '@/state/use-app-store'

type DocumentTemplateLibraryItem = {
  template_key: string
  document_type: 'Quote' | 'Contract'
  label: string
  default_filename: string
  current_filename: string
  has_custom: boolean
  source_type: 'default' | 'custom'
  uploaded_at?: string | null
}

async function downloadTemplateFile(
  templateKey: string,
  variant: 'current' | 'default',
  expectedFilename: string
) {
  const response = await api.get('/quotes/template-library-download/', {
    params: { template_key: templateKey, variant },
    responseType: 'blob',
  })
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const disposition = response.headers['content-disposition'] || ''
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/)
  link.href = url
  link.download = fileNameMatch?.[1] || expectedFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export function DocumentTemplateLibrary() {
  const { data } = useAppStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [templates, setTemplates] = useState<DocumentTemplateLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [pendingTemplateKey, setPendingTemplateKey] = useState<string | null>(null)
  const [priceListLabel, setPriceListLabel] = useState('2026/1. LİSTE')
  const [savingSettings, setSavingSettings] = useState(false)

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await api.get('/quotes/template-library/')
      setTemplates(response.data?.templates || [])
    } catch {
      toast({
        title: 'Şablonlar alınamadı',
        description: 'Şablon kütüphanesi yüklenemedi, lütfen tekrar deneyin.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    api
      .get('/auth/organization-settings/')
      .then((response) => setPriceListLabel(response.data?.price_list_label || '2026/1. LİSTE'))
      .catch(() => setPriceListLabel('2026/1. LİSTE'))
  }, [])

  const groupedTemplates = useMemo(
    () => ({
      Quote: templates.filter((item) => item.document_type === 'Quote'),
      Contract: templates.filter((item) => item.document_type === 'Contract'),
    }),
    [templates]
  )

  const openUploadPicker = (templateKey: string) => {
    setPendingTemplateKey(templateKey)
    fileInputRef.current?.click()
  }

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !pendingTemplateKey) return

    const formData = new FormData()
    formData.append('template_key', pendingTemplateKey)
    formData.append('file', file)

    setUploadingKey(pendingTemplateKey)
    try {
      await api.post('/quotes/template-library-upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast({
        title: 'Şablon yüklendi',
        description: 'Yeni dosya artık belge dışa aktarımlarında kullanılacak.',
      })
      await fetchTemplates()
    } catch (error: any) {
      toast({
        title: 'Şablon yüklenemedi',
        description: error?.response?.data?.detail || 'Dosya sisteme alınamadı.',
        variant: 'destructive',
      })
    } finally {
      setUploadingKey(null)
      setPendingTemplateKey(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şablon Kütüphanesi</CardTitle>
        <CardDescription>
          Teklif ve sözleşme şablonlarını indirip Excel içinde düzenleyebilir, logonuzu yerleştirip tekrar sisteme yükleyebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Belge sabitleri</CardTitle>
            <CardDescription>
              Fiyat listesi etiketi gibi kilitli şablon sabitlerini yalnızca Admin değiştirebilir. Belge oluşturma ekranında bu alan salt okunur görünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Fiyat listesi etiketi</Label>
              <Input
                value={priceListLabel}
                onChange={(event) => setPriceListLabel(event.target.value)}
                disabled={data.settings.role !== 'Admin' || savingSettings}
              />
              <p className="text-xs text-muted-foreground">Örn. `2026/2. LİSTE`. Burada ne yazıyorsa teklifler ve sözleşmeler o etiketi kullanır.</p>
            </div>
            <RbacGuard perm="quotes.edit">
              <Button
                onClick={async () => {
                  setSavingSettings(true)
                  try {
                    const response = await api.patch('/auth/organization-settings/', {
                      price_list_label: priceListLabel,
                    })
                    setPriceListLabel(response.data?.price_list_label || priceListLabel)
                    toast({
                      title: 'Belge sabitleri güncellendi',
                      description: 'Fiyat listesi etiketi artık yeni belge kayıtlarında otomatik kullanılacak.',
                    })
                  } catch (error: any) {
                    toast({
                      title: 'Ayar kaydedilemedi',
                      description: error?.response?.data?.detail || 'Fiyat listesi etiketi güncellenemedi.',
                      variant: 'destructive',
                    })
                  } finally {
                    setSavingSettings(false)
                  }
                }}
                disabled={data.settings.role !== 'Admin' || savingSettings}
              >
                {savingSettings ? 'Kaydediliyor...' : 'Belge sabitlerini kaydet'}
              </Button>
            </RbacGuard>
          </CardContent>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xltx,.xlsm"
          className="hidden"
          onChange={handleUploadChange}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Şablonlar yükleniyor...</p>
        ) : (
          <>
            {([
              { key: 'Quote', title: 'Teklif şablonları' },
              { key: 'Contract', title: 'Sözleşme şablonları' },
            ] as const).map((group) => (
              <section key={group.key} className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Bu gruptaki dosyalar belge dışa aktarımında doğrudan kaynak şablon olarak kullanılır.
                  </p>
                </div>

                <div className="space-y-3">
                  {groupedTemplates[group.key].map((template) => (
                    <div key={template.template_key} className="rounded-xl border border-border/70 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{template.label}</p>
                            <Badge variant={template.has_custom ? 'default' : 'secondary'}>
                              {template.has_custom ? 'Özel şablon yüklü' : 'Varsayılan şablon'}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>Varsayılan dosya: {template.default_filename}</p>
                            <p>Kullanılan dosya: {template.current_filename}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadTemplateFile(template.template_key, 'default', template.default_filename)
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Varsayılanı indir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadTemplateFile(template.template_key, 'current', template.current_filename)
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Kullanılanı indir
                          </Button>
                          <RbacGuard perm="quotes.edit">
                            <Button
                              size="sm"
                              onClick={() => openUploadPicker(template.template_key)}
                              disabled={uploadingKey === template.template_key}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingKey === template.template_key ? 'Yükleniyor...' : 'Şablon yükle'}
                            </Button>
                          </RbacGuard>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
