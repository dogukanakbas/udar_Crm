import { useEffect, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Company } from '@/types'

export const companySchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional().default(''),
  region: z.string().optional().default(''),
  country: z.string().optional().default(''),
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

const getDefaultValues = (company?: Company): CompanyFormValues => ({
  name: company?.name ?? '',
  industry: company?.industry ?? '',
  region: company?.region ?? '',
  country: company?.country ?? '',
  size: company?.size ?? '',
  owner: company?.owner ?? '',
  annualRevenue: company?.annualRevenue ?? 0,
  address: company?.address ?? '',
  taxOffice: company?.taxOffice ?? '',
  taxNumber: company?.taxNumber ?? '',
  authorizedPerson: company?.authorizedPerson ?? '',
  phone: company?.phone ?? '',
  email: company?.email ?? '',
})

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

  const isControlled = open !== undefined
  const modalOpen = isControlled ? open : internalOpen
  const setModalOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  useEffect(() => {
    form.reset(getDefaultValues(company))
    if (!modalOpen) setSubmitError(null)
  }, [company, form, modalOpen])

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{company ? 'Şirketi Düzenle' : 'Yeni Şirket'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ad</Label>
              <Input {...form.register('name')} />
            </div>
            <div>
              <Label>Sektör / grup</Label>
              <Input {...form.register('industry')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Şehir</Label>
              <Input {...form.register('region')} />
            </div>
            <div>
              <Label>Ülke</Label>
              <Input {...form.register('country')} />
            </div>
            <div>
              <Label>Ölçek</Label>
              <Input {...form.register('size')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Yetkili</Label>
              <Input {...form.register('authorizedPerson')} />
            </div>
            <div>
              <Label>Vergi dairesi</Label>
              <Input {...form.register('taxOffice')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vergi no</Label>
              <Input {...form.register('taxNumber')} />
            </div>
            <div>
              <Label>Sahip</Label>
              <Input {...form.register('owner')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefon</Label>
              <Input {...form.register('phone')} />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input type="email" {...form.register('email')} />
            </div>
          </div>
          <div>
            <Label>Adres</Label>
            <Textarea rows={4} {...form.register('address')} />
          </div>
        </div>
        <DialogFooter>
          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
          <Button
            onClick={form.handleSubmit(async (values: any) => {
              setSubmitError(null)
              try {
                await onSubmit(values as CompanyFormValues)
                form.reset(getDefaultValues(company))
                setModalOpen(false)
              } catch (err: any) {
                const detail = err?.response?.data
                if (detail && typeof detail === 'object') {
                  const msg = detail.email?.[0] || detail.name?.[0] || detail.detail || 'Kaydedilemedi'
                  setSubmitError(msg)
                } else {
                  setSubmitError('Kaydedilemedi')
                }
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
