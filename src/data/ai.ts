import type { PlanTask, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { createPlan, uid } from './worksheet'
import { chatJson, AiError, isAiUnavailable } from './aiClient'
import {
  generateWorksheet as mockGenerate,
  generateSingleTask as mockSingle,
} from './generator'
import { promptsForPlan, promptsForSingleTask, promptsForWorksheet } from './aiPrompts'
import { sanitizeBlock, clampAnswerHeight, defaultAnswerHeight, defaultAnswerStyle, groupsToTableFields, createDefaultGroupingTableFields, getGapsSourceText, isValidFillGapsBlock } from './blockUtils'
import {
  expectationToQuestion,
  looksLikeAuthorPlanDescription,
  isGenericTopicFillGaps,
  normalizeAiTask,
  stripMetaTaskDescription,
  containsMetaTaskDescription,
  fillGapsPayloadFromPlanBrief,
  questionMatchesPlanBrief,
} from './taskContent'
import { gapsTextHasBlankMarkers, repairJsonLatexEscapes } from './mathTextUtils'
import {
  blockQuestionIssues,
  hasCaveNarrativeInQuestion,
  independenceRetryNote,
  repairTaskExpectation,
  taskSelfSufficiencyIssues,
  validatePlanIndependence,
  validateTaskIndependence,
  validateTaskSelfSufficiency,
  validateWorksheetPipeline,
  blockingSelfSufficiencyIssues,
  planFragmentAssignmentNote,
} from './taskIndependence'
import { listReferenceTaskHints, wishesUseFullDocument } from './contextFilter'
import { sourceContentForDraft } from './contextFile'
import { enrichBlockFromReference, trimReferenceDumpFromBlock } from './referenceEnrich'
import {
  buildFillGapsFallbackBlock,
  collectAnchorTasks,
} from './referenceThemes'
import {
  fromSpecMechanic,
  isSpecMechanic,
  normalizePlanItemDifficulty,
  planDifficultyToStars,
  planGenerationBrief,
  resolveInputType,
  type SpecMechanic,
  toSpecMechanic,
} from './planMechanics'
import {
  preparePlanForGeneration,
  resizePlanToTaskCount,
  withGenerationBaseline,
} from './taskPlanOrchestration'
import {
  templateTaskToAiPayload,
  type WorksheetJsonTemplate,
  type WorksheetTemplateTask,
} from './worksheetJsonTemplate'

function sanitizeAiText(text: string | undefined): string {
  if (!text) return ''
  return repairJsonLatexEscapes(text)
}

export type GenerateMode = 'create' | 'regenerate'

export interface WorksheetGenerationOptions {
  /** Без цикла generateSingleTaskAI по каждому блоку (для технического прогона). */
  skipTaskRepairs?: boolean
  /** Сколько повторов при validateTaskIndependence (по умолчанию 2). */
  maxIndependenceRetries?: number
  /** Не делать дополнительный chatJson после неудачной валидации. */
  skipExtraIndependencePass?: boolean
  /** Не блокировать выдачу листа при нарушении самодостаточности (для тестов). */
  skipFinalSelfSufficiencyGate?: boolean
}

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
  tasks: AiTaskPayload[] | WorksheetTemplateTask[]
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

export type PlanGenerationSource =
  | 'ai'
  | 'ai_with_validation_warnings'
  | 'cached'
  | 'fallback_fragment'
  | 'fallback_no_api'

export interface PlanGenerationMeta {
  source: PlanGenerationSource
  validationIssues?: string[]
}

function fallbackPlanExpectation(draft: WorksheetDraft, index: number): string {
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

function fallbackPlanDescription(draft: WorksheetDraft, index: number, hint?: string): string {
  if (hint) {
    return `${hint}. Самостоятельное задание с полным условием для ученика.`.slice(0, 2000)
  }
  return `${fallbackPlanExpectation(draft, index)} с самостоятельным полным условием для ученика`
}

function referenceHintsForDraft(draft: WorksheetDraft, limit?: number): string[] {
  return listReferenceTaskHints(
    sourceContentForDraft(draft) ?? '',
    limit ?? Math.max(draft.taskCount, 8),
  )
}

function planItemFromHint(
  draft: WorksheetDraft,
  index: number,
  hint: string | undefined,
  existing?: PlanTask,
): PlanTask {
  const userDescription = (hint ?? fallbackPlanExpectation(draft, index)).slice(0, 100)
  return {
    id: existing?.id ?? `plan-${Date.now()}-${index}`,
    type: existing?.type ?? 'input',
    userDescription,
    description: fallbackPlanDescription(draft, index, hint),
    difficulty: null,
  }
}

function fallbackDocumentPlan(draft: WorksheetDraft): PlanTask[] {
  const hints = referenceHintsForDraft(draft)
  const basePlan = ensurePlan(draft)
  const count = Math.min(15, Math.max(1, draft.taskCount || 5))
  const fullMaterial = wishesUseFullDocument(draft.additionalWishes)

  return Array.from({ length: count }, (_, i) => {
    const hintIndex = fullMaterial && hints.length > 1 ? i % hints.length : i % Math.max(hints.length, 1)
    return planItemFromHint(
      draft,
      i,
      hints[hintIndex],
      basePlan[i] ?? draft.taskPlan[i],
    )
  })
}

function padPlanToCount(plan: PlanTask[], draft: WorksheetDraft): PlanTask[] {
  const hints = referenceHintsForDraft(draft)
  const types = plan.map((p) => p.type).filter(Boolean) as SpecMechanic[]
  const padded = [...plan]
  while (padded.length < draft.taskCount) {
    const i = padded.length
    const hint = hints[i % Math.max(hints.length, 1)]
    padded.push({
      id: `plan-${Date.now()}-${i}`,
      type: types[i % Math.max(types.length, 1)] ?? undefined,
      userDescription: (hint ?? fallbackPlanExpectation(draft, i)).slice(0, 100),
      description: fallbackPlanDescription(draft, i, hint),
      difficulty: null,
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

function resolvePlanSpecType(row: AiPlanTaskRow, existing?: PlanTask): SpecMechanic | null {
  // Spec: если type уже выбран (в т.ч. дефолт UI) — не заменяем ответом планировщика.
  if (existing?.type) return existing.type
  const raw = row.type
  if (!raw) return null
  return isSpecMechanic(raw) ? raw : null
}

const NON_TASK_BLOCK_TYPES = new Set<WorksheetBlock['type']>([
  'page_break',
  'text',
  'answer_field',
  'table',
])

/** @internal Exported for tests. */
export function isWorksheetTaskBlock(block: WorksheetBlock): boolean {
  return !NON_TASK_BLOCK_TYPES.has(block.type)
}

/** @internal Exported for tests. */
export function countWorksheetTaskBlocks(blocks: WorksheetBlock[]): number {
  return blocks.filter(isWorksheetTaskBlock).length
}

function mockBlockForPlanIndex(
  draft: WorksheetDraft,
  blocksSoFar: WorksheetBlock[],
  planItem: PlanTask,
  brief: string,
  refContent?: string | null,
  anchors: ReturnType<typeof collectAnchorTasks> = [],
): WorksheetBlock {
  const taskType = fromSpecMechanic(planItem.type ?? 'input', planItem.description)

  if (refContent && taskType === 'fill_gaps') {
    const shell: WorksheetBlock = {
      id: uid('task'),
      type: 'fill_gaps',
      page: 0,
      title: 'Задание',
      instruction: '',
      question: '',
      gapsText: '',
      gapsAnswers: [],
    }
    return buildFillGapsFallbackBlock(shell, refContent, brief, anchors)
  }

  let block = mockSingle(
    { ...draft, blocks: blocksSoFar, taskCount: draft.taskCount },
    taskType,
    planItem.userDescription || brief,
  )

  if (refContent) {
    if (
      taskType === 'fill_gaps' &&
      isGenericTopicFillGaps(getGapsSourceText(block), block.gapsAnswers)
    ) {
      block = buildFillGapsFallbackBlock(block, refContent, brief, anchors)
    } else if (looksLikeAuthorPlanDescription(block.question || '')) {
      block = enrichBlockFromReference(block, refContent, brief)
    }
  }

  return block
}

/** Гарантирует ровно plan.length учебных блоков; восстанавливает fill_gaps, превращённые в text. */
export function ensureWorksheetTaskBlocks(
  blocks: WorksheetBlock[],
  plan: PlanTask[],
  draft: WorksheetDraft,
  refContent: string | null | undefined,
  planBriefs: string[],
): WorksheetBlock[] {
  const result: WorksheetBlock[] = []

  for (let i = 0; i < plan.length; i++) {
    const planItem = plan[i]
    const brief = planBriefs[i] ?? ''
    const sourceBlock = blocks[i]
    let block = sourceBlock
    const anchors = collectAnchorTasks([...result, ...blocks.slice(i + 1)], planBriefs, {
      skipBlockIndex: i,
    })

    if (!block || !isWorksheetTaskBlock(block)) {
      block = mockBlockForPlanIndex(draft, result, planItem, brief, refContent, anchors)
    } else if (planItem.type === 'fill_gaps' && block.type !== 'fill_gaps') {
      const recovered: WorksheetBlock = {
        ...block,
        type: 'fill_gaps',
        question:
          block.question?.trim() ||
          (block.type === 'text' ? block.body?.trim() : '') ||
          expectationToQuestion(brief) ||
          'Заполните пропуски.',
        body: undefined,
      }
      if (refContent) {
        block = buildFillGapsFallbackBlock(recovered, refContent, brief, anchors)
      } else if (!isValidFillGapsBlock(recovered)) {
        block = mockBlockForPlanIndex(draft, result, planItem, brief, refContent, anchors)
      } else {
        block = recovered
      }
    }

    let sanitized = sanitizeBlock({
      ...block,
      id: sourceBlock?.id ?? block.id,
      title: sourceBlock?.title ?? block.title ?? `Задание ${i + 1}`,
    })

    if (planItem.type === 'fill_gaps' && sanitized.type !== 'fill_gaps') {
      sanitized = sanitizeBlock({
        ...mockBlockForPlanIndex(draft, result, planItem, brief, refContent, anchors),
        id: sourceBlock?.id ?? block.id,
        title: sourceBlock?.title ?? `Задание ${i + 1}`,
      })
    }

    if (refContent) {
      const gapsText = getGapsSourceText(sanitized)
      if (
        sanitized.type === 'fill_gaps' &&
        (isGenericTopicFillGaps(gapsText, sanitized.gapsAnswers) ||
          looksLikeAuthorPlanDescription(sanitized.question || ''))
      ) {
        sanitized = sanitizeBlock(
          buildFillGapsFallbackBlock(sanitized, refContent, brief, anchors),
        )
      } else if (
        looksLikeAuthorPlanDescription(sanitized.question || '') &&
        blockQuestionIssues(sanitized, brief).some((issue) => issue.includes('описание'))
      ) {
        sanitized = sanitizeBlock(enrichBlockFromReference(sanitized, refContent, brief))
      }
    } else {
      const gapsText = getGapsSourceText(sanitized)
      if (
        sanitized.type === 'fill_gaps' &&
        (isGenericTopicFillGaps(gapsText, sanitized.gapsAnswers) || !isValidFillGapsBlock(sanitized))
      ) {
        const gaps = fillGapsPayloadFromPlanBrief(brief, draft.topic)
        sanitized = sanitizeBlock({
          ...sanitized,
          question: gaps.question,
          gapsText: gaps.gaps_text,
          gapsAnswers: gaps.gaps_answers,
        })
      } else if (
        looksLikeAuthorPlanDescription(sanitized.question || '') ||
        containsMetaTaskDescription(sanitized.question || '')
      ) {
        const q = expectationToQuestion(brief) || fallbackPlanExpectation(draft, i)
        if (q.trim()) {
          sanitized = sanitizeBlock({ ...sanitized, question: q })
        }
      }
    }

    result.push(sanitized)
  }

  return result
}

/** Детерминированная починка перед финальной проверкой; лист всё равно выдаётся ученику. */
export function repairWorksheetBlocksForDelivery(
  blocks: WorksheetBlock[],
  plan: PlanTask[],
  draft: WorksheetDraft,
  refContent: string | null | undefined,
  planBriefs: string[],
): WorksheetBlock[] {
  const result: WorksheetBlock[] = []

  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i]!
    const brief = planBriefs[i] ?? ''
    const anchors = collectAnchorTasks([...result, ...blocks.slice(i + 1)], planBriefs, {
      skipBlockIndex: i,
    })

    const rawQuestion = block.question?.trim() ?? ''
    if (rawQuestion) {
      let question = stripMetaTaskDescription(rawQuestion)
      if (containsMetaTaskDescription(question) || looksLikeAuthorPlanDescription(question)) {
        question =
          expectationToQuestion(brief) || fallbackPlanExpectation(draft, i) || 'Решите задачу по условию.'
      }
      if (question !== block.question) {
        block = { ...block, question }
      }
    }

    if (block.type === 'fill_gaps') {
      const gapsText = getGapsSourceText(block)
      const needsGapsFix =
        !isValidFillGapsBlock(block) ||
        isGenericTopicFillGaps(gapsText, block.gapsAnswers) ||
        (!gapsTextHasBlankMarkers(gapsText) && !(block.gapsAnswers?.length ?? 0))
      if (needsGapsFix) {
        if (refContent) {
          block = buildFillGapsFallbackBlock(block, refContent, brief, anchors)
        } else {
          const gaps = fillGapsPayloadFromPlanBrief(brief, draft.topic)
          block = {
            ...block,
            question: gaps.question,
            gapsText: gaps.gaps_text,
            gapsAnswers: gaps.gaps_answers,
          }
        }
      } else if (
        brief &&
        (questionMatchesPlanBrief(block.question || '', brief) ||
          looksLikeAuthorPlanDescription(block.question || ''))
      ) {
        const gaps = fillGapsPayloadFromPlanBrief(brief, draft.topic)
        block = { ...block, question: gaps.question }
      }
    } else if (looksLikeAuthorPlanDescription(block.question || '') && refContent) {
      block = enrichBlockFromReference(block, refContent, brief)
    }

    block = trimReferenceDumpFromBlock(block)
    result.push(
      sanitizeBlock({
        ...block,
        id: block.id,
        title: block.title ?? `Задание ${i + 1}`,
      }),
    )
  }

  return result
}

function toBlock(
  task: AiTaskPayload,
  index: number,
  draft: WorksheetDraft,
  planItem?: PlanTask,
): WorksheetBlock {
  const planTaskType = planItem?.type
    ? fromSpecMechanic(planItem.type, planItem.description)
    : 'short_answer'
  let type = normalizeType(task.type, planTaskType)
  if (planItem?.type === 'input' && resolveInputType(planItem.description) === 'extended_answer') {
    type = 'extended_answer'
  } else if (type === 'short_answer' && planItem?.description && resolveInputType(planItem.description) === 'extended_answer') {
    type = 'extended_answer'
  }

  const planBrief = planItem ? planGenerationBrief(planItem) : undefined
  const normalized = normalizeAiTask(task, type, planBrief, draft.topic)
  const optionTexts = normalized.options?.length ? normalized.options : task.options ?? []
  const options = optionTexts.map((text, i) => ({
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
    gapsAnswers: (normalized.gaps_answers ?? task.gaps_answers)?.map(sanitizeAiText),
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
      planDifficultyToStars(planItem?.difficulty, draft.difficulty, index, draft.taskCount),
  })
}

export function ensurePlan(draft: WorksheetDraft): PlanTask[] {
  return resizePlanToTaskCount(draft.taskPlan, draft.taskCount)
}

function planUserDescriptionFromRow(
  row: AiPlanTaskRow,
  teacherInput: string | undefined,
  description: string | null,
): string {
  const fromTeacher = teacherInput?.trim()
  if (fromTeacher) return fromTeacher.slice(0, 100)

  const fromAgent = row.user_description?.trim() || row.expectation?.trim()
  if (fromAgent) return fromAgent.slice(0, 100)

  if (description) {
    const firstSentence = description.split(/(?<=[.!?])\s+/)[0]?.trim() || description.trim()
    return firstSentence.slice(0, 100)
  }

  return ''
}

function rowsToPlan(rows: AiPlanTaskRow[], draft: WorksheetDraft): PlanTask[] {
  const plan: PlanTask[] = rows.map((row, i) => {
    const existing = draft.taskPlan[i]
    const teacherInput = existing?.userDescription?.trim()
    const description = (row.description || '').slice(0, 2000) || null
    const userDescription = planUserDescriptionFromRow(row, teacherInput, description)

    return {
      id: existing?.id ?? `plan-${Date.now()}-${i}`,
      type: resolvePlanSpecType(row, existing),
      userDescription,
      description,
      difficulty: normalizePlanItemDifficulty(row.difficulty) ?? existing?.difficulty ?? null,
    }
  })

  return padPlanToCount(plan, draft)
}

export async function generatePlanAIWithMeta(
  draft: WorksheetDraft,
): Promise<{ plan: PlanTask[]; meta: PlanGenerationMeta }> {
  const { plan: preparedPlan, needsPlanner } = preparePlanForGeneration(draft)
  const workingDraft = { ...draft, taskPlan: preparedPlan, taskCount: preparedPlan.length }

  if (!needsPlanner) {
    return { plan: preparedPlan, meta: { source: 'cached' } }
  }

  try {
    const hints = referenceHintsForDraft(workingDraft)
    const { system, user } = promptsForPlan(workingDraft)
    const fullMaterial = wishesUseFullDocument(workingDraft.additionalWishes)
    const fragmentNote =
      fullMaterial && hints.length
        ? `${planFragmentAssignmentNote(hints, workingDraft.taskCount)}\n\nНе более одного пункта про пещеру/персонажей; остальные — другие сюжеты из source_content. Каждый пункт — самостоятельная задача с полным условием, не этап многошагового решения.`
        : ''
    const planUser = user + fragmentNote
    let payload = await chatJson<AiPlanPayload>(system, planUser, { temperature: 0.55 })
    let rows = extractPlanRows(payload).slice(0, workingDraft.taskCount)
    let validationIssues = validatePlanIndependence(planRowsForIndependence(rows))

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!validationIssues.length) break
      payload = await chatJson<AiPlanPayload>(
        system,
        planUser + independenceRetryNote(validationIssues),
        { temperature: 0.45 + attempt * 0.1 },
      )
      rows = extractPlanRows(payload).slice(0, workingDraft.taskCount)
      validationIssues = validatePlanIndependence(planRowsForIndependence(rows))
    }

    if (validationIssues.length && hints.length) {
      payload = await chatJson<AiPlanPayload>(
        system,
        planUser +
          independenceRetryNote(validationIssues) +
          planFragmentAssignmentNote(hints, workingDraft.taskCount),
        { temperature: 0.4 },
      )
      rows = extractPlanRows(payload).slice(0, workingDraft.taskCount)
      validationIssues = validatePlanIndependence(planRowsForIndependence(rows))
    }

    if (!rows.length) {
      const fallbackPlan = fallbackDocumentPlan(workingDraft)
      return {
        plan: fallbackPlan,
        meta: { source: 'fallback_fragment' },
      }
    }

    const plan = rowsToPlan(rows, workingDraft)
    const meta: PlanGenerationMeta = validationIssues.length
      ? { source: 'ai_with_validation_warnings', validationIssues }
      : { source: 'ai' }

    return { plan, meta }
  } catch (err) {
    if (isAiUnavailable(err)) {
      if (sourceContentForDraft(workingDraft)) {
        return {
          plan: fallbackDocumentPlan(workingDraft),
          meta: { source: 'fallback_fragment' },
        }
      }
      return {
        plan: createPlan(workingDraft.taskCount),
        meta: { source: 'fallback_no_api' },
      }
    }
    throw err
  }
}

export async function generatePlanAI(draft: WorksheetDraft): Promise<PlanTask[]> {
  return (await generatePlanAIWithMeta(draft)).plan
}

function blockNeedsRepair(block: WorksheetBlock, planBrief?: string): boolean {
  const task = blockToAiPayload(block)
  return taskSelfSufficiencyIssues(task, planBrief).length > 0
}

function blockToAiPayload(block: WorksheetBlock): AiTaskPayload {
  const gapsText =
    block.type === 'fill_gaps'
      ? getGapsSourceText(block).trim() || block.gapsText?.trim() || block.gapsSourceText?.trim()
      : block.gapsText?.trim() ||
        (block.gapsSourceText?.trim() && gapsTextHasBlankMarkers(block.gapsSourceText)
          ? block.gapsSourceText
          : getGapsSourceText(block))
  return {
    type: block.type,
    question: block.question,
    gaps_text: gapsText,
    gaps_answers: block.gapsAnswers,
    options: block.options?.map((o) => o.text),
    left_items: block.leftItems?.map((i) => i.text),
    right_items: block.rightItems?.map((i) => i.text),
  }
}

function collectWorksheetValidationIssues(
  blocks: WorksheetBlock[],
  planBriefs: string[],
): string[] {
  const tasks = blocks.map(blockToAiPayload)
  return [
    ...validateTaskSelfSufficiency(tasks, planBriefs),
    ...validateWorksheetPipeline(tasks, planBriefs),
  ]
}

function templateTasksFromPayload(payload: AiWorksheetPayload): WorksheetTemplateTask[] {
  return (payload.tasks ?? []) as WorksheetTemplateTask[]
}

function templateTasksToAiPayloads(
  tasks: WorksheetTemplateTask[],
  plan: PlanTask[],
): AiTaskPayload[] {
  return tasks.map((task, i) => templateTaskToAiPayload(task, plan[i]) as AiTaskPayload)
}

/** @internal Exported for tests. */
export function templateToBlocks(
  filled: WorksheetJsonTemplate,
  plan: PlanTask[],
  draft: WorksheetDraft,
): WorksheetBlock[] {
  const tasks = (filled.tasks ?? []).slice(0, plan.length)
  return tasks.map((task, i) => toBlock(templateTaskToAiPayload(task, plan[i]) as AiTaskPayload, i, draft, plan[i]))
}

export async function generateWorksheetAI(
  draft: WorksheetDraft,
  mode: GenerateMode = 'create',
  options?: WorksheetGenerationOptions,
): Promise<WorksheetDraft> {
  let { plan, needsPlanner } = preparePlanForGeneration(draft)
  let prepared = { ...draft, taskPlan: plan, taskCount: plan.length }

  if (needsPlanner) {
    const { plan: planned, meta } = await generatePlanAIWithMeta(prepared)
    plan = planned
    prepared = withGenerationBaseline({ ...prepared, taskPlan: plan, taskCount: plan.length }, plan)
    if (meta.source === 'fallback_no_api' || meta.source === 'fallback_fragment') {
      // keep going with fallback plan
    }
  }

  const maxIndependenceRetries = options?.maxIndependenceRetries ?? 2

  try {
    const { system, user } = promptsForWorksheet(prepared, mode)
    let payload = await chatJson<WorksheetJsonTemplate & AiWorksheetPayload>(system, user, {
      temperature: mode === 'regenerate' ? 0.7 : 0.45,
    })

    let templateTasks = templateTasksFromPayload(payload).slice(0, prepared.taskCount)
    const planBriefs = plan.map((p) => planGenerationBrief(p))

    for (let attempt = 0; attempt < maxIndependenceRetries; attempt++) {
      const aiTasks = templateTasksToAiPayloads(templateTasks, plan)
      const taskIssues = validateTaskIndependence(aiTasks, planBriefs)
      if (!taskIssues.length) break
      payload = await chatJson<WorksheetJsonTemplate & AiWorksheetPayload>(
        system,
        user + independenceRetryNote(taskIssues),
        { temperature: 0.45 + attempt * 0.1 },
      )
      templateTasks = templateTasksFromPayload(payload).slice(0, prepared.taskCount)
    }

    if (
      !options?.skipExtraIndependencePass &&
      validateTaskIndependence(templateTasksToAiPayloads(templateTasks, plan), planBriefs).length &&
      sourceContentForDraft(prepared)
    ) {
      payload = await chatJson<WorksheetJsonTemplate & AiWorksheetPayload>(
        system,
        user +
          '\n\nКаждое question — полное условие для ученика: текст задачи из source_content (все данные и числа) + вопрос. Не копируй description («Определить…», «Выберите…» без условия). Не используй готовые решения из файла.',
        { temperature: 0.55,
        },
      )
      templateTasks = templateTasksFromPayload(payload).slice(0, prepared.taskCount)
    }

    if (!templateTasks.length) throw new AiError('Модель не вернула задания')

    while (templateTasks.length < prepared.taskCount) {
      const i = templateTasks.length
      templateTasks.push({
        type: plan[i]?.type ?? 'input',
        instruction: '',
        question:
          planBriefs[i] ||
          fallbackPlanExpectation(prepared, i) ||
          `Задание по теме «${draft.topic}»`,
        difficulty: planDifficultyToStars(
          plan[i]?.difficulty,
          draft.difficulty,
          i,
          prepared.taskCount,
        ),
      })
    }

    let blocks = templateToBlocks(
      { title: payload.title, intro: payload.intro, tasks: templateTasks },
      plan,
      prepared,
    )

    if (!options?.skipTaskRepairs) {
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
              fromSpecMechanic(plan[i]?.type ?? 'input', plan[i]?.description, blocks[i].type),
              plan[i]?.userDescription ?? '',
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
    }

    const refContent = sourceContentForDraft(prepared)
    if (refContent) {
      for (let i = 0; i < blocks.length; i++) {
        blocks[i] = enrichBlockFromReference(blocks[i], refContent, planBriefs[i])
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      blocks[i] = trimReferenceDumpFromBlock(blocks[i])
    }

    if (refContent) {
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type === 'fill_gaps') continue
        if (
          looksLikeAuthorPlanDescription(blocks[i].question || '') ||
          blockQuestionIssues(blocks[i], planBriefs[i]).some((issue) => issue.includes('описание'))
        ) {
          blocks[i] = enrichBlockFromReference(blocks[i], refContent, planBriefs[i])
        }
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].type !== 'fill_gaps') continue
      const aboutCave =
        /пещер/i.test(blocks[i].question || '') || /пещер/i.test(planBriefs[i] || '')
      const storyIssues =
        blockQuestionIssues(blocks[i], planBriefs[i]).some(
          (issue) =>
            issue.includes('сюжет') ||
            issue.includes('коротк') ||
            issue.includes('минут') ||
            issue.includes('самостоятель') ||
            issue.includes('description') ||
            issue.includes('служеб'),
        ) ||
        (aboutCave && !hasCaveNarrativeInQuestion(blocks[i].question || ''))
      const gapsMissing = !getGapsSourceText(blocks[i]).includes('___')
      const genericGaps = isGenericTopicFillGaps(
        getGapsSourceText(blocks[i]),
        blocks[i].gapsAnswers,
      )
      const authorQuestion = looksLikeAuthorPlanDescription(blocks[i].question || '')
      if (!refContent) {
        if (gapsMissing) {
          blocks[i] = {
            ...blocks[i],
            question: 'Заполните пропуски в условии задачи.',
            gapsText:
              'Один мастер изготавливает деталь за ___ минут, а ученик — за ___ минут. За 2 часа они вместе изготовили ___ деталей.',
            gapsAnswers: ['12', '20', '15'],
          }
        }
        continue
      }
      if (gapsMissing || storyIssues || genericGaps || authorQuestion) {
        blocks[i] = buildFillGapsFallbackBlock(
          blocks[i],
          refContent,
          planBriefs[i],
          collectAnchorTasks(blocks, planBriefs, { skipBlockIndex: i }),
        )
      }
    }

    blocks = ensureWorksheetTaskBlocks(blocks, plan, prepared, refContent, planBriefs)
    blocks = repairWorksheetBlocksForDelivery(blocks, plan, prepared, refContent, planBriefs)

    if (!options?.skipFinalSelfSufficiencyGate) {
      let finalIssues = collectWorksheetValidationIssues(blocks, planBriefs)
      if (finalIssues.length) {
        payload = await chatJson<WorksheetJsonTemplate & AiWorksheetPayload>(
          system,
          user + independenceRetryNote(finalIssues),
          { temperature: 0.35 },
        )
        templateTasks = templateTasksFromPayload(payload).slice(0, prepared.taskCount)
        blocks = templateToBlocks(
          { title: payload.title, intro: payload.intro, tasks: templateTasks },
          plan,
          prepared,
        )
        if (refContent) {
          for (let i = 0; i < blocks.length; i++) {
            blocks[i] = enrichBlockFromReference(blocks[i], refContent, planBriefs[i])
          }
        }
        blocks = ensureWorksheetTaskBlocks(blocks, plan, prepared, refContent, planBriefs)
        blocks = repairWorksheetBlocksForDelivery(blocks, plan, prepared, refContent, planBriefs)
        finalIssues = collectWorksheetValidationIssues(blocks, planBriefs)
        const blocking = blockingSelfSufficiencyIssues(finalIssues)
        if (blocking.length) {
          console.warn(
            '[generateWorksheetAI] самодостаточность (лист всё равно выдан):',
            blocking.slice(0, 4).join('; '),
          )
        }
        if (finalIssues.length) {
          console.warn('[generateWorksheetAI] некритичные замечания самодостоятельности:', finalIssues.slice(0, 6))
        }
      }
    }

    return withGenerationBaseline(
      {
        ...prepared,
        title: payload.title || draft.topic || draft.title,
        intro: draft.showIntro ? payload.intro || draft.intro : '',
        blocks,
        pages: 1,
        savedAt: undefined,
      },
      plan,
    )
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
      type: toSpecMechanic(taskType),
      userDescription: expectation,
      description: planDescription,
    }
    return toBlock({ ...payload.task, type: taskType }, index, draft, planItem)
  } catch (err) {
    if (isAiUnavailable(err)) return mockSingle(draft, taskType, expectation)
    throw err
  }
}

export { AiError }
