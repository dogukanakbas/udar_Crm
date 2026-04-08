import type { Task, TaskProductLine } from '@/types'
import type { TaskProductLineFormValues } from '@/lib/task-product-schema'

export function emptyProductLineRow(): TaskProductLineFormValues {
  return {
    mode: 'manual',
    modelCode: '',
    variant: '',
    quantity: 1,
    modelDurationMinutes: 0,
    totalPlannedMinutes: 0,
    modelBladeDepth: '',
    modelSizes: [],
    productColor: '',
    productColorCode: '',
    briefIntro: '',
  }
}

export function mapApiProductLineToTask(ln: any): TaskProductLine {
  const mode = ln?.mode === 'fixed' ? 'fixed' : 'manual'
  return {
    mode,
    modelCode: ln?.model_code != null ? String(ln.model_code) : ln?.modelCode != null ? String(ln.modelCode) : undefined,
    variant: ln?.variant != null ? String(ln.variant) : undefined,
    quantity: ln?.quantity != null ? Number(ln.quantity) : undefined,
    modelDurationMinutes:
      ln?.model_duration_minutes != null
        ? Number(ln.model_duration_minutes)
        : ln?.modelDurationMinutes != null
          ? Number(ln.modelDurationMinutes)
          : undefined,
    totalPlannedMinutes:
      ln?.total_planned_minutes != null
        ? Number(ln.total_planned_minutes)
        : ln?.totalPlannedMinutes != null
          ? Number(ln.totalPlannedMinutes)
          : undefined,
    modelBladeDepth:
      ln?.model_blade_depth != null
        ? String(ln.model_blade_depth)
        : ln?.modelBladeDepth != null
          ? String(ln.modelBladeDepth)
          : undefined,
    modelSizes: Array.isArray(ln?.model_sizes) ? ln.model_sizes.map(String) : Array.isArray(ln?.modelSizes) ? ln.modelSizes.map(String) : [],
    productColor:
      ln?.product_color != null && String(ln.product_color).trim() !== ''
        ? String(ln.product_color).trim()
        : ln?.productColor != null && String(ln.productColor).trim() !== ''
          ? String(ln.productColor).trim()
          : undefined,
    productColorCode:
      ln?.product_color_code != null && String(ln.product_color_code).trim() !== ''
        ? String(ln.product_color_code).trim()
        : ln?.productColorCode != null && String(ln.productColorCode).trim() !== ''
          ? String(ln.productColorCode).trim()
          : undefined,
    briefIntro:
      ln?.brief_intro != null && String(ln.brief_intro).trim() !== ''
        ? String(ln.brief_intro).trim()
        : ln?.briefIntro != null && String(ln.briefIntro).trim() !== ''
          ? String(ln.briefIntro).trim()
          : undefined,
  }
}

export function taskProductLinesToApiPayload(lines: TaskProductLineFormValues[]): Record<string, unknown>[] {
  return lines.map((line) => ({
    mode: line.mode ?? 'manual',
    model_code: line.modelCode ?? '',
    variant: line.variant ?? '',
    quantity: line.quantity ?? 1,
    model_duration_minutes: line.modelDurationMinutes ?? 0,
    total_planned_minutes: line.totalPlannedMinutes ?? 0,
    model_blade_depth: line.modelBladeDepth ?? '',
    model_sizes: line.modelSizes ?? [],
    product_color: line.productColor ?? '',
    product_color_code: line.productColorCode ?? '',
    brief_intro: String(line.briefIntro ?? '').trim().slice(0, 600),
  }))
}

export function initialProductLinesForForm(task?: Task): TaskProductLineFormValues[] {
  if (task?.productLines?.length) {
    return task.productLines.map((p) => ({
      mode: p.mode === 'fixed' ? 'fixed' : 'manual',
      modelCode: p.modelCode ?? '',
      variant: p.variant ?? '',
      quantity: p.quantity ?? 1,
      modelDurationMinutes: p.modelDurationMinutes ?? 0,
      totalPlannedMinutes: p.totalPlannedMinutes ?? 0,
      modelBladeDepth: p.modelBladeDepth ?? '',
      modelSizes: p.modelSizes ?? [],
      productColor: p.productColor ?? '',
      productColorCode: p.productColorCode ?? '',
      briefIntro: p.briefIntro ?? '',
    }))
  }
  return [
    {
      mode: task?.mode === 'fixed' ? 'fixed' : 'manual',
      modelCode: task?.modelCode ?? '',
      variant: task?.variant ?? '',
      quantity: task?.quantity ?? 1,
      modelDurationMinutes: task?.modelDurationMinutes ?? 0,
      totalPlannedMinutes: task?.totalPlannedMinutes ?? 0,
      modelBladeDepth: task?.modelBladeDepth ?? '',
      modelSizes: task?.modelSizes ?? [],
      productColor: task?.productColor ?? '',
      productColorCode: task?.productColorCode ?? '',
      briefIntro: '',
    },
  ]
}
