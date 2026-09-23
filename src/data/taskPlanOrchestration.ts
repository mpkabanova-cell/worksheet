import type { DifficultyMode, PlanItemDifficulty, PlanTask, WorksheetDraft } from './worksheet'
import { sourceContentForDraft } from './contextFile'
import { normalizeDifficultyMode, defaultSpecMechanicForPlanIndex, type SpecMechanic } from './planMechanics'

export interface SpecTaskPlanRow {
  type: SpecMechanic | null
  user_description: string | null
  description: string | null
  difficulty: PlanItemDifficulty | null
}

export interface GenerationGlobals {
  subject: string
  grade: string
  topic: string
  difficulty: DifficultyMode
  additional_wishes: string | null
  source_content: string | null
}

export interface GenerationBaseline extends GenerationGlobals {
  task_plan: SpecTaskPlanRow[]
}

export function planRowToSpec(row: PlanTask): SpecTaskPlanRow {
  return {
    type: row.type ?? null,
    user_description: row.userDescription?.trim() || null,
    description: row.description?.trim() || null,
    difficulty: row.difficulty ?? null,
  }
}

export function specRowToPlan(row: SpecTaskPlanRow, existing?: PlanTask): PlanTask {
  return {
    id: existing?.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: row.type,
    userDescription: row.user_description ?? '',
    description: row.description,
    difficulty: row.difficulty,
  }
}

export function createEmptyPlanRow(index = 0): PlanTask {
  return {
    id: `plan-${Date.now()}-${index}`,
    type: defaultSpecMechanicForPlanIndex(index),
    userDescription: '',
    description: null,
    difficulty: null,
  }
}

export function resizePlanToTaskCount(plan: PlanTask[], taskCount: number): PlanTask[] {
  const count = Math.min(20, Math.max(1, taskCount || 1))
  if (plan.length === count) return plan
  if (plan.length > count) return plan.slice(0, count)
  const appended = Array.from({ length: count - plan.length }, (_, i) =>
    createEmptyPlanRow(plan.length + i),
  )
  return [...plan, ...appended]
}

export function extractGenerationGlobals(draft: WorksheetDraft): GenerationGlobals {
  return {
    subject: draft.subject,
    grade: draft.grade,
    topic: draft.topic,
    difficulty: normalizeDifficultyMode(draft.difficulty),
    additional_wishes: draft.additionalWishes?.trim() || null,
    source_content: sourceContentForDraft(draft),
  }
}

function globalsChanged(current: GenerationGlobals, baseline: GenerationGlobals): boolean {
  return (
    current.subject !== baseline.subject ||
    current.grade !== baseline.grade ||
    current.topic !== baseline.topic ||
    current.difficulty !== baseline.difficulty ||
    current.additional_wishes !== baseline.additional_wishes ||
    current.source_content !== baseline.source_content
  )
}

export function invalidateDescriptions(
  plan: PlanTask[],
  baseline: GenerationBaseline | null | undefined,
  globals: GenerationGlobals,
): PlanTask[] {
  if (!baseline) return plan

  const baselineGlobals: GenerationGlobals = {
    subject: baseline.subject,
    grade: baseline.grade,
    topic: baseline.topic,
    difficulty: baseline.difficulty,
    additional_wishes: baseline.additional_wishes,
    source_content: baseline.source_content,
  }

  if (globalsChanged(globals, baselineGlobals)) {
    return plan.map((row) => ({ ...row, description: null }))
  }

  return plan.map((row, index) => {
    const baselineRow = baseline.task_plan[index]
    if (!baselineRow) {
      return { ...row, description: null }
    }

    const current = planRowToSpec(row)
    const typeChanged = current.type !== baselineRow.type
    const userChanged =
      (current.user_description ?? '') !== (baselineRow.user_description ?? '')

    if (typeChanged || userChanged) {
      return { ...row, description: null }
    }

    return row
  })
}

export function planNeedsPlanner(plan: PlanTask[]): boolean {
  return plan.some((row) => !row.description?.trim())
}

export function saveGenerationBaseline(draft: WorksheetDraft, plan: PlanTask[]): GenerationBaseline {
  return {
    ...extractGenerationGlobals(draft),
    task_plan: plan.map(planRowToSpec),
  }
}

export function preparePlanForGeneration(draft: WorksheetDraft): {
  plan: PlanTask[]
  globals: GenerationGlobals
  needsPlanner: boolean
} {
  const globals = extractGenerationGlobals(draft)
  const resized = resizePlanToTaskCount(draft.taskPlan, draft.taskCount)
  const plan = invalidateDescriptions(resized, draft.generationBaseline, globals)
  return {
    plan,
    globals,
    needsPlanner: planNeedsPlanner(plan),
  }
}

export function withGenerationBaseline(
  draft: WorksheetDraft,
  plan: PlanTask[],
): WorksheetDraft {
  return {
    ...draft,
    taskPlan: plan,
    generationBaseline: saveGenerationBaseline(draft, plan),
  }
}
