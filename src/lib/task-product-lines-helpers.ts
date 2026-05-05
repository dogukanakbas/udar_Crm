import type { Task, TaskProductLine } from '@/types'
import type { TaskProductLineFormValues } from '@/lib/task-product-schema'

/** Ürün satırlarındaki adetlerin toplamı (çoklu kalem sipariş adeti). */
export function sumProductLineQuantities(lines: { quantity?: unknown }[] | undefined | null): number {
  if (!lines?.length) return 0
  return lines.reduce((s, line) => s + Math.max(0, Number(line?.quantity) || 0), 0)
}

/** Kalemlerde kayıtlı üretilmiş adet toplamı (qty_produced). */
export function sumProductLineQtyProduced(
  lines: { qtyProduced?: unknown; qty_produced?: unknown }[] | undefined | null
): number {
  if (!lines?.length) return 0
  return lines.reduce((s, line) => {
    const raw = line?.qtyProduced ?? line?.qty_produced
    return s + Math.max(0, Number(raw) || 0)
  }, 0)
}

/** İş akışı hedef yedeği: sıralı çoklu kalemde aktif satır adedi; aksi halde satır toplamı veya görev adedi. */
export function workflowTargetFallbackQty(task: {
  productLines?: { quantity?: unknown }[]
  workflowParallel?: boolean
  activeProductIndex?: number
  quantity?: unknown
}): number {
  const lines = task.productLines || []
  if (lines.length > 1 && !task.workflowParallel) {
    const ai = Math.min(
      Math.max(0, Number(task.activeProductIndex) || 0),
      Math.max(0, lines.length - 1)
    )
    const q = Math.max(0, Number(lines[ai]?.quantity) || 0)
    return q > 0 ? q : Number(task.quantity ?? 1) || 1
  }
  const sum = sumProductLineQuantities(lines)
  return sum > 0 ? sum : Number(task.quantity ?? 1) || 1
}

export function emptyProductLineRow(): TaskProductLineFormValues {
  return {
    mode: 'manual',
    unitType: 'adet',
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
    fireQty: 0,
    fireReason: '',
    fireImageDataUrl: '',
    qtyProduced: 0,
  }
}

export function mapApiProductLineToTask(ln: any): TaskProductLine {
  const mode = ln?.mode === 'fixed' ? 'fixed' : 'manual'
  return {
    mode,
    unitType: ln?.unit_type === 'metre' || ln?.unitType === 'metre' ? 'metre' : 'adet',
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
    fireQty:
      ln?.fire_qty != null
        ? Number(ln.fire_qty)
        : ln?.fireQty != null
          ? Number(ln.fireQty)
          : 0,
    fireReason:
      ln?.fire_reason != null && String(ln.fire_reason).trim() !== ''
        ? String(ln.fire_reason).trim()
        : ln?.fireReason != null && String(ln.fireReason).trim() !== ''
          ? String(ln.fireReason).trim()
          : undefined,
    fireImageDataUrl:
      ln?.fire_image_data_url != null && String(ln.fire_image_data_url).trim() !== ''
        ? String(ln.fire_image_data_url).trim()
        : ln?.fireImageDataUrl != null && String(ln.fireImageDataUrl).trim() !== ''
          ? String(ln.fireImageDataUrl).trim()
          : undefined,
    qtyProduced:
      ln?.qty_produced != null
        ? Number(ln.qty_produced)
        : ln?.qtyProduced != null
          ? Number(ln.qtyProduced)
          : undefined,
    workflowTeamIds: Array.isArray(ln?.workflow_team_ids)
      ? ln.workflow_team_ids.map((id: unknown) => String(id))
      : Array.isArray(ln?.workflowTeamIds)
        ? ln.workflowTeamIds.map((id: unknown) => String(id))
        : [],
    workflowStageTargets: Array.isArray(ln?.workflow_stage_targets)
      ? ln.workflow_stage_targets.map((x: unknown) => Number(x))
      : Array.isArray(ln?.workflowStageTargets)
        ? ln.workflowStageTargets.map((x: unknown) => Number(x))
        : [],
    workflowStageState: (ln?.workflow_stage_state || ln?.workflowStageState || {}) as Record<string, any>,
    currentTeamId:
      ln?.current_team_id != null && ln?.current_team_id !== ''
        ? String(ln.current_team_id)
        : ln?.currentTeamId != null && ln?.currentTeamId !== ''
          ? String(ln.currentTeamId)
          : undefined,
  }
}

export function taskProductLinesToApiPayload(lines: TaskProductLineFormValues[]): Record<string, unknown>[] {
  return lines.map((line) => ({
    mode: line.mode ?? 'manual',
    unit_type: line.unitType ?? 'adet',
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
    fire_qty: Math.max(0, Number((line as { fireQty?: unknown }).fireQty ?? 0)),
    fire_reason: String((line as { fireReason?: unknown }).fireReason ?? '').trim().slice(0, 300),
    fire_image_data_url: String((line as { fireImageDataUrl?: unknown }).fireImageDataUrl ?? '').trim(),
    qty_produced: Math.max(0, Number((line as { qtyProduced?: unknown }).qtyProduced ?? 0)),
    workflow_team_ids: ((line as { workflowTeamIds?: unknown[] }).workflowTeamIds || []).map((x) => Number(x)).filter((x) => !Number.isNaN(x)),
    workflow_stage_targets: ((line as { workflowStageTargets?: unknown[] }).workflowStageTargets || [])
      .map((x) => Number(x))
      .filter((x) => !Number.isNaN(x)),
  }))
}

export function initialProductLinesForForm(task?: Task): TaskProductLineFormValues[] {
  if (task?.productLines?.length) {
    return task.productLines.map((p) => ({
      mode: p.mode === 'fixed' ? 'fixed' : 'manual',
      unitType: p.unitType === 'metre' ? 'metre' : 'adet',
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
      fireQty: Number(p.fireQty ?? 0),
      fireReason: p.fireReason ?? '',
      fireImageDataUrl: p.fireImageDataUrl ?? '',
      qtyProduced: Number(p.qtyProduced ?? 0),
      workflowTeamIds: p.workflowTeamIds ?? [],
      workflowStageTargets: p.workflowStageTargets ?? [],
    }))
  }
  return [
    {
      mode: task?.mode === 'fixed' ? 'fixed' : 'manual',
      unitType: 'adet',
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
      fireQty: 0,
      fireReason: '',
      fireImageDataUrl: '',
      qtyProduced: 0,
      workflowTeamIds: [],
      workflowStageTargets: [],
    },
  ]
}
