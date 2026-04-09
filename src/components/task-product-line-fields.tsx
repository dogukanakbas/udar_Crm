import { useEffect, useMemo } from 'react'
import type { UseFormReturn, FieldErrors } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatNumber, getWorkingMinutesPerDay } from '@/lib/utils'
import type { Task } from '@/types'

function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function parseBladeMin(v: string | undefined): string {
  if (!v) return ''
  const parts = v.split('-')
  if (parts[0]?.trim()) return parts[0].trim()
  return v.match(/[\d.]+/)?.[0] || ''
}
function parseBladeMax(v: string | undefined): string {
  if (!v) return ''
  const parts = v.split('-')
  if (parts[1]?.trim()) return parts[1].trim()
  const num = v.match(/[\d.]+/)?.[0]
  return num || ''
}

type Preset = {
  code: string
  sizes: string[]
  variants: { id: string; label: string; duration: number; blade: string }[]
  baseDuration: number
  baseBlade: string
}

type ApiModel = {
  code_string?: string
  code: string
  image_url?: string
  duration_minutes: number
  sizes: string[]
  blade_min?: number
  blade_max?: number
  width_mm?: number
  height_mm?: number
  thickness_mm?: number
}

/** Tek görev formunda `productLines[i]` alanları — süre/ölçü otomatikleri satıra göre. */
export function TaskProductLineFields({
  form,
  index,
  task,
  apiTaskModels,
  orgSettings,
  modelPresets,
}: {
  form: UseFormReturn<any>
  index: number
  task?: Task
  apiTaskModels: ApiModel[]
  orgSettings: { working_hours_start: string; working_hours_end: string; working_days: number[] } | null
  modelPresets: Preset[]
}) {
  const p = `productLines.${index}` as const
  const watchMode = form.watch(`${p}.mode`)
  const watchModel = form.watch(`${p}.modelCode`)
  const watchVariant = form.watch(`${p}.variant`)
  const watchQty = form.watch(`${p}.quantity`)
  const watchDuration = form.watch(`${p}.modelDurationMinutes`)
  const errors = form.formState.errors as FieldErrors<any>
  const lineErr = (errors.productLines as any)?.[index] as Record<string, { message?: string }> | undefined

  const currentPreset = useMemo(
    () => modelPresets.find((m) => m.code === watchModel) || modelPresets[0],
    [watchModel, modelPresets]
  )

  const minsPerMesaiDay = useMemo(() => {
    const start = orgSettings?.working_hours_start || '08:00'
    const end = orgSettings?.working_hours_end || '18:00'
    const m = getWorkingMinutesPerDay(start, end)
    return m > 0 ? m : 600
  }, [orgSettings])

  useEffect(() => {
    if (watchMode !== 'fixed') return
    const apiModel = apiTaskModels.find((m) => m.code === watchModel)
    const preset = modelPresets.find((m) => m.code === watchModel) || modelPresets[0]
    const variantObj = preset?.variants?.find((v) => v.id === watchVariant)
    const savedLines = task?.productLines
    const saved = savedLines?.[index]
    const editingSameAsSaved =
      Boolean(task?.id) &&
      String(watchModel || '') === String(saved?.modelCode || '') &&
      String(watchVariant || '') === String(saved?.variant || '')
    const shouldOverwriteTiming = !task?.id || !editingSameAsSaved

    if (preset && !watchModel) {
      form.setValue(`${p}.modelCode`, preset.code)
    }
    if (shouldOverwriteTiming) {
      if (variantObj) {
        form.setValue(`${p}.modelDurationMinutes`, variantObj.duration)
        const blade = variantObj.blade || ''
        const num = blade.match(/[\d.]+/)?.[0]
        form.setValue(`${p}.modelBladeDepth`, num ? `${num}-${num}` : blade)
      } else if (apiModel) {
        form.setValue(`${p}.modelDurationMinutes`, Number(apiModel.duration_minutes ?? 4))
        const bmin = apiModel.blade_min
        const bmax = apiModel.blade_max
        if (bmin != null && bmax != null) {
          form.setValue(`${p}.modelBladeDepth`, `${bmin}-${bmax}`)
        } else {
          form.setValue(`${p}.modelBladeDepth`, '')
        }
      } else if (preset) {
        form.setValue(`${p}.modelDurationMinutes`, preset.baseDuration)
        const blade = preset.baseBlade || ''
        const num = blade.match(/[\d.]+/)?.[0]
        form.setValue(`${p}.modelBladeDepth`, num ? `${num}-${num}` : blade)
      }
    }
  }, [watchMode, watchModel, watchVariant, apiTaskModels, modelPresets, task?.id, task?.productLines, index, p, form])

  useEffect(() => {
    if (watchMode !== 'manual' && watchMode !== 'fixed') return
    const duration = Number(watchDuration)
    if (!Number.isFinite(duration)) return
    const qty = Math.max(1, Number(watchQty) || 1)
    const total = Math.max(0, duration) * qty
    form.setValue(`${p}.totalPlannedMinutes`, Number(total.toFixed(2)))
  }, [watchMode, watchDuration, watchQty, p, form])

  const watchTotalPlanned = form.watch(`${p}.totalPlannedMinutes`)

  return (
    <div className="space-y-3 rounded-md border p-3 bg-muted/20">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Ürün rengi</Label>
          <Input {...form.register(`${p}.productColor`)} placeholder="Örn. Antrasit" />
        </div>
        <div>
          <Label>Renk kodu</Label>
          <Input {...form.register(`${p}.productColorCode`)} placeholder="Örn. RAL 7016" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Görev modu</Label>
          <Select value={watchMode} onValueChange={(v) => form.setValue(`${p}.mode`, v as 'manual' | 'fixed')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manuel</SelectItem>
              <SelectItem value="fixed">Sabit (model bazlı)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {watchMode === 'fixed' && (
          <div>
            <Label>Adet</Label>
            <Input
              type="number"
              min={1}
              {...form.register(`${p}.quantity`, { valueAsNumber: true })}
              className={cn(lineErr?.quantity && 'border-destructive')}
            />
            <FormError message={lineErr?.quantity?.message as string | undefined} />
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">
          Minimal görev tanıtımı (bu ürün için) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          {...form.register(`${p}.briefIntro`)}
          placeholder="Bu kalem için üretime kısa özet (isteğe bağlı)"
          rows={2}
          className={cn('mt-1 min-h-[56px] text-sm resize-y', lineErr?.briefIntro && 'border-destructive')}
        />
        <FormError message={lineErr?.briefIntro?.message as string | undefined} />
      </div>
      {watchMode === 'manual' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Adet</Label>
            <Input
              type="number"
              min={1}
              {...form.register(`${p}.quantity`, { valueAsNumber: true })}
              className={cn(lineErr?.quantity && 'border-destructive')}
            />
          </div>
          <div>
            <Label>Model süresi (dk)</Label>
            <Input
              type="number"
              step="0.1"
              min={0}
              {...form.register(`${p}.modelDurationMinutes`, { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Toplam planlanan (dk)</Label>
            <Input
              type="number"
              step="0.1"
              readOnly
              {...form.register(`${p}.totalPlannedMinutes`, { valueAsNumber: true })}
              className="bg-muted"
            />
            {Number(watchTotalPlanned) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatNumber(Number(watchTotalPlanned) / minsPerMesaiDay)} mesai günü
              </p>
            )}
          </div>
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Ölçüler (virgülle)</Label>
              <Input
                value={(form.watch(`${p}.modelSizes`) || []).join(', ')}
                onChange={(e) =>
                  form.setValue(
                    `${p}.modelSizes`,
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="Örn. 73x210, 83x210"
              />
            </div>
            <div>
              <Label>Bıçak derinliği</Label>
              <Input {...form.register(`${p}.modelBladeDepth`)} placeholder="Örn. 1.5-2.0" />
            </div>
          </div>
        </div>
      )}
      {watchMode === 'fixed' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Model</Label>
            <div className="flex gap-2 items-start">
              <Select
                value={watchModel || modelPresets[0]?.code}
                onValueChange={(v) => form.setValue(`${p}.modelCode`, v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {(apiTaskModels.length > 0 ? apiTaskModels.map((m) => ({ code: m.code })) : modelPresets).map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {apiTaskModels.find((m) => m.code === watchModel)?.image_url && (
                <img
                  src={apiTaskModels.find((m) => m.code === watchModel)!.image_url}
                  alt={watchModel}
                  className="h-16 w-16 object-cover rounded border"
                />
              )}
            </div>
            <FormError message={lineErr?.modelCode?.message as string | undefined} />
          </div>
          <div>
            <Label>Varyant (isteğe bağlı)</Label>
            <Select
              value={watchVariant || 'none'}
              onValueChange={(v) => form.setValue(`${p}.variant`, v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Varyant seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yok —</SelectItem>
                {(currentPreset?.variants || []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label} ({v.duration} dk)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Model süresi (dk)</Label>
            <Input type="number" step="0.1" {...form.register(`${p}.modelDurationMinutes`, { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Toplam planlanan (dk)</Label>
            <Input
              type="number"
              step="0.1"
              readOnly
              {...form.register(`${p}.totalPlannedMinutes`, { valueAsNumber: true })}
              className="bg-muted"
            />
            {Number(watchTotalPlanned) > 0 && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatNumber(Number(watchTotalPlanned) / minsPerMesaiDay)} mesai günü
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <div className="flex-1">
              <Label>Bıçak derinliği (min-mm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="1"
                value={parseBladeMin(form.watch(`${p}.modelBladeDepth`))}
                onChange={(e) => {
                  const min = e.target.value
                  const max = parseBladeMax(form.watch(`${p}.modelBladeDepth`))
                  form.setValue(`${p}.modelBladeDepth`, max ? `${min}-${max}` : min)
                }}
              />
            </div>
            <span className="pt-6">–</span>
            <div className="flex-1">
              <Label>Bıçak derinliği (max-mm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="3"
                value={parseBladeMax(form.watch(`${p}.modelBladeDepth`))}
                onChange={(e) => {
                  const max = e.target.value
                  const min = parseBladeMin(form.watch(`${p}.modelBladeDepth`))
                  form.setValue(`${p}.modelBladeDepth`, min ? `${min}-${max}` : max)
                }}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Ölçüler (isteğe bağlı, virgülle ayırın)</Label>
            <Input
              value={(form.watch(`${p}.modelSizes`) || []).join(', ')}
              onChange={(e) =>
                form.setValue(
                  `${p}.modelSizes`,
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="73x210, 83x210"
              className="text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
