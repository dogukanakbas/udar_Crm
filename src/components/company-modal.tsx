import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { SearchableCombobox } from '@/components/searchable-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  COMPANY_SIZE_OPTIONS,
  DEFAULT_COMPANY_COUNTRY_LABEL,
  findCountryOption,
  getCityOptionsForCountry,
  getCompanyCurrencyOptions,
  getCountryOptions,
  includeCustomCityOption,
  isTurkeyCountry,
  normalizeCompanySize,
  normalizeCountryLabel,
  resolveCompanyCurrency,
} from '@/lib/location-data'
import api from '@/lib/api'
import { getDefaultPriceList, normalizePriceLists, type PriceListOption } from '@/lib/price-lists'
import { normalizeSearchText } from '@/lib/utils'
import type { Company } from '@/types'

export const companySchema = z.object({
  name: z.string().min(2),
  industry: z.string().max(50, 'Sektör / grup en fazla 50 karakter olabilir').optional().default(''),
  region: z.string().optional().default(''),
  country: z.string().optional().default(DEFAULT_COMPANY_COUNTRY_LABEL),
  currency: z.string().optional().default('TRY'),
  priceListKey: z.string().optional().default(''),
  size: z.string().optional().default(''),
  owner: z.string().optional().default(''),
  annualRevenue: z.coerce.number().optional().default(0),
  address: z.string().optional().default(''),
  taxOffice: z.string().optional().default(''),
  taxNumber: z.string().optional().default(''),
  authorizedPerson: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
})

export type CompanyFormValues = z.infer<typeof companySchema>

const REGISTERED_SELECT_FIELDS: (keyof CompanyFormValues)[] = ['country', 'region', 'currency', 'priceListKey', 'size']

const getDefaultValues = (company?: Company): CompanyFormValues => ({
  name: company?.name ?? '',
  industry: company?.industry ?? '',
  region: company?.region ?? '',
  country: company ? normalizeCountryLabel(company.country) || company.country || '' : DEFAULT_COMPANY_COUNTRY_LABEL,
  currency: resolveCompanyCurrency(company?.currency, company?.country),
  priceListKey: company?.priceListKey ?? '',
  size: normalizeCompanySize(company?.size),
  owner: company?.owner ?? '',
  annualRevenue: company?.annualRevenue ?? 0,
  address: company?.address ?? '',
  taxOffice: company?.taxOffice ?? '',
  taxNumber: company?.taxNumber ?? '',
  authorizedPerson: company?.authorizedPerson ?? '',
  phone: company?.phone ?? '',
  email: company?.email ?? '',
})

const API_FIELD_LABELS: Record<string, string> = {
  name: 'Ad',
  group: 'Sektör / grup',
  email: 'E-posta',
  phone: 'Telefon',
  currency: 'Para birimi',
  price_list_key: 'Fiyat listesi',
  country: 'Ülke',
}

const getApiErrorMessage = (err: any) => {
  const detail = err?.response?.data
  if (!detail) return 'Kaydedilemedi'
  if (typeof detail === 'string') return detail
  if (typeof detail.detail === 'string') return detail.detail
  if (typeof detail !== 'object') return 'Kaydedilemedi'

  const firstEntry = Object.entries(detail)[0]
  if (!firstEntry) return 'Kaydedilemedi'

  const [field, value] = firstEntry
  const message = Array.isArray(value) ? value[0] : value
  const renderedMessage = typeof message === 'string' ? message : 'Geçersiz değer'
  const label = API_FIELD_LABELS[field] || field
  return `${label}: ${renderedMessage}`
}

type CompanyModalProps = {
  children?: ReactNode
  company?: Company
  onSubmit: (values: CompanyFormValues) => void | Promise<void>
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CompanyModal({ children, company, onSubmit, open, onOpenChange }: CompanyModalProps) {
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema) as any,
    defaultValues: getDefaultValues(company),
  })
  const [internalOpen, setInternalOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [priceLists, setPriceLists] = useState<PriceListOption[]>(normalizePriceLists())

  const isControlled = open !== undefined
  const modalOpen = isControlled ? open : internalOpen
  const setModalOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const watchedCountry = form.watch('country')
  const watchedRegion = form.watch('region')
  const watchedCurrency = form.watch('currency')
  const watchedPriceListKey = form.watch('priceListKey')
  const watchedSize = form.watch('size')
  const countryOptions = useMemo(() => getCountryOptions(), [])
  const selectedCountry = useMemo(() => findCountryOption(watchedCountry), [watchedCountry])
  const isTurkeySelected = useMemo(() => isTurkeyCountry(watchedCountry), [watchedCountry])
  const currencyOptions = useMemo(() => getCompanyCurrencyOptions(watchedCountry), [watchedCountry])

  const countrySelectOptions = useMemo(() => {
    const baseOptions = countryOptions.map((countryOption) => ({
      value: countryOption.label,
      label: countryOption.label,
      searchText: countryOption.searchText,
    }))

    const trimmedCountry = watchedCountry?.trim()
    if (!trimmedCountry) return baseOptions

    const hasCurrentCountry = baseOptions.some(
      (option) => normalizeSearchText(option.value) === normalizeSearchText(trimmedCountry)
    )

    if (hasCurrentCountry) return baseOptions

    return [{ value: trimmedCountry, label: trimmedCountry, searchText: trimmedCountry }, ...baseOptions]
  }, [countryOptions, watchedCountry])

  const turkeyCityOptions = useMemo(
    () =>
      includeCustomCityOption(getCityOptionsForCountry(watchedCountry), watchedRegion).map((cityOption) => ({
        value: cityOption.value,
        label: cityOption.label,
        searchText: cityOption.searchText,
      })),
    [watchedCountry, watchedRegion]
  )

  useEffect(() => {
    REGISTERED_SELECT_FIELDS.forEach((fieldName) => {
      form.register(fieldName)
    })
  }, [form])

  useEffect(() => {
    form.reset(getDefaultValues(company))
    if (!modalOpen) setSubmitError(null)
  }, [company, form, modalOpen])

  useEffect(() => {
    if (!modalOpen) return
    api
      .get('/auth/organization-settings/')
      .then((response) => {
        const lists = normalizePriceLists(response.data?.price_lists)
        setPriceLists(lists)
        if (!form.getValues('priceListKey')) {
          form.setValue('priceListKey', getDefaultPriceList(lists).key, { shouldDirty: false })
        }
      })
      .catch(() => {
        const lists = normalizePriceLists()
        setPriceLists(lists)
        if (!form.getValues('priceListKey')) form.setValue('priceListKey', getDefaultPriceList(lists).key, { shouldDirty: false })
      })
  }, [form, modalOpen])

  useEffect(() => {
    if (!modalOpen) return

    const matchedCountry = findCountryOption(form.getValues('country'))
    if (matchedCountry && matchedCountry.label !== form.getValues('country')) {
      form.setValue('country', matchedCountry.label, { shouldDirty: false, shouldValidate: true })
    }
  }, [form, modalOpen])

  useEffect(() => {
    if (!modalOpen) return

    const resolvedCurrency = resolveCompanyCurrency(form.getValues('currency'), form.getValues('country'))
    if (resolvedCurrency !== form.getValues('currency')) {
      form.setValue('currency', resolvedCurrency, { shouldDirty: false, shouldValidate: true })
    }
  }, [form, modalOpen, watchedCountry])

  const handleCountryChange = (countryLabel: string) => {
    const matchedCountry = countryOptions.find(
      (countryOption) => normalizeSearchText(countryOption.label) === normalizeSearchText(countryLabel)
    )
    const nextCountryLabel = matchedCountry?.label || countryLabel

    form.setValue('country', nextCountryLabel, { shouldDirty: true, shouldValidate: true })
    form.setValue('region', '', { shouldDirty: true, shouldValidate: true })
    form.setValue('currency', resolveCompanyCurrency(form.getValues('currency'), nextCountryLabel), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{company ? 'Şirketi Düzenle' : 'Yeni Şirket'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Ad</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sektör / grup</Label>
              <Input maxLength={50} {...form.register('industry')} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Ülke</Label>
              <SearchableCombobox
                value={watchedCountry}
                options={countrySelectOptions}
                placeholder="Ülke seçin"
                searchPlaceholder="Ülke ara..."
                emptyMessage="Ülke bulunamadı."
                onValueChange={handleCountryChange}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{isTurkeySelected ? 'Şehir' : 'Şehir / Bölge'}</Label>
              {isTurkeySelected ? (
                <SearchableCombobox
                  value={watchedRegion}
                  options={turkeyCityOptions}
                  disabled={!selectedCountry}
                  placeholder={selectedCountry ? 'Şehir seçin' : 'Önce ülke seçin'}
                  searchPlaceholder="Şehir ara..."
                  emptyMessage="Şehir bulunamadı."
                  onValueChange={(cityValue) =>
                    form.setValue('region', cityValue, { shouldDirty: true, shouldValidate: true })
                  }
                />
              ) : (
                <Input
                  value={watchedRegion}
                  disabled={!selectedCountry}
                  placeholder={selectedCountry ? 'Şehir veya bölge girin' : 'Önce ülke seçin'}
                  onChange={(event) =>
                    form.setValue('region', event.target.value, { shouldDirty: true, shouldValidate: true })
                  }
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Para birimi</Label>
              <Select
                value={resolveCompanyCurrency(watchedCurrency, watchedCountry)}
                onValueChange={(value) =>
                  form.setValue('currency', value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Para birimi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((currencyOption) => (
                    <SelectItem key={currencyOption.value} value={currencyOption.value}>
                      {currencyOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ölçek</Label>
              <Select
                value={normalizeCompanySize(watchedSize) || 'unset'}
                onValueChange={(value) =>
                  form.setValue('size', value === 'unset' ? '' : value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ölçek seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Ölçek seçin</SelectItem>
                  {COMPANY_SIZE_OPTIONS.map((sizeOption) => (
                    <SelectItem key={sizeOption} value={sizeOption}>
                      {sizeOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Fiyat listesi</Label>
              <Select
                value={watchedPriceListKey || getDefaultPriceList(priceLists).key}
                onValueChange={(value) =>
                  form.setValue('priceListKey', value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fiyat listesi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {priceLists.map((priceList) => (
                    <SelectItem key={priceList.key} value={priceList.key}>
                      {priceList.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Yetkili</Label>
              <Input {...form.register('authorizedPerson')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Vergi dairesi</Label>
              <Input {...form.register('taxOffice')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Vergi no</Label>
              <Input {...form.register('taxNumber')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sahip</Label>
              <Input {...form.register('owner')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Telefon</Label>
              <Input {...form.register('phone')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>E-posta</Label>
              <Input type="email" {...form.register('email')} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Adres</Label>
            <Textarea rows={4} {...form.register('address')} />
          </div>
        </div>
        <DialogFooter>
          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
          <Button
            onClick={form.handleSubmit(async (values) => {
              setSubmitError(null)
              try {
                await onSubmit(values as CompanyFormValues)
                form.reset(getDefaultValues(company))
                setModalOpen(false)
              } catch (err: any) {
                setSubmitError(getApiErrorMessage(err))
              }
            })}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
