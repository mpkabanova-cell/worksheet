import type { DifficultyMode, PlanItemDifficulty, PlanTask, TaskType } from './worksheet'

/** Механики агента планирования (spec). */
export type SpecMechanic =
  | 'input'
  | 'single_choice'
  | 'multiple_choice'
  | 'matching'
  | 'table'
  | 'ordering'
  | 'fill_gaps'

const SPEC_MECHANICS = new Set<string>([
  'input',
  'single_choice',
  'multiple_choice',
  'matching',
  'table',
  'ordering',
  'fill_gaps',
])

const EXTENDED_INPUT_RE =
  /разв[её]рнут|подробн|ход[а-яё]*\s+реш|обоснован|объяснен|построени|доказат|аргументац/i

/** Миграция старых черновиков: starter → medium. */
export function normalizeDifficultyMode(mode: string): DifficultyMode {
  if (mode === 'starter') return 'medium'
  if (mode === 'basic' || mode === 'medium' || mode === 'advanced' || mode === 'differentiated') {
    return mode
  }
  return 'differentiated'
}

export function normalizePlanItemDifficulty(
  raw: string | null | undefined,
): PlanItemDifficulty | null {
  const value = raw?.trim().toLowerCase()
  if (value === 'basic' || value === 'medium' || value === 'advanced') return value
  return null
}

export function planItemDifficultyLabel(d: PlanItemDifficulty): string {
  switch (d) {
    case 'basic':
      return 'Базовая'
    case 'medium':
      return 'Средняя'
    case 'advanced':
      return 'Повышенная'
  }
}

/** Internal task type → spec mechanic for planning agent. */
export function toSpecMechanic(taskType: TaskType): SpecMechanic | null {
  switch (taskType) {
    case 'short_answer':
    case 'extended_answer':
      return 'input'
    case 'grouping':
      return 'table'
    case 'single_choice':
    case 'multiple_choice':
    case 'matching':
    case 'ordering':
    case 'fill_gaps':
      return taskType
    default:
      return null
  }
}

/** Spec mechanic (+ optional description) → internal task type for UI/blocks. */
export function fromSpecMechanic(
  raw: string,
  description?: string | null,
  fallback: TaskType = 'short_answer',
): TaskType {
  const type = raw?.trim().toLowerCase()
  if (type === 'input') return resolveInputType(description)
  if (type === 'table') return 'grouping'
  if (
    type === 'single_choice' ||
    type === 'multiple_choice' ||
    type === 'matching' ||
    type === 'ordering' ||
    type === 'fill_gaps'
  ) {
    return type
  }
  if (type === 'short_answer' || type === 'extended_answer' || type === 'grouping') {
    return type as TaskType
  }
  return fallback
}

/** input → short_answer or extended_answer by description keywords. */
export function resolveInputType(description?: string | null): 'short_answer' | 'extended_answer' {
  if (description && EXTENDED_INPUT_RE.test(description)) return 'extended_answer'
  return 'short_answer'
}

export function isSpecMechanic(value: string): value is SpecMechanic {
  return SPEC_MECHANICS.has(value.trim().toLowerCase())
}

export const PLAN_SPEC_MECHANICS: { type: SpecMechanic; label: string }[] = [
  { type: 'input', label: 'Ввод ответа' },
  { type: 'single_choice', label: 'Один вариант ответа' },
  { type: 'multiple_choice', label: 'Несколько вариантов' },
  { type: 'fill_gaps', label: 'Заполнение пропусков' },
  { type: 'matching', label: 'Сопоставление' },
  { type: 'table', label: 'Группировка' },
  { type: 'ordering', label: 'Упорядочивание' },
]

export function labelForSpecMechanic(type: SpecMechanic): string {
  return PLAN_SPEC_MECHANICS.find((m) => m.type === type)?.label ?? type
}

/** Основная установка для генерации: description, иначе userDescription. */
export function planGenerationBrief(plan: PlanTask): string {
  return (plan.description?.trim() || plan.userDescription?.trim() || '').slice(0, 2000)
}

export function planDifficultyToStars(
  planDifficulty: PlanItemDifficulty | null | undefined,
  sheetMode: DifficultyMode,
  index: number,
  total: number,
): 1 | 2 | 3 {
  if (planDifficulty) {
    switch (planDifficulty) {
      case 'basic':
        return 1
      case 'medium':
        return 2
      case 'advanced':
        return 3
    }
  }

  const mode = normalizeDifficultyMode(sheetMode)
  if (mode === 'basic') return 1
  if (mode === 'medium') return 2
  if (mode === 'advanced') return 3

  const t = Math.max(total - 1, 1)
  if (index / t < 0.34) return 1
  if (index / t < 0.67) return 2
  return 3
}

export function sheetModeToDefaultPlanDifficulty(mode: DifficultyMode): PlanItemDifficulty {
  const normalized = normalizeDifficultyMode(mode)
  if (normalized === 'basic') return 'basic'
  if (normalized === 'medium') return 'medium'
  if (normalized === 'advanced') return 'advanced'
  return 'medium'
}
