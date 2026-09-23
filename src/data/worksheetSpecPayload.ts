import type { DifficultyMode, WorksheetDraft } from './worksheet'
import { ADDITIONAL_WISHES_MAX_LENGTH } from './worksheet'
import { sourceContentForDraft } from './contextFile'
import { normalizeDifficultyMode } from './planMechanics'
import { planRowToSpec, type SpecTaskPlanRow } from './taskPlanOrchestration'
import {
  buildWorksheetJsonSchema,
  buildWorksheetJsonTemplate,
} from './worksheetJsonTemplate'

export interface Agent1Input {
  subject: string
  grade: number | null
  topic: string
  task_count: number
  difficulty: DifficultyMode
  additional_wishes: string | null
  source_content: string | null
  task_plan: SpecTaskPlanRow[]
}

export interface Agent2Input extends Agent1Input {
  show_intro: boolean
  generated_json_template: ReturnType<typeof buildWorksheetJsonTemplate>
  generated_json_schema: Record<string, unknown>
}

export function gradeForAgent(draft: WorksheetDraft): number | null {
  const parsed = Number.parseInt(draft.grade, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 11) return null
  return parsed
}

export function taskPlanForAgent(draft: WorksheetDraft): SpecTaskPlanRow[] {
  return draft.taskPlan.map(planRowToSpec)
}

export function agent1UserPayload(draft: WorksheetDraft): Agent1Input {
  return {
    subject: draft.subject,
    grade: gradeForAgent(draft),
    topic: draft.topic,
    task_count: draft.taskCount,
    difficulty: normalizeDifficultyMode(draft.difficulty),
    additional_wishes: draft.additionalWishes?.trim().slice(0, ADDITIONAL_WISHES_MAX_LENGTH) || null,
    source_content: sourceContentForDraft(draft),
    task_plan: taskPlanForAgent(draft),
  }
}

export function agent2UserPayload(
  draft: WorksheetDraft,
  extras?: {
    previous_tasks?: unknown
    anchor_tasks?: unknown
    alternative_task_guidance?: unknown
  },
): Agent2Input & Record<string, unknown> {
  const template = buildWorksheetJsonTemplate(draft.taskPlan, draft.showIntro)
  const schema = buildWorksheetJsonSchema(draft.taskPlan, draft.showIntro)

  return {
    ...agent1UserPayload(draft),
    show_intro: draft.showIntro,
    task_plan: taskPlanForAgent(draft),
    generated_json_template: template,
    generated_json_schema: schema,
    ...(extras?.previous_tasks ? { previous_tasks: extras.previous_tasks } : {}),
    ...(extras?.anchor_tasks ? { anchor_tasks: extras.anchor_tasks } : {}),
    ...(extras?.alternative_task_guidance
      ? { alternative_task_guidance: extras.alternative_task_guidance }
      : {}),
  }
}
