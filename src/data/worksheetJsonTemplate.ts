import type { PlanTask } from './worksheet'
import { fromSpecMechanic, planGenerationBrief, type SpecMechanic } from './planMechanics'

export interface WorksheetTemplateTask {
  type: SpecMechanic | string
  instruction?: string
  question?: string
  body?: string
  options?: string[]
  correct_option_index?: number | null
  correct_option_indexes?: number[]
  correct_answers?: string[]
  answer_lines?: number | null
  gaps_text?: string
  gaps_answers?: string[]
  left_items?: string[]
  right_items?: string[]
  groups?: { title: string; items: string[] }[]
  order_items?: string[]
  difficulty?: number | null
}

export interface WorksheetJsonTemplate {
  title: string
  intro: string
  tasks: WorksheetTemplateTask[]
}

function emptyTaskTemplate(specType: SpecMechanic | null, planItem?: PlanTask): WorksheetTemplateTask {
  const resolvedType = specType ?? planItem?.type ?? 'input'
  const base: WorksheetTemplateTask = {
    type: resolvedType,
    instruction: '',
    question: '',
    difficulty: null,
  }

  switch (resolvedType) {
    case 'input':
      return { ...base, answer_lines: null, correct_answers: [] }
    case 'single_choice':
      return {
        ...base,
        options: ['', '', '', ''],
        correct_option_index: null,
        correct_answers: [],
      }
    case 'multiple_choice':
      return {
        ...base,
        options: ['', '', '', ''],
        correct_option_indexes: [],
        correct_answers: [],
      }
    case 'fill_gaps':
      return { ...base, gaps_text: '', gaps_answers: [] }
    case 'matching':
      return { ...base, left_items: [], right_items: [], correct_answers: [] }
    case 'table':
      return {
        ...base,
        groups: [
          { title: '', items: [] },
          { title: '', items: [] },
        ],
        correct_answers: [],
      }
    case 'ordering':
      return { ...base, order_items: [], correct_answers: [] }
    default:
      return { ...base, correct_answers: [] }
  }
}

export function buildWorksheetJsonTemplate(plan: PlanTask[], showIntro: boolean): WorksheetJsonTemplate {
  return {
    title: '',
    intro: showIntro ? '' : '',
    tasks: plan.map((row) => emptyTaskTemplate(planRowSpecType(row), row)),
  }
}

function planRowSpecType(row: PlanTask): SpecMechanic | null {
  return row.type ?? null
}

const SPEC_MECHANIC_ENUM = [
  'input',
  'single_choice',
  'multiple_choice',
  'matching',
  'table',
  'ordering',
  'fill_gaps',
] as const

function taskSchemaForType(type: SpecMechanic | string): Record<string, unknown> {
  const common = {
    type: { type: 'string', enum: SPEC_MECHANIC_ENUM },
    instruction: { type: 'string' },
    question: { type: 'string', maxLength: 2000 },
    difficulty: { type: ['integer', 'null'], enum: [1, 2, 3, null] },
  }

  switch (type) {
    case 'input':
      return {
        type: 'object',
        required: ['type', 'instruction', 'question', 'correct_answers', 'difficulty'],
        properties: {
          ...common,
          answer_lines: { type: ['integer', 'null'], minimum: 5, maximum: 20 },
          correct_answers: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      }
    case 'single_choice':
      return {
        type: 'object',
        required: [
          'type',
          'instruction',
          'question',
          'options',
          'correct_option_index',
          'correct_answers',
          'difficulty',
        ],
        properties: {
          ...common,
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          correct_option_index: { type: ['integer', 'null'], minimum: 0, maximum: 3 },
          correct_answers: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      }
    case 'multiple_choice':
      return {
        type: 'object',
        required: [
          'type',
          'instruction',
          'question',
          'options',
          'correct_option_indexes',
          'correct_answers',
          'difficulty',
        ],
        properties: {
          ...common,
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          correct_option_indexes: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 3 },
            minItems: 1,
          },
          correct_answers: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      }
    case 'fill_gaps':
      return {
        type: 'object',
        required: ['type', 'instruction', 'question', 'gaps_text', 'gaps_answers', 'difficulty'],
        properties: {
          ...common,
          gaps_text: { type: 'string', minLength: 1 },
          gaps_answers: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      }
    case 'matching':
      return {
        type: 'object',
        required: [
          'type',
          'instruction',
          'question',
          'left_items',
          'right_items',
          'correct_answers',
          'difficulty',
        ],
        properties: {
          ...common,
          left_items: { type: 'array', items: { type: 'string' }, minItems: 2 },
          right_items: { type: 'array', items: { type: 'string' }, minItems: 2 },
          correct_answers: { type: 'array', items: { type: 'string' }, minItems: 2 },
        },
      }
    case 'table':
      return {
        type: 'object',
        required: ['type', 'instruction', 'question', 'groups', 'difficulty'],
        properties: {
          ...common,
          groups: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: {
              type: 'object',
              required: ['title', 'items'],
              properties: {
                title: { type: 'string' },
                items: { type: 'array', items: { type: 'string' }, minItems: 1 },
              },
            },
          },
        },
      }
    case 'ordering':
      return {
        type: 'object',
        required: ['type', 'instruction', 'question', 'order_items', 'correct_answers', 'difficulty'],
        properties: {
          ...common,
          order_items: { type: 'array', items: { type: 'string' }, minItems: 2 },
          correct_answers: { type: 'array', items: { type: 'string' }, minItems: 2 },
        },
      }
    default:
      return {
        type: 'object',
        required: ['type', 'instruction', 'question', 'difficulty'],
        properties: common,
      }
  }
}

export function buildWorksheetJsonSchema(plan: PlanTask[], showIntro: boolean): Record<string, unknown> {
  const taskSchemas = plan.map((row) => {
    const specType = planRowSpecType(row) ?? 'input'
    return taskSchemaForType(specType)
  })

  return {
    type: 'object',
    required: showIntro ? ['title', 'intro', 'tasks'] : ['title', 'tasks'],
    properties: {
      title: { type: 'string', maxLength: 200 },
      intro: { type: 'string' },
      tasks: {
        type: 'array',
        minItems: plan.length,
        maxItems: plan.length,
        items: taskSchemas.length === 1 ? taskSchemas[0] : { oneOf: taskSchemas },
      },
    },
  }
}

/** Map filled template task → internal AiTaskPayload shape for block conversion. */
export function templateTaskToAiPayload(
  task: WorksheetTemplateTask,
  planItem?: PlanTask,
): {
  type: string
  instruction?: string
  question?: string
  body?: string
  options?: string[]
  correct_option_index?: number
  correct_option_indexes?: number[]
  correct_answers?: string[]
  answer_lines?: number
  gaps_text?: string
  gaps_answers?: string[]
  left_items?: string[]
  right_items?: string[]
  groups?: { title: string; items: string[] }[]
  order_items?: string[]
  difficulty?: 1 | 2 | 3
} {
  const specType = String(task.type || planRowSpecType(planItem ?? ({} as PlanTask)) || 'input')
  const internalType = fromSpecMechanic(
    specType,
    planItem?.description ?? task.question,
    planItem?.type ? fromSpecMechanic(planItem.type, planItem.description) : 'short_answer',
  )

  return {
    type: internalType,
    instruction: task.instruction ?? '',
    question: task.question,
    body: task.body,
    options: task.options,
    correct_option_index:
      typeof task.correct_option_index === 'number' ? task.correct_option_index : undefined,
    correct_option_indexes: task.correct_option_indexes,
    correct_answers: task.correct_answers,
    answer_lines: task.answer_lines ?? undefined,
    gaps_text: task.gaps_text,
    gaps_answers: task.gaps_answers,
    left_items: task.left_items,
    right_items: task.right_items,
    groups: task.groups,
    order_items: task.order_items,
    difficulty:
      task.difficulty === 1 || task.difficulty === 2 || task.difficulty === 3
        ? task.difficulty
        : undefined,
  }
}

export function templateBriefForIndependence(task: WorksheetTemplateTask, planItem?: PlanTask): string {
  return (task.question?.trim() || planGenerationBrief(planItem ?? ({} as PlanTask))).slice(0, 2000)
}
