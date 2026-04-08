import { z } from 'zod'

export const taskProductLineSchema = z.object({
  mode: z.enum(['manual', 'fixed']).default('manual'),
  modelCode: z.string().optional(),
  variant: z.string().optional(),
  quantity: z.preprocess((v) => (v === '' || v === undefined ? 1 : Number(v)), z.number().min(1, 'Adet >=1 olmalı')),
  modelDurationMinutes: z.preprocess(
    (v) => (v === '' || v === undefined ? 0 : Number(v)),
    z.number().min(0, '>=0 olmalı')
  ),
  totalPlannedMinutes: z.preprocess(
    (v) => (v === '' || v === undefined ? 0 : Number(v)),
    z.number().min(0, '>=0 olmalı')
  ),
  modelBladeDepth: z.string().optional(),
  modelSizes: z.array(z.string()).optional(),
  productColor: z.string().optional(),
  productColorCode: z.string().optional(),
  briefIntro: z.string().max(600, 'Tanıtım en fazla 600 karakter').optional(),
})

export type TaskProductLineFormValues = z.infer<typeof taskProductLineSchema>
