import type { PlanTask, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { createPlan, uid } from './worksheet'
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
import { enrichBlockFromReference, trimReferenceDumpFromBlock } from './referenceEnrich'
import {
  buildFillGapsFallbackBlock,
  collectAnchorTasks,
} from './referenceThemes'
import {
  fromSpecMechanic,
  normalizePlanItemDifficulty,
  planDifficultyToStars,
  planGenerationBrief,
  resolveInputType,
} from './planMechanics'

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

interface AiPlanTaskRow {
  type?: string | null
  user_description?: string | null
  description?: string | null
  difficulty?: string | null
  expectation?: string | null
}

interface AiPlanPayload {
  task_plan?: AiPlanTaskRow[]
  tasks?: { type: string; expectation?: string }[]
}

function fallbackPlanExpectation(draft: WorksheetDraft, index: number, blockHint?: string): string {
  if (blockHint) {
    return `Составить задание по материалу «${blockHint}» из source_content`
  }
  const topic = draft.topic.trim() || 'тема'
  const variants = [
    `Решить задачу по теме «${topic}» на основе source_content`,
    `Выбрать верный ответ по материалу source_content`,
    `Заполнить пропуски по условию из source_content`,
    `Упорядочить элементы по задаче из source_content`,
    `Объяснить ход решения задачи из source_content`,
  ]
  return variants[index % variants.length]
}

function fallbackPlanDescription(draft: WorksheetDraft, index: number, blockHint?: string): string {
  const expectation = fallbackPlanExpectation(draft, index, blockHint)
  return `${expectation} с самостоятельным полным условием для ученика`
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
  return Array.from({ length: count }, (_, i) => {
    const blockHint = blocks[i % Math.max(blocks.length, 1)]
    return {
      id: `plan-${Date.now()}-${i}`,
      taskType: types[i % types.length],
      userExpectation: fallbackPlanExpectation(draft, i, blockHint),
      description: fallbackPlanDescription(draft, i, blockHint),
      planDifficulty: null,
    }
  })
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
      description: fallbackPlanDescription(draft, i),
      planDifficulty: null,
    })
  }
  return padded
}

function extractPlanRows(payload: AiPlanPayload): AiPlanTaskRow[] {
  if (payload.task_plan?.length) return payload.task_plan
  return (payload.tasks ?? []).map((row) => ({
    type: row.type,
    user_description: row.expectation ?? null,
    description: row.expectation ?? null,
    difficulty: null,
  }))
}

function planRowsForIndependence(rows: AiPlanTaskRow[]): { expectation?: string }[] {
  return rows.map((row) => ({
    expectation: (row.description || row.user_description || row.expectation || '').trim(),
  }))
}

function normalizeType(raw: string, fallback: TaskType = 'short_answer'): TaskType {
  return fromSpecMechanic(raw, null, fallback)
}

function resolvePlanTaskType(row: AiPlanTaskRow, existing?: PlanTask): TaskType {
  if (existing?.taskType && !row.type) return existing.taskType
  return fromSpecMechanic(row.type || existing?.taskType || 'short_answer', row.description)
}

function toBlock(
  task: AiTaskPayload,
  index: number,
  draft: WorksheetDraft,
  planItem?: PlanTask,
): WorksheetBlock {
  let type = normalizeType(task.type, planItem?.taskType ?? 'short_answer')
  if (planItem && (planItem.taskType === 'short_answer' || planItem.taskType === 'extended_answer')) {
    type = planItem.taskType
  } else if (type === 'short_answer' && planItem?.description && resolveInputType(planItem.description) === 'extended_answer') {
    type = 'extended_answer'
  }

  const planBrief = planItem ? planGenerationBrief(planItem) : undefined
  const normalized = normalizeAiTask(task, type, planBrief)
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
    difficulty:
      task.difficulty ??
      planDifficultyToStars(planItem?.planDifficulty, draft.difficulty, index, draft.taskCount),
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
      description: fallbackPlanDescription(draft, i),
      planDifficulty: null,
    })
  }
  return padded
}

export async function generatePlanAI(draft: WorksheetDraft): Promise<PlanTask[]> {
  try {
    const { system, user } = promptsForPlan(draft)
    let payload = await chatJson<AiPlanPayload>(system, user, { temperature: 0.55 })
    let rows = extractPlanRows(payload).slice(0, draft.taskCount)

    for (let attempt = 0; attempt < 2; attempt++) {
      const planIssues = validatePlanIndependence(planRowsForIndependence(rows))
      if (!planIssues.length) break
      payload = await chatJson<AiPlanPayload>(
        system,
        user + independenceRetryNote(planIssues),
        { temperature: 0.45 + attempt * 0.1 },
      )
      rows = extractPlanRows(payload).slice(0, draft.taskCount)
    }

    if (validatePlanIndependence(planRowsForIndependence(rows)).length) {
      const blocks = documentBlockHints(draft)
      if (blocks.length || draft.contextFileText?.trim()) {
        return fallbackDocumentPlan(draft)
      }
    }

    if (!rows.length) throw new AiError('Модель не вернула план заданий')

    const plan: PlanTask[] = rows.map((row, i) => {
      const existing = draft.plan[i]
      const teacherInput = existing?.userExpectation?.trim()
      const lockedDescription = existing?.description?.trim()
      const userDescription = (row.user_description || teacherInput || '').slice(0, 200)
      const description = lockedDescription || (row.description || '').slice(0, 2000) || null

      return {
        id: existing?.id ?? `plan-${Date.now()}-${i}`,
        taskType: resolvePlanTaskType(row, existing),
        userExpectation: userDescription || (row.expectation || '').slice(0, 200),
        description,
        planDifficulty:
          existing?.planDifficulty ??
          normalizePlanItemDifficulty(row.difficulty) ??
          null,
      }
    })

    return padPlanToCount(plan, draft)
  } catch (err) {
    if (isAiUnavailable(err)) return createPlan(draft.taskCount)
    throw err
  }
}

function blockNeedsRepair(block: WorksheetBlock, planBrief?: string): boolean {
  return taskQuestionIssues(
    {
      type: block.type,
      question: block.question,
      gaps_text: getGapsSourceText(block),
      options: block.options?.map((o) => o.text),
      left_items: block.leftItems?.map((i) => i.text),
      right_items: block.rightItems?.map((i) => i.text),
    },
    planBrief,
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
    const planBriefs = plan.map((p) => planGenerationBrief(p))
    for (let attempt = 0; attempt < 2; attempt++) {
      const taskIssues = validateTaskIndependence(tasks, planBriefs)
      if (!taskIssues.length) break
      payload = await chatJson<AiWorksheetPayload>(
        system,
        user + independenceRetryNote(taskIssues),
        { temperature: 0.45 + attempt * 0.1 },
      )
      tasks = (payload.tasks ?? []).slice(0, prepared.taskCount)
    }

    if (validateTaskIndependence(tasks, planBriefs).length && referenceFilePayload(prepared)?.content) {
      payload = await chatJson<AiWorksheetPayload>(
        system,
        user +
          '\n\nКаждое question — полное условие для ученика: текст задачи из source_content (все данные и числа) + вопрос. Не копируй description или user_description («Определить…», «Выберите…» без условия). Не используй готовые решения из файла.',
        { temperature: 0.55,
        },
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
          planBriefs[i] ||
          fallbackPlanExpectation(prepared, i) ||
          `Задание по теме «${draft.topic}»`,
        difficulty: planDifficultyToStars(plan[i]?.planDifficulty, draft.difficulty, i, prepared.taskCount),
      })
    }

    const blocks = aligned.map((t, i) => toBlock(t, i, prepared, plan[i]))

    for (let i = 0; i < blocks.length; i++) {
      const planBrief = planBriefs[i]
      const anchorTasks = collectAnchorTasks(blocks, planBriefs, {
        skipBlockIndex: i,
      })
      let attempts = 0
      while (blockNeedsRepair(blocks[i], planBrief) && attempts < 3) {
        try {
          blocks[i] = await generateSingleTaskAI(
            prepared,
            plan[i]?.taskType ?? blocks[i].type,
            plan[i]?.userExpectation ?? '',
            repairTaskExpectation(planBrief),
            anchorTasks,
            plan[i]?.description,
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
        blocks[i] = enrichBlockFromReference(blocks[i], refContent, planBriefs[i])
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      blocks[i] = trimReferenceDumpFromBlock(blocks[i])
    }

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].type !== 'fill_gaps') continue
      if (getGapsSourceText(blocks[i]).includes('___')) continue
      if (refContent) {
        blocks[i] = buildFillGapsFallbackBlock(
          blocks[i],
          refContent,
          planBriefs[i],
          collectAnchorTasks(blocks, planBriefs, { skipBlockIndex: i }),
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
  planDescription?: string | null,
): Promise<WorksheetBlock> {
  try {
    const { system, user } = promptsForSingleTask(
      draft,
      taskType,
      expectation,
      repairNote,
      anchorTasks,
      planDescription,
    )
    const payload = await chatJson<{ task: AiTaskPayload }>(system, user, { temperature: 0.55 })

    if (!payload.task) throw new AiError('Модель не вернула задание')

    const index = draft.blocks.filter((b) => b.type !== 'page_break' && b.type !== 'text').length
    const planItem: PlanTask = {
      id: `plan-single-${index}`,
      taskType,
      userExpectation: expectation,
      description: planDescription,
    }
    return toBlock({ ...payload.task, type: taskType }, index, draft, planItem)
  } catch (err) {
    if (isAiUnavailable(err)) return mockSingle(draft, taskType, expectation)
    throw err
  }
}

export { AiError }
