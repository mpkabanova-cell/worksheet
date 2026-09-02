import type { PlanTask, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { PLAN_TASK_TYPES, createPlan, uid } from './worksheet'
import { chatJson, AiError, isAiUnavailable } from './aiClient'
import {
  generateWorksheet as mockGenerate,
  generateSingleTask as mockSingle,
} from './generator'
import { promptsForPlan, promptsForSingleTask, promptsForWorksheet } from './aiPrompts'
import { sanitizeBlock } from './blockUtils'
import { normalizeAiTask } from './taskContent'

export type GenerateMode = 'create' | 'regenerate'

interface AiTaskPayload {
  type: TaskType
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
}

interface AiWorksheetPayload {
  title?: string
  intro?: string
  tasks: AiTaskPayload[]
}

interface AiPlanPayload {
  tasks: { type: string; expectation?: string }[]
}

const ALLOWED_PLAN_TYPES = new Set(PLAN_TASK_TYPES.map((t) => t.type))

function stars(i: number, total: number, mode: WorksheetDraft['difficulty']): 1 | 2 | 3 {
  if (mode === 'starter') return 1
  if (mode === 'basic') return 2
  if (mode === 'advanced') return 3
  const t = Math.max(total - 1, 1)
  if (i / t < 0.34) return 1
  if (i / t < 0.67) return 2
  return 3
}

function normalizeType(raw: string, fallback: TaskType = 'short_answer'): TaskType {
  const value = raw?.trim() as TaskType
  if (ALLOWED_PLAN_TYPES.has(value)) return value
  const byLabel = PLAN_TASK_TYPES.find(
    (t) => t.label.toLowerCase() === raw?.trim().toLowerCase(),
  )
  return byLabel?.type ?? fallback
}

function toBlock(
  task: AiTaskPayload,
  index: number,
  draft: WorksheetDraft,
  planExpectation?: string,
): WorksheetBlock {
  const type = normalizeType(task.type)
  const normalized = normalizeAiTask(task, type, planExpectation)
  const options = (task.options ?? []).map((text, i) => ({
    id: `option_${i + 1}`,
    text,
  }))
  const leftItems = task.left_items?.map((text, i) => ({ id: `left_${i + 1}`, text }))
  const rightItems = task.right_items?.map((text, i) => ({ id: `right_${i + 1}`, text }))
  let correctAnswers = task.correct_answers
  if (
    type === 'matching' &&
    leftItems?.length &&
    rightItems?.length &&
    (!correctAnswers?.length || correctAnswers.every((answer) => !answer.trim()))
  ) {
    correctAnswers = leftItems.map(
      (left, i) => `${left.text} → ${rightItems[i]?.text ?? ''}`.trim(),
    )
  }
  return sanitizeBlock({
    id: uid('task'),
    type,
    page: 0,
    title: `Задание ${index + 1}`,
    instruction: '',
    question: normalized.question,
    body: task.body,
    options: options.length ? options : undefined,
    correctOptionId:
      typeof task.correct_option_index === 'number'
        ? `option_${task.correct_option_index + 1}`
        : undefined,
    correctOptionIds: task.correct_option_indexes?.map((i) => `option_${i + 1}`),
    correctAnswers,
    answerLines: task.answer_lines,
    gapsText: normalized.gaps_text,
    gapsAnswers: task.gaps_answers,
    leftItems,
    rightItems,
    groups: task.groups?.map((g, i) => ({
      id: `g${i + 1}`,
      title: g.title,
      items: Array.isArray(g.items) ? g.items : [],
    })),
    orderItems: task.order_items,
    difficulty: task.difficulty ?? stars(index, draft.taskCount, draft.difficulty),
  })
}

function ensurePlan(draft: WorksheetDraft): PlanTask[] {
  const count = Math.min(15, Math.max(1, draft.taskCount || draft.plan.length || 5))
  if (draft.plan.length === count) return draft.plan
  if (draft.plan.length > count) return draft.plan.slice(0, count)

  const types = draft.plan.map((p) => p.taskType)
  const padded: PlanTask[] = [...draft.plan]
  while (padded.length < count) {
    const type = types[padded.length % Math.max(types.length, 1)] ?? 'short_answer'
    padded.push({
      id: `plan-${Date.now()}-${padded.length}`,
      taskType: type,
      userExpectation: '',
    })
  }
  return padded
}

export async function generatePlanAI(draft: WorksheetDraft): Promise<PlanTask[]> {
  try {
    const { system, user } = promptsForPlan(draft)
    const payload = await chatJson<AiPlanPayload>(system, user, { temperature: 0.55 })
    const rows = (payload.tasks ?? []).slice(0, draft.taskCount)

    if (!rows.length) throw new AiError('Модель не вернула план заданий')

    const plan: PlanTask[] = rows.map((row, i) => ({
      id: `plan-${Date.now()}-${i}`,
      taskType: normalizeType(row.type),
      userExpectation: (row.expectation || '').slice(0, 200),
    }))

    while (plan.length < draft.taskCount) {
      plan.push({
        id: `plan-${Date.now()}-${plan.length}`,
        taskType: 'short_answer',
        userExpectation: '',
      })
    }

    return plan
  } catch (err) {
    if (isAiUnavailable(err)) return createPlan(draft.taskCount)
    throw err
  }
}

export async function generateWorksheetAI(
  draft: WorksheetDraft,
  mode: GenerateMode = 'create',
): Promise<WorksheetDraft> {
  const plan = ensurePlan(draft)
  const prepared = { ...draft, plan, taskCount: plan.length }

  try {
    const { system, user } = promptsForWorksheet(prepared, mode)
    const payload = await chatJson<AiWorksheetPayload>(system, user, {
      temperature: mode === 'regenerate' ? 0.7 : 0.45,
    })

    const tasks = (payload.tasks ?? []).slice(0, prepared.taskCount)
    if (!tasks.length) throw new AiError('Модель не вернула задания')

    const aligned = tasks.map((t, i) => ({
      ...t,
      type: plan[i]?.taskType ?? normalizeType(t.type),
    }))

    while (aligned.length < prepared.taskCount) {
      const i = aligned.length
      aligned.push({
        type: plan[i]?.taskType ?? 'short_answer',
        instruction: '',
        question: plan[i]?.userExpectation || `Задание по теме «${draft.topic}»`,
        difficulty: stars(i, prepared.taskCount, draft.difficulty),
      })
    }

    const blocks = aligned.map((t, i) => toBlock(t, i, prepared, plan[i]?.userExpectation))

    return {
      ...prepared,
      title: payload.title || draft.topic || draft.title,
      intro: draft.addIntro ? payload.intro || draft.intro : '',
      blocks,
      pages: 1,
      savedAt: undefined,
    }
  } catch (err) {
    if (isAiUnavailable(err)) return mockGenerate(prepared)
    throw err
  }
}

export async function generateSingleTaskAI(
  draft: WorksheetDraft,
  taskType: TaskType,
  expectation = '',
): Promise<WorksheetBlock> {
  try {
    const { system, user } = promptsForSingleTask(draft, taskType, expectation)
    const payload = await chatJson<{ task: AiTaskPayload }>(system, user, { temperature: 0.55 })

    if (!payload.task) throw new AiError('Модель не вернула задание')

    const index = draft.blocks.filter((b) => b.type !== 'page_break' && b.type !== 'text').length
    return toBlock({ ...payload.task, type: taskType }, index, draft, expectation)
  } catch (err) {
    if (isAiUnavailable(err)) return mockSingle(draft, taskType, expectation)
    throw err
  }
}

export { AiError }
