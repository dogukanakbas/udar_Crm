import { useEffect, useMemo, useState } from 'react'
import type { UseFormReturn, FieldErrors } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
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
  teams,
  workflowTemplates,
  onCreateWorkflowTemplate,
}: {
  form: UseFormReturn<any>
  index: number
  task?: Task
  apiTaskModels: ApiModel[]
  orgSettings: { working_hours_start: string; working_hours_end: string; working_days: number[] } | null
  modelPresets: Preset[]
  teams: { id: string; name: string }[]
  workflowTemplates: { id: string; name: string; teamIds: string[] }[]
  onCreateWorkflowTemplate: (payload: { name: string; teamIds: string[] }) => Promise<void>
}) {
  const p = `productLines.${index}` as const
  const watchMode = form.watch(`${p}.mode`)
  const watchUnit = form.watch(`${p}.unitType`) || 'adet'
  const watchModel = form.watch(`${p}.modelCode`)
  const watchVariant = form.watch(`${p}.variant`)
  const watchQty = form.watch(`${p}.quantity`)
  const watchDuration = form.watch(`${p}.modelDurationMinutes`)
  const lineWfTeamIds = (form.watch(`${p}.workflowTeamIds`) || []) as string[]
  const lineWfTargets = (form.watch(`${p}.workflowStageTargets`) || []) as number[]
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
  const wfTargetsNormalized =
    lineWfTargets.length === lineWfTeamIds.length
      ? lineWfTargets
      : lineWfTeamIds.map((_, i) => Number(lineWfTargets[i] ?? Math.max(1, Number(watchQty) || 1)))
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplTeamIds, setTplTeamIds] = useState<string[]>([])

  const setLineWfTeam = (idx: number, teamId: string) => {
    const next = [...lineWfTeamIds]
    next[idx] = teamId
    form.setValue(`${p}.workflowTeamIds`, next)
  }
  const addLineWfStep = () => {
    form.setValue(`${p}.workflowTeamIds`, [...lineWfTeamIds, ''])
    form.setValue(`${p}.workflowStageTargets`, [...wfTargetsNormalized, Math.max(1, Number(watchQty) || 1)])
  }
  const applyTemplate = (templateId: string) => {
    const tpl = workflowTemplates.find((x) => String(x.id) === String(templateId))
    if (!tpl) return
    const ids = (tpl.teamIds || []).map(String).filter(Boolean)
    form.setValue(`${p}.workflowTeamIds`, ids)
    form.setValue(
      `${p}.workflowStageTargets`,
      ids.map(() => Math.max(1, Number(watchQty) || 1))
    )
  }
  const addTplStep = () => setTplTeamIds((prev) => [...prev, ''])
  const setTplStep = (idx: number, teamId: string) => {
    setTplTeamIds((prev) => {
      const next = [...prev]
      next[idx] = teamId
      return next
    })
  }
  const removeTplStep = (idx: number) => setTplTeamIds((prev) => prev.filter((_, i) => i !== idx))
  const saveTemplate = async () => {
    const name = tplName.trim()
    const ids = tplTeamIds.map(String).map((x) => x.trim()).filter(Boolean)
    if (!name || ids.length === 0) return
    await onCreateWorkflowTemplate({ name, teamIds: ids })
    setTplName('')
    setTplTeamIds([])
    setCreatingTemplate(false)
  }
  const removeLineWfStep = (idx: number) => {
    form.setValue(
      `${p}.workflowTeamIds`,
      lineWfTeamIds.filter((_, i) => i !== idx)
    )
    form.setValue(
      `${p}.workflowStageTargets`,
      wfTargetsNormalized.filter((_, i) => i !== idx)
    )
  }

  return (
    <div className="space-y-3 rounded-md border p-3 bg-muted/20">
      <div className="space-y-2 rounded-md border bg-background p-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Bu kalemin iş akışı (ekip sırası)</Label>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={addLineWfStep}>
              Adım ekle
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCreatingTemplate((v) => !v)}>
              Şablon oluştur
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={'none'} onValueChange={(v) => v !== 'none' && applyTemplate(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Şablon seç (ekip sırası otomatik gelsin)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Şablon seç —</SelectItem>
              {workflowTemplates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {creatingTemplate ? (
          <div className="space-y-2 rounded border bg-muted/20 p-2">
            <div>
              <Label className="text-xs">Şablon adı</Label>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Örn. A İş Süreci" />
            </div>
            <div className="space-y-2">
              {tplTeamIds.map((teamId, i) => (
                <div key={`tpl-step-${i}`} className="flex items-center gap-2">
                  <Select value={teamId || 'none'} onValueChange={(v) => setTplStep(i, v === 'none' ? '' : v)}>
                    <SelectTrigger className="flex-1 min-w-[8rem]">
                      <SelectValue placeholder="Ekip seç" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Ekip seç —</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeTplStep(i)}>
                    Sil
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addTplStep}>
                  Şablona adım ekle
                </Button>
                <Button type="button" size="sm" onClick={saveTemplate}>
                  Şablonu kaydet
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {lineWfTeamIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">Bu kalem için ekip adımı tanımlı değil.</p>
        ) : (
          <div className="space-y-2">
            {lineWfTeamIds.map((teamId, i) => (
              <div key={`line-wf-${index}-${i}`} className="flex items-center gap-2">
                <Select value={teamId || 'none'} onValueChange={(v) => setLineWfTeam(i, v === 'none' ? '' : v)}>
                  <SelectTrigger className="flex-1 min-w-[8rem]">
                    <SelectValue placeholder="Ekip seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Ekip seç —</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeLineWfStep(i)}>
                  Sil
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
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
        <div>
          <Label>Birim</Label>
          <Select value={watchUnit} onValueChange={(v) => form.setValue(`${p}.unitType`, v as 'adet' | 'metre')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adet">Adet</SelectItem>
              <SelectItem value="metre">Metre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {watchMode === 'fixed' && (
          <div>
            <Label>{watchUnit === 'metre' ? 'Metre' : 'Adet'}</Label>
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
            <Label>{watchUnit === 'metre' ? 'Metre' : 'Adet'}</Label>
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>Fire {watchUnit === 'metre' ? '(metre)' : '(adet)'}</Label>
          <Input type="number" min={0} step="0.1" {...form.register(`${p}.fireQty`, { valueAsNumber: true })} />
        </div>
        <div className="md:col-span-2">
          <Label>Fire sebebi</Label>
          <Input {...form.register(`${p}.fireReason`)} placeholder="Kısa açıklama" />
        </div>
        <div className="md:col-span-3">
          <Label>Fire görseli (yerel)</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) {
                form.setValue(`${p}.fireImageDataUrl`, '')
                return
              }
              const rd = new FileReader()
              rd.onload = () => {
                form.setValue(`${p}.fireImageDataUrl`, String(rd.result || ''))
              }
              rd.readAsDataURL(f)
            }}
          />
          {form.watch(`${p}.fireImageDataUrl`) ? (
            <img src={form.watch(`${p}.fireImageDataUrl`)} alt="fire" className="mt-2 h-20 w-20 rounded border object-cover" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
