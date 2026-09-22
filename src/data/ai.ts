import type { PlanTask, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { PLAN_TASK_TYPES, createPlan, uid } from './worksheet'
import { chatJson, AiError, isAiUnavailable } from './aiClient'
import {
  generateWorksheet as mockGenerate,
  generateSingleTask as mockSingle,
} from './generator'
import { promptsForPlan, promptsForSingleTask, promptsForWorksheet } from './aiPrompts'
import { sanitizeBlock, clampAnswerHeight, defaultAnswerHeight, defaultAnswerStyle, groupsToTableFields, createDefaultGroupingTableFields, getGapsSourceText } from './blockUtils'
import { normalizeAiTask } from './taskContent'
import { repairJsonLatexEscapes } from './mathTextUtils'
import {
  independenceRetryNote,
  repairTaskExpectation,
  taskQuestionIssues,
  validatePlanIndependence,
  validateTaskIndependence,
} from './taskIndependence'
import { listContextBlockTitles } from './contextFilter'
import { referenceFilePayload } from './contextFile'
import { enrichBlockFromReference } from './referenceEnrich'
import {
  buildFillGapsFallbackBlock,
  collectAnchorTasks,
} from './referenceThemes'

function sanitizeAiText(text: string | undefined): string {
  if (!text) return ''
  return repairJsonLatexEscapes(text)
}

export type GenerateMode = 'create' | 'regenerate'

export interface AiTaskPayload {
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

function fallbackPlanExpectation(draft: WorksheetDraft, index: number, blockHint?: string): string {
  if (blockHint) {
    return `Составить задание по материалу «${blockHint}» из reference_file`
  }
  const topic = draft.topic.trim() || 'тема'
  const variants = [
    `Решить задачу по теме «${topic}» на основе reference_file`,
    `Выбрать верный ответ по материалу reference_file`,
    `Заполнить пропуски по условию из reference_file`,
    `Упорядочить элементы по задаче из reference_file`,
    `Объяснить ход решения задачи из reference_file`,
  ]
  return variants[index % variants.length]
}

function documentBlockHints(draft: WorksheetDraft): string[] {
  const ref = referenceFilePayload(draft)
  if (!ref?.content && !draft.contextFileText?.trim()) return []
  const raw = draft.contextFileText ?? ref?.content ?? ''
  const titles = listContextBlockTitles(raw)
  const gradeBlocks = titles.filter((t) => /\d+\s*[-–—]\s*\d+\s*класс/i.test(t))
  if (gradeBlocks.length) return gradeBlocks
  return titles.slice(0, 8)
}

function fallbackDocumentPlan(draft: WorksheetDraft): PlanTask[] {
  const blocks = documentBlockHints(draft)
  const types: TaskType[] = [
    'short_answer',
    'single_choice',
    'fill_gaps',
    'ordering',
    'extended_answer',
  ]
  const count = Math.min(15, Math.max(1, draft.taskCount || 5))
  return Array.from({ length: count }, (_, i) => ({
    id: `plan-${Date.now()}-${i}`,
    taskType: types[i % types.length],
    userExpectation: fallbackPlanExpectation(draft, i, blocks[i % Math.max(blocks.length, 1)]),
  }))
}

function padPlanToCount(plan: PlanTask[], draft: WorksheetDraft): PlanTask[] {
  const types = plan.map((p) => p.taskType)
  const padded = [...plan]
  while (padded.length < draft.taskCount) {
    const i = padded.length
    padded.push({
      id: `plan-${Date.now()}-${i}`,
      taskType: types[i % Math.max(types.length, 1)] ?? 'short_answer',
      userExpectation: fallbackPlanExpectation(draft, i),
    })
  }
  return padded
}

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
    text: sanitizeAiText(text),
  }))
  const leftItemsRaw = task.left_items?.map((text, i) => ({ id: `left_${i + 1}`, text: sanitizeAiText(text) }))
  const rightItemsRaw = task.right_items?.map((text, i) => ({ id: `right_${i + 1}`, text: sanitizeAiText(text) }))
  const matchingPairCount =
    type === 'matching' && leftItemsRaw?.length && rightItemsRaw?.length
      ? Math.min(leftItemsRaw.length, rightItemsRaw.length)
      : undefined
  const leftItems =
    type === 'matching' && leftItemsRaw && matchingPairCount
      ? leftItemsRaw.slice(0, matchingPairCount)
      : leftItemsRaw
  const rightItems =
    type === 'matching' && rightItemsRaw && matchingPairCount
      ? rightItemsRaw.slice(0, matchingPairCount)
      : rightItemsRaw
  let correctAnswers = task.correct_answers?.map(sanitizeAiText)
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
  const subject = draft.subject || ''
  const answerStyle = defaultAnswerStyle(subject)
  const answerLines =
    type === 'short_answer' || type === 'extended_answer'
      ? clampAnswerHeight(
          answerStyle,
          task.answer_lines ?? defaultAnswerHeight(answerStyle),
        )
      : task.answer_lines
  const question = sanitizeAiText(normalized.question)?.trim() ?? ''
  return sanitizeBlock({
    id: uid('task'),
    type,
    page: 0,
    title: `Задание ${index + 1}`,
    instruction: '',
    question,
    body: task.body ? sanitizeAiText(task.body) : task.body,
    options: options.length ? options : undefined,
    correctOptionId:
      typeof task.correct_option_index === 'number'
        ? `option_${task.correct_option_index + 1}`
        : undefined,
    correctOptionIds: task.correct_option_indexes?.map((i) => `option_${i + 1}`),
    correctAnswers,
    answerLines,
    answerAreaStyle:
      type === 'short_answer' || type === 'extended_answer' ? answerStyle : undefined,
    gapsText: normalized.gaps_text ? sanitizeAiText(normalized.gaps_text) : normalized.gaps_text,
    gapsAnswers: task.gaps_answers?.map(sanitizeAiText),
    leftItems,
    rightItems,
    matchingPairCount,
    ...(type === 'grouping' && task.groups?.length
      ? groupsToTableFields(
          task.groups.map((g) => ({
            title: sanitizeAiText(g.title),
            items: Array.isArray(g.items) ? g.items.map(sanitizeAiText) : [],
          })),
        )
      : type === 'grouping'
        ? createDefaultGroupingTableFields()
        : {}),
    orderItems: task.order_items?.map(sanitizeAiText),
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
    const i = padded.length
    const type = types[i % Math.max(types.length, 1)] ?? 'short_answer'
    padded.push({
      id: `plan-${Date.now()}-${i}`,
      taskType: type,
      userExpectation: fallbackPlanExpectation(draft, i),
    })
  }
  return padded
}

export async function generatePlanAI(draft: WorksheetDraft): Promise<PlanTask[]> {
  try {
    const { system, user } = promptsForPlan(draft)
    let payload = await chatJson<AiPlanPayload>(system, user, { temperature: 0.55 })
    let rows = (payload.tasks ?? []).slice(0, draft.taskCount)

    for (let attempt = 0; attempt < 2; attempt++) {
      const planIssues = validatePlanIndependence(rows)
      if (!planIssues.length) break
      payload = await chatJson<AiPlanPayload>(
        system,
        user + independenceRetryNote(planIssues),
        { temperature: 0.45 + attempt * 0.1 },
      )
      rows = (payload.tasks ?? []).slice(0, draft.taskCount)
    }

    if (validatePlanIndependence(rows).length) {
      const blocks = documentBlockHints(draft)
      if (blocks.length || draft.contextFileText?.trim()) {
        return fallbackDocumentPlan(draft)
      }
    }

    if (!rows.length) throw new AiError('Модель не вернула план заданий')

    const plan: PlanTask[] = rows.map((row, i) => ({
      id: `plan-${Date.now()}-${i}`,
      taskType: normalizeType(row.type),
      userExpectation: (row.expectation || '').slice(0, 200),
    }))

    return padPlanToCount(plan, draft)
  } catch (err) {
    if (isAiUnavailable(err)) return createPlan(draft.taskCount)
    throw err
  }
}

function blockNeedsRepair(
  block: WorksheetBlock,
  planExpectation?: string,
): boolean {
  return taskQuestionIssues(
    {
      type: block.type,
      question: block.question,
      gaps_text: getGapsSourceText(block),
      options: block.options?.map((o) => o.text),
      left_items: block.leftItems?.map((i) => i.text),
      right_items: block.rightItems?.map((i) => i.text),
    },
    planExpectation,
  ).length > 0
}

export async function generateWorksheetAI(
  draft: WorksheetDraft,
  mode: GenerateMode = 'create',
): Promise<WorksheetDraft> {
  const plan = ensurePlan(draft)
  const prepared = { ...draft, plan, taskCount: plan.length }

  try {
    const { system, user } = promptsForWorksheet(prepared, mode)
    let payload = await chatJson<AiWorksheetPayload>(system, user, {
      temperature: mode === 'regenerate' ? 0.7 : 0.45,
    })

    let tasks = (payload.tasks ?? []).slice(0, prepared.taskCount)
    const planExpectations = plan.map((p) => p.userExpectation)
    for (let attempt = 0; attempt < 2; attempt++) {
      const taskIssues = validateTaskIndependence(tasks, planExpectations)
      if (!taskIssues.length) break
      payload = await chatJson<AiWorksheetPayload>(
        system,
        user + independenceRetryNote(taskIssues),
        { temperature: 0.45 + attempt * 0.1 },
      )
      tasks = (payload.tasks ?? []).slice(0, prepared.taskCount)
    }

    if (validateTaskIndependence(tasks, planExpectations).length && referenceFilePayload(prepared)?.content) {
      payload = await chatJson<AiWorksheetPayload>(
        system,
        user +
          '\n\nКаждое question — полное условие для ученика: текст задачи из reference_file (все данные и числа) + вопрос. Не копируй teacher_expectation («Определить…», «Выберите…» без условия). Не используй готовые решения из файла.',
        { temperature: 0.55 },
      )
      tasks = (payload.tasks ?? []).slice(0, prepared.taskCount)
    }

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
        question:
          plan[i]?.userExpectation ||
          fallbackPlanExpectation(prepared, i) ||
          `Задание по теме «${draft.topic}»`,
        difficulty: stars(i, prepared.taskCount, draft.difficulty),
      })
    }

    const blocks = aligned.map((t, i) => toBlock(t, i, prepared, plan[i]?.userExpectation))
    const planExpectationsForBlocks = blocks.map(
      (_, i) => plan[i]?.userExpectation || fallbackPlanExpectation(prepared, i),
    )

    for (let i = 0; i < blocks.length; i++) {
      const expectation = planExpectationsForBlocks[i]
      const anchorTasks = collectAnchorTasks(blocks, planExpectationsForBlocks, {
        skipBlockIndex: i,
      })
      let attempts = 0
      while (blockNeedsRepair(blocks[i], expectation) && attempts < 3) {
        try {
          blocks[i] = await generateSingleTaskAI(
            prepared,
            plan[i]?.taskType ?? blocks[i].type,
            expectation,
            repairTaskExpectation(expectation),
            anchorTasks,
          )
        } catch {
          break
        }
        attempts += 1
      }
    }

    const refContent = referenceFilePayload(prepared)?.content
    if (refContent) {
      for (let i = 0; i < blocks.length; i++) {
        blocks[i] = enrichBlockFromReference(
          blocks[i],
          refContent,
          planExpectationsForBlocks[i],
        )
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].type !== 'fill_gaps') continue
      if (getGapsSourceText(blocks[i]).includes('___')) continue
      if (refContent) {
        blocks[i] = buildFillGapsFallbackBlock(
          blocks[i],
          refContent,
          planExpectationsForBlocks[i],
          collectAnchorTasks(blocks, planExpectationsForBlocks, { skipBlockIndex: i }),
        )
        continue
      }
      blocks[i] = {
        ...blocks[i],
        question: 'Заполните пропуски в условии задачи.',
        gapsText:
          'Один мастер изготавливает деталь за ___ минут, а ученик — за ___ минут. За 2 часа они вместе изготовили ___ деталей.',
        gapsAnswers: ['12', '20', '15'],
      }
    }

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
  repairNote?: string,
  anchorTasks?: ReturnType<typeof collectAnchorTasks>,
): Promise<WorksheetBlock> {
  try {
    const { system, user } = promptsForSingleTask(
      draft,
      taskType,
      expectation,
      repairNote,
      anchorTasks,
    )
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
