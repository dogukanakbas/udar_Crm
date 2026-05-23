import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { RbacGuard } from '@/components/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import api, { apiOrigin } from '@/lib/api'
import { useAppStore } from '@/state/use-app-store'
import type { SellerBankAccount, SellerCompanyProfile } from '@/types'

type SellerCompanyFormState = {
  key: string
  short_name: string
  display_name: string
  legal_name: string
  tax_office: string
  tax_number: string
  mersis_number: string
  trade_registry_number: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  website: string
  kep_address: string
  logo_url: string
  signature_name: string
  signature_title: string
  signature_label: string
  bank_iban_label: string
  bank_iban_2_label: string
  notes: string
  is_active: boolean
  sort_order: number
  bank_accounts: Array<{
    bank: string
    iban: string
    currency: string
    iban_2: string
    currency_2: string
    branch: string
    account_holder: string
  }>
}

const createBlankBankAccount = () => ({
  bank: '',
  iban: '',
  currency: 'TRY',
  iban_2: '',
  currency_2: 'USD',
  branch: '',
  account_holder: '',
})

const BANK_ACCOUNT_CURRENCIES = [
  { value: 'TRY', label: '₺ TL hesabı' },
  { value: 'USD', label: '$ Dolar hesabı' },
]

const bankAccountCurrencySummary = (accounts: SellerBankAccount[] = []) => {
  const visibleAccounts = accounts.filter((account) => account.bank || account.iban || account.iban2)
  const slots = visibleAccounts.flatMap((account) => [
    { iban: account.iban, currency: account.currency || 'TRY' },
    { iban: account.iban2, currency: account.currency2 || 'USD' },
  ]).filter((slot) => slot.iban)
  const tryCount = slots.filter((slot) => slot.currency.toUpperCase() === 'TRY').length
  const usdCount = slots.filter((slot) => slot.currency.toUpperCase() === 'USD').length
  return `${tryCount} TL / ${usdCount} USD`
}

const createBlankSellerCompany = (): SellerCompanyFormState => ({
  key: '',
  short_name: '',
  display_name: '',
  legal_name: '',
  tax_office: '',
  tax_number: '',
  mersis_number: '',
  trade_registry_number: '',
  address: '',
  city: '',
  country: 'Türkiye',
  phone: '',
  email: '',
  website: '',
  kep_address: '',
  logo_url: '',
  signature_name: '',
  signature_title: '',
  signature_label: '',
  bank_iban_label: 'Türk Lirası Hesapları',
  bank_iban_2_label: 'Dolar Hesapları',
  notes: '',
  is_active: true,
  sort_order: 0,
  bank_accounts: [createBlankBankAccount()],
})

const mapSellerCompanyToForm = (company: SellerCompanyProfile): SellerCompanyFormState => ({
  key: company.key,
  short_name: company.shortName || '',
  display_name: company.displayName || '',
  legal_name: company.legalName || '',
  tax_office: company.taxOffice || '',
  tax_number: company.taxNumber || '',
  mersis_number: company.mersisNumber || '',
  trade_registry_number: company.tradeRegistryNumber || '',
  address: company.address || '',
  city: company.city || '',
  country: company.country || 'Türkiye',
  phone: company.phone || '',
  email: company.email || '',
  website: company.website || '',
  kep_address: company.kepAddress || '',
  logo_url: company.logoUrl || '',
  signature_name: company.signatureName || '',
  signature_title: company.signatureTitle || '',
  signature_label: company.signatureLabel || '',
  bank_iban_label: company.bankIbanLabel || '1. IBAN',
  bank_iban_2_label: company.bankIban2Label || '2. IBAN',
  notes: company.notes || '',
  is_active: company.isActive !== false,
  sort_order: Number(company.sortOrder ?? 0),
  bank_accounts: company.bankAccounts?.length
    ? company.bankAccounts.map((account: SellerBankAccount) => ({
        bank: account.bank || '',
        iban: account.iban || '',
        currency: account.currency || 'TRY',
        iban_2: account.iban2 || '',
        currency_2: account.currency2 || 'USD',
        branch: account.branch || '',
        account_holder: account.accountHolder || '',
      }))
    : [createBlankBankAccount()],
})

const resolveSellerLogoUrl = (value?: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return `${apiOrigin}${raw}`
  return `${apiOrigin}/${raw.replace(/^\/+/, '')}`
}

export function SellerCompaniesPage() {
  const { data, hydrateFromApi } = useAppStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [form, setForm] = useState<SellerCompanyFormState>(createBlankSellerCompany())

  const sellerCompanies = useMemo(
    () => [...(data.sellerCompanies || [])].sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0)),
    [data.sellerCompanies]
  )

  const updateField = <K extends keyof SellerCompanyFormState>(key: K, value: SellerCompanyFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const updateBankAccount = (index: number, patch: Partial<SellerCompanyFormState['bank_accounts'][number]>) =>
    setForm((current) => ({
      ...current,
      bank_accounts: current.bank_accounts.map((account, accountIndex) =>
        accountIndex === index ? { ...account, ...patch } : account
      ),
    }))

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(removeLogo ? '' : resolveSellerLogoUrl(form.logo_url))
      return
    }
    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [form.logo_url, logoFile, removeLogo])

  const resetLogoState = (nextLogoUrl = '') => {
    setLogoFile(null)
    setRemoveLogo(false)
    setLogoPreviewUrl(resolveSellerLogoUrl(nextLogoUrl))
  }

  const openCreateDialog = () => {
    setEditingKey(null)
    setForm({
      ...createBlankSellerCompany(),
      sort_order: sellerCompanies.length,
    })
    resetLogoState('')
    setOpen(true)
  }

  const openEditDialog = (company: SellerCompanyProfile) => {
    setEditingKey(company.key)
    setForm(mapSellerCompanyToForm(company))
    resetLogoState(company.logoUrl || '')
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.short_name.trim() || !form.display_name.trim()) {
      toast({
        title: 'Eksik bilgi',
        description: 'Kısa ad ve firma unvanı zorunludur.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        logo_url: removeLogo && !logoFile ? '' : form.logo_url,
      }
      const response = editingKey
        ? await api.patch(`/seller-companies/${editingKey}/`, payload)
        : await api.post('/seller-companies/', payload)

      const targetKey = String(response.data?.key || editingKey || form.key || '').trim()
      if (logoFile && targetKey) {
        setUploadingLogo(true)
        const multipart = new FormData()
        multipart.append('file', logoFile)
        const uploadResponse = await api.post(`/seller-companies/${targetKey}/upload-logo/`, multipart, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        payload.logo_url = uploadResponse.data?.logo_url || uploadResponse.data?.logoUrl || payload.logo_url
      }

      await hydrateFromApi()
      setOpen(false)
      resetLogoState('')
      toast({ title: editingKey ? 'Satıcı firma güncellendi' : 'Satıcı firma oluşturuldu' })
    } catch (error: any) {
      toast({
        title: 'İşlem başarısız',
        description: error?.response?.data?.detail || 'Satıcı firma kaydedilemedi.',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
      setSaving(false)
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm(`${key} satıcı firmasını silmek istediğinize emin misiniz?`)) return
    setDeletingKey(key)
    try {
      await api.delete(`/seller-companies/${key}/`)
      await hydrateFromApi()
      toast({ title: 'Satıcı firma silindi' })
    } catch (error: any) {
      toast({
        title: 'Silinemedi',
        description: error?.response?.data?.detail || 'Satıcı firma silinemedi.',
        variant: 'destructive',
      })
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Satıcı Firma Yönetimi"
        description="AYKA, ORTKA ve diğer satıcı firmaların şablonlarda kullanılan unvan, vergi, iletişim, imza, logo ve banka bilgilerini buradan yönetin."
        actions={
          <RbacGuard perm="quotes.edit">
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni satıcı firma
            </Button>
          </RbacGuard>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Firma kartları</CardTitle>
            <CardDescription>
              İlk iki aktif firma teklif ve sözleşme şablonlarındaki karşılıklı firma / IBAN bloklarında kullanılır.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sellerCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz satıcı firma tanımı yok.</p>
            ) : (
              sellerCompanies.map((company) => (
                <div key={company.key} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{company.shortName || company.key}</Badge>
                        <Badge variant={company.isActive !== false ? 'secondary' : 'outline'}>
                          {company.isActive !== false ? 'Aktif' : 'Pasif'}
                        </Badge>
                        <Badge variant="outline">Sıra: {company.sortOrder ?? 0}</Badge>
                      </div>
                      <div>
                        <p className="font-semibold">{company.displayName}</p>
                        <p className="text-sm text-muted-foreground">{company.legalName || company.displayName}</p>
                      </div>
                      {company.logoUrl ? (
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border/70 bg-background p-2">
                            <img
                              src={resolveSellerLogoUrl(company.logoUrl)}
                              alt={`${company.displayName} logosu`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Yüklenen logo belge taslaklarında kullanılmaya hazır tutulur.</p>
                        </div>
                      ) : null}
                      <div className="grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                        <p>Vergi: {[company.taxOffice, company.taxNumber].filter(Boolean).join(' / ') || '-'}</p>
                        <p>İletişim: {[company.phone, company.email].filter(Boolean).join(' / ') || '-'}</p>
                        <p>Adres: {[company.city, company.country].filter(Boolean).join(', ') || '-'}</p>
                        <p>Banka hesabı: {company.bankAccounts?.length || 0} ({bankAccountCurrencySummary(company.bankAccounts)})</p>
                      </div>
                    </div>
                    <RbacGuard perm="quotes.edit">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(company)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Düzenle
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingKey === company.key}
                          onClick={() => handleDelete(company.key)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </RbacGuard>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Şablon ihtiyaçları</CardTitle>
            <CardDescription>Bu panelde tuttuğumuz alanlar belge exportlarında ve şablon üstbilgilerinde kullanılmak üzere hazır tutulur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/70 p-3">
              <p className="font-medium text-foreground">Kullandığımız ana alanlar</p>
              <p>Kısa ad, firma unvanı, vergi bilgileri, açık adres, telefon, e-posta, imza etiketi, logo ve banka hesapları.</p>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <p className="font-medium text-foreground">Gelecek ihtiyaçlar için hazır alanlar</p>
              <p>KEP adresi, MERSİS numarası, ticaret sicil no, imza adı / ünvanı ve iç notlar burada tutulur.</p>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <p className="font-medium text-foreground">Şablona yansıma mantığı</p>
              <p>İlk iki aktif firma karşılıklı firma bloklarında görünür. Belge içinde seçilen satıcı firma ise imza / başlık tarafında esas alınır.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Satıcı firma düzenle' : 'Yeni satıcı firma'}</DialogTitle>
            <DialogDescription>
              Bu bilgiler teklif ve sözleşme şablonlarındaki satıcı firma alanları, iletişim blokları, logo alanları ve banka bilgileri için kullanılır.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Firma kodu</Label>
                <Input value={form.key} onChange={(event) => updateField('key', event.target.value)} disabled={Boolean(editingKey)} placeholder="Örn. AYKA" />
              </div>
              <div className="space-y-2">
                <Label>Kısa ad</Label>
                <Input value={form.short_name} onChange={(event) => updateField('short_name', event.target.value)} placeholder="Örn. AYKA" />
              </div>
              <div className="space-y-2">
                <Label>Sıra</Label>
                <Input type="number" value={form.sort_order} onChange={(event) => updateField('sort_order', Number(event.target.value || 0))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Şablonda görünecek firma unvanı</Label>
                <Input value={form.display_name} onChange={(event) => updateField('display_name', event.target.value)} placeholder="Firma başlık alanında kullanılacak unvan" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <div>
                  <Label>Aktif</Label>
                  <p className="text-xs text-muted-foreground">Pasif firmalar teklif seçiminde ve şablon sıralamasında görünmez.</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(checked) => updateField('is_active', checked)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Resmi / hukuki unvan</Label>
                <Input value={form.legal_name} onChange={(event) => updateField('legal_name', event.target.value)} placeholder="Şirketin tam resmi unvanı" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Vergi dairesi</Label>
                <Input value={form.tax_office} onChange={(event) => updateField('tax_office', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vergi numarası</Label>
                <Input value={form.tax_number} onChange={(event) => updateField('tax_number', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>MERSİS numarası</Label>
                <Input value={form.mersis_number} onChange={(event) => updateField('mersis_number', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ticaret sicil no</Label>
                <Input value={form.trade_registry_number} onChange={(event) => updateField('trade_registry_number', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-posta</Label>
                <Input value={form.email} onChange={(event) => updateField('email', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Web sitesi</Label>
                <Input value={form.website} onChange={(event) => updateField('website', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>KEP adresi</Label>
                <Input value={form.kep_address} onChange={(event) => updateField('kep_address', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Şehir</Label>
                <Input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ülke</Label>
                <Input value={form.country} onChange={(event) => updateField('country', event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Açık adres</Label>
                <Textarea value={form.address} onChange={(event) => updateField('address', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>İmza etiketi</Label>
                <Input value={form.signature_label} onChange={(event) => updateField('signature_label', event.target.value)} placeholder="Örn. AYKA ADINA İMZA" />
              </div>
              <div className="space-y-2">
                <Label>Firma logosu</Label>
                <Input
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null
                    setLogoFile(nextFile)
                    if (nextFile) setRemoveLogo(false)
                  }}
                />
                <p className="text-xs text-muted-foreground">PNG, JPG, JPEG ve SVG desteklenir. Maksimum 3 MB.</p>
              </div>
              <div className="space-y-2">
                <Label>İmza adı</Label>
                <Input value={form.signature_name} onChange={(event) => updateField('signature_name', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>İmza ünvanı</Label>
                <Input value={form.signature_title} onChange={(event) => updateField('signature_title', event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>İç notlar</Label>
                <Textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Şablon veya operasyon notları" />
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label>Logo önizleme</Label>
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/70 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border/70 bg-background p-3">
                      {logoPreviewUrl ? (
                        <img src={logoPreviewUrl} alt="Satıcı firma logo önizleme" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Logo yok</span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{logoFile ? `Seçilen dosya: ${logoFile.name}` : form.logo_url ? 'Kayıtlı logo kullanılıyor.' : 'Henüz logo yüklenmedi.'}</p>
                      <p>Kaydet dediğinizde seçili dosya güvenli şekilde sisteme yüklenir.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setLogoFile(null)
                        setRemoveLogo(false)
                        setLogoPreviewUrl(resolveSellerLogoUrl(form.logo_url))
                      }}
                    >
                      Seçimi temizle
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!form.logo_url && !logoFile}
                      onClick={() => {
                        setLogoFile(null)
                        setRemoveLogo(true)
                        setLogoPreviewUrl('')
                      }}
                    >
                      Logoyu kaldır
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Banka hesapları</Label>
                  <p className="text-xs text-muted-foreground">Belgedeki iki IBAN kolonunun başlığını ve her bankanın iki IBAN bilgisini buradan yönetin.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => updateField('bank_accounts', [...form.bank_accounts, createBlankBankAccount()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  Hesap ekle
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>1. IBAN kolon başlığı</Label>
                  <Input value={form.bank_iban_label} onChange={(event) => updateField('bank_iban_label', event.target.value)} placeholder="Türk Lirası Hesapları" />
                </div>
                <div className="space-y-2">
                  <Label>2. IBAN kolon başlığı</Label>
                  <Input value={form.bank_iban_2_label} onChange={(event) => updateField('bank_iban_2_label', event.target.value)} placeholder="Dolar Hesapları" />
                </div>
              </div>
              <div className="space-y-3">
                {form.bank_accounts.map((account, index) => (
                  <div key={`bank-${index}`} className="rounded-lg border border-border/70 p-3">
                    <div className="grid gap-3 md:grid-cols-6">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Banka adı</Label>
                        <Input value={account.bank} onChange={(event) => updateBankAccount(index, { bank: event.target.value })} />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label>1. IBAN</Label>
                        <Input value={account.iban} onChange={(event) => updateBankAccount(index, { iban: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>1. para birimi</Label>
                        <Select value={account.currency || 'TRY'} onValueChange={(value) => updateBankAccount(index, { currency: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BANK_ACCOUNT_CURRENCIES.map((currency) => (
                              <SelectItem key={currency.value} value={currency.value}>
                                {currency.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label>2. IBAN (opsiyonel)</Label>
                        <Input value={account.iban_2} onChange={(event) => updateBankAccount(index, { iban_2: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>2. para birimi</Label>
                        <Select value={account.currency_2 || 'USD'} onValueChange={(value) => updateBankAccount(index, { currency_2: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BANK_ACCOUNT_CURRENCIES.map((currency) => (
                              <SelectItem key={currency.value} value={currency.value}>
                                {currency.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Şube</Label>
                        <Input value={account.branch} onChange={(event) => updateBankAccount(index, { branch: event.target.value })} />
                      </div>
                      <div className="space-y-2 md:col-span-4">
                        <Label>Hesap sahibi</Label>
                        <Input value={account.account_holder} onChange={(event) => updateBankAccount(index, { account_holder: event.target.value })} />
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            updateField(
                              'bank_accounts',
                              form.bank_accounts.length === 1
                                ? [createBlankBankAccount()]
                                : form.bank_accounts.filter((_, accountIndex) => accountIndex !== index)
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Kaldır
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                resetLogoState('')
              }}
              disabled={saving || uploadingLogo}
            >
              Vazgeç
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingLogo}>
              {saving || uploadingLogo ? 'Kaydediliyor...' : editingKey ? 'Değişiklikleri kaydet' : 'Satıcı firmayı oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
