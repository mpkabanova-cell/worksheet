import type { TaskType, WorksheetBlock } from './worksheet'
import { normalizeGapPlaceholders } from './mathTextUtils'

export interface AiTaskFields {
  type?: TaskType | string
  question?: string
  gaps_text?: string
  gaps_answers?: string[]
  left_items?: string[]
  right_items?: string[]
  options?: string[]
}

export function normalizeWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

const BARE_INSTRUCTION_RE =
  /^(определит[ье]|выберит[ье]|сопоставит[ье]|объяснит[ье]|упорядоч[ьи]те?|запишит[ье]|найдит[ье]|заполнит[ье]|распределит[ье])\b/i

const META_TASK_DESCRIPTION_PATTERNS = [
  /задача на выбор персонажа/i,
  /задача на\s+(?:выбор|сопоставление|распределение|упорядочивание|логик|оптимизац)/i,
  /исходя из предоставленных данных/i,
  /на основе предоставленн(?:ой|ых) информации/i,
  /требуется выбрать один вариант ответа/i,
  /требующ(?:ая|ее)\s+(?:вычислени|сопоставлени|выбор|анализ|восстановлени)/i,
  /ожидается\s+подробн(?:ое|ый)\s+решени/i,
  /^сопоставление\s+[^.\n]{10,200}\.\s*$/im,
]

export const GENERIC_TOPIC_FILL_GAPS_RE =
  /^По теме «[^»]+» важно помнить:\s*___\s*—\s*это основа,\s*а\s*___\s*помогает проверить результат\.?$/i

/** Служебная формулировка из description/plan, не для ученика. */
export function containsMetaTaskDescription(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  return META_TASK_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(value)) || looksLikeAuthorPlanDescription(value)
}

/** Методическое описание задания (description плана), а не условие для ученика. */
export function looksLikeAuthorPlanDescription(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  if (/^задача на\s+/i.test(value) && !/\d/.test(value) && value.length <= 400) return true
  if (/^решение задачи на\s+/i.test(value) && !/\d/.test(value)) return true
  if (/^выбор персонажа/i.test(value)) return true
  if (/индивидуальным временем прохождения/i.test(value)) return true
  if (/с записью полного хода решения/i.test(value)) return true
  if (/ожидается\s+подробн/i.test(value)) return true
  if (/^восстановление\s+пропущенных\s+числовых\s+данных/i.test(value)) return true
  if (/^восстановление\s+/i.test(value) && !hasGapMarker(value) && !/\?\s*$/.test(value)) return true
  if (/^закрепление\s+/i.test(value) && value.length <= 280 && !hasGapMarker(value)) return true
  if (/^формирование\s+/i.test(value) && value.length <= 280 && !hasGapMarker(value)) return true
  if (/^[^.\n]{10,180},\s*требующ/i.test(value)) return true
  return false
}

export function questionMatchesPlanBrief(question: string, brief: string): boolean {
  const q = normalizeWs(question)
  const b = normalizeWs(brief)
  if (!q || !b) return false
  if (q === b) return true
  if (b.startsWith(q) || q.startsWith(b)) return Math.min(q.length, b.length) >= 24
  return false
}

export function fillGapsPayloadFromPlanBrief(
  brief: string,
  sheetTopic: string,
): { question: string; gaps_text: string; gaps_answers: string[] } {
  const plan = brief.trim()
  const topic = sheetTopic.trim() || 'тема'
  const fromPlan = expectationToQuestion(plan)
  const lower = `${plan} ${topic}`.toLowerCase()

  let question =
    fromPlan && !looksLikeAuthorPlanDescription(fromPlan)
      ? fromPlan
      : `Заполните пропуски по заданию.`

  if (/подобн|коэффициент|слагаем/.test(lower)) {
    question = 'Заполните пропуски, восстановив коэффициенты при приведении подобных слагаемых.'
    return {
      question,
      gaps_text:
        'Сумму $7x + 2x$ можно записать как $___x$. Числовой коэффициент при $x$ в этой сумме равен ___.',
      gaps_answers: ['9', '9'],
    }
  }

  if (/одночлен|многочлен|моном/.test(lower)) {
    question = `Заполните пропуски по теме «${topic}».`
    return {
      question,
      gaps_text:
        'В одночлене $4a^2b$ коэффициент равен ___. Сумма показателей степени в $4a^2b$ равна ___.',
      gaps_answers: ['4', '3'],
    }
  }

  if (/дроб|числител|знаменател/.test(lower)) {
    question = `Заполните пропуски по теме «${topic}».`
    return {
      question,
      gaps_text:
        'Сумма $\\frac{2}{7} + \\frac{3}{7}$ равна $\\frac{___}{7}$. Числитель результата равен ___.',
      gaps_answers: ['5', '5'],
    }
  }

  const lead = plan.replace(/\.$/, '').slice(0, 120)
  question = fromPlan && !looksLikeBareTaskInstruction(fromPlan) ? fromPlan : `Заполните пропуски: ${lead}.`
  return {
    question,
    gaps_text: `${lead}: в выражении $2x + ___x$ пропущен коэффициент ___.`,
    gaps_answers: ['3', '3'],
  }
}

/** Шаблонное fill_gaps из mock-генератора — не из файла и не по сюжету. */
export function isGenericTopicFillGaps(
  gapsText: string | undefined,
  gapsAnswers?: string[] | null,
): boolean {
  const gaps = gapsText?.trim() ?? ''
  if (!gaps) return false
  if (GENERIC_TOPIC_FILL_GAPS_RE.test(gaps)) return true
  return (
    gapsAnswers?.length === 2 &&
    gapsAnswers[0]?.trim().toLowerCase() === 'правило' &&
    gapsAnswers[1]?.trim().toLowerCase() === 'пример'
  )
}

/** Убирает строки description/plan, попавшие в question. */
export function stripMetaTaskDescription(text: string): string {
  let result = text.trim()
  if (!result) return result

  const linePatterns = [
    /^задача на\s+[^\n]{4,320}\.\s*/gim,
    /^решение задачи на\s+[^\n]{4,320}\.?\s*/gim,
    /^выбор персонажа[^\n]*\.?\s*/gim,
    /^[^.\n]{8,180},\s*требующ[^\n]*\.?\s*/gim,
    /^ожидается\s+подробн[^\n]*\.?\s*/gim,
    /^восстановление\s+пропущенных\s+числовых\s+данных[^\n]*\.?\s*/gim,
    /^задача на выбор персонажа[^\n]*/gim,
    /^[^.\n]*исходя из предоставленных данных[^\n]*\.?\s*$/gim,
    /^[^.\n]*на основе предоставленн(?:ой|ых) информации[^\n]*\.?\s*$/gim,
    /^[^.\n]*требуется выбрать один вариант ответа\.?\s*$/gim,
    /^сопоставление\s+[^.\n]{10,200}\.\s*$/gim,
  ]

  for (const pattern of linePatterns) {
    result = result.replace(pattern, '').trim()
  }

  return result.replace(/\n{3,}/g, '\n\n').trim()
}

/** Вопрос похож на методическую установку, а не на условие для ученика. */
export function looksLikeBareTaskInstruction(question: string): boolean {
  const q = question.trim()
  if (!q || !BARE_INSTRUCTION_RE.test(q)) return false
  if (q.length >= 200) return false
  if ((q.match(/\d+\s*минут/g)?.length ?? 0) >= 3) return false
  if (/\d/.test(q) && q.length >= 120) return false
  return true
}

export function expectationToQuestion(expectation?: string): string {
  const value = expectation?.trim()
  if (!value) return ''

  const converted = value
    .replace(/^Заполнить/i, 'Заполните')
    .replace(/^Сопоставить/i, 'Сопоставьте')
    .replace(/^Решить/i, 'Решите')
    .replace(/^Вычислить/i, 'Вычислите')
    .replace(/^Выбрать/i, 'Выберите')
    .replace(/^Записать/i, 'Запишите')
    .replace(/^Объяснить/i, 'Объясните')
    .replace(/^Найти/i, 'Найдите')
    .replace(/^Упорядочить/i, 'Упорядочьте')
    .replace(/^Распределить/i, 'Распределите')
    .replace(/^Определить/i, 'Определите')

  if (looksLikeBareTaskInstruction(converted)) return ''
  return converted
}

function hasGapMarker(text: string): boolean {
  return text.includes('___') || text.includes('_______')
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function looksLikeTheory(text: string): boolean {
  const value = text.trim()
  if (value.length < 40) return false
  if (hasGapMarker(value)) return false

  const numberedRules = value.match(/\d\.\s/g)?.length ?? 0
  if (numberedRules >= 2) return true

  const theoryKeywords =
    /пишется|имеет значени|(?<![а-яёА-ЯЁ])правил(?:о|а|е|у|и|ы|ом|ами|ов|ам|ах)?|приставк|(?<![а-яёА-ЯЁ])определени(?:е|я|и|й|ем|ях|ями)?|обозначается|обозначают|множеств.*букв|буквой\s*[A-ZА-ЯQNЗ]|любое целое|любое число|называется|называют|можно представить/i
  return theoryKeywords.test(value)
}

/** Убирает теоретические абзацы в конце или целиком теоретический текст. */
export function stripTheoryFromField(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const paragraphs = splitParagraphs(trimmed)
  if (paragraphs.length <= 1) {
    if (!looksLikeTheory(trimmed)) return trimmed
    const firstLine = trimmed.split('\n')[0]?.trim() ?? ''
    return firstLine && !looksLikeTheory(firstLine) ? firstLine : ''
  }

  const kept = paragraphs.filter((part) => !looksLikeTheory(part))
  if (kept.length > 0) return kept.join('\n\n').trim()

  const firstLine = paragraphs[0]?.split('\n')[0]?.trim() ?? ''
  return firstLine && !looksLikeTheory(firstLine) ? firstLine : ''
}

/** Убирает теоретическое вступление перед текстом с пропусками. */
export function stripLeadingTheoryFromGaps(text: string): string {
  const paragraphs = splitParagraphs(text.trim())
  if (paragraphs.length <= 1) {
    return looksLikeTheory(text) && !hasGapMarker(text) ? '' : text.trim()
  }

  let start = 0
  while (
    start < paragraphs.length &&
    looksLikeTheory(paragraphs[start]) &&
    !hasGapMarker(paragraphs[start])
  ) {
    start += 1
  }

  return paragraphs.slice(start).join('\n\n').trim()
}

export const DEFAULT_FILL_GAPS_QUESTION = 'Заполните пропуски в тексте.'
export const DEFAULT_MATCHING_QUESTION =
  'Сопоставьте элементы левого столбца с элементами правого.'
export const DEFAULT_GROUPING_QUESTION = 'Распределите элементы по группам.'
export const DEFAULT_ORDERING_QUESTION = 'Упорядочьте элементы в правильной последовательности.'
export const DEFAULT_SHORT_ANSWER_QUESTION = 'Запишите ответ.'
export const DEFAULT_EXTENDED_ANSWER_QUESTION = 'Дайте развёрнутый ответ.'
export const DEFAULT_CHOICE_QUESTION = 'Выберите верный ответ.'

const QUESTION_EDITOR_PLACEHOLDERS = new Set([
  'Введите текст',
  'Введите текст…',
  'Введите условие…',
  'Введите условие...',
  'Введите вопрос…',
  'Введите вопрос...',
])

export function isMissingTaskQuestion(text: string | undefined): boolean {
  const value = text?.trim() ?? ''
  return !value || QUESTION_EDITOR_PLACEHOLDERS.has(value)
}

export function defaultQuestionForTaskType(type: TaskType, expectation?: string): string {
  const fromExpectation = expectationToQuestion(expectation)
  if (fromExpectation) return fromExpectation

  switch (type) {
    case 'fill_gaps':
      return DEFAULT_FILL_GAPS_QUESTION
    case 'matching':
      return DEFAULT_MATCHING_QUESTION
    case 'grouping':
    case 'table':
      return DEFAULT_GROUPING_QUESTION
    case 'ordering':
      return DEFAULT_ORDERING_QUESTION
    case 'short_answer':
      return DEFAULT_SHORT_ANSWER_QUESTION
    case 'extended_answer':
      return DEFAULT_EXTENDED_ANSWER_QUESTION
    case 'single_choice':
    case 'multiple_choice':
      return DEFAULT_CHOICE_QUESTION
    default:
      return ''
  }
}

function sanitizeTaskTextFields<T extends AiTaskFields>(task: T): T {
  const next = { ...task }

  if (next.question != null) {
    next.question = stripMetaTaskDescription(stripTheoryFromField(next.question))
  }

  if (next.options?.length) {
    next.options = next.options.map((option) => stripTheoryFromField(option))
  }

  if (next.gaps_text != null) {
    next.gaps_text = stripLeadingTheoryFromGaps(normalizeGapPlaceholders(next.gaps_text))
  }

  return next
}

function normalizeFillGapsTask<T extends AiTaskFields>(
  task: T,
  expectation?: string,
  sheetTopic?: string,
): T {
  let question = (task.question ?? '').trim()
  let gapsText = (task.gaps_text ?? '').trim()
  let gapsAnswers = task.gaps_answers
  const defaultQuestion = defaultQuestionForTaskType('fill_gaps', expectation)
  const brief = expectation?.trim() ?? ''

  if (!question) {
    question = defaultQuestion
  }

  if (brief && (questionMatchesPlanBrief(question, brief) || looksLikeAuthorPlanDescription(question))) {
    question = defaultQuestion
  }

  if (isGenericTopicFillGaps(gapsText, gapsAnswers)) {
    const built = fillGapsPayloadFromPlanBrief(brief || question, sheetTopic ?? '')
    gapsText = built.gaps_text
    gapsAnswers = built.gaps_answers
    if (
      !question ||
      questionMatchesPlanBrief(question, brief) ||
      looksLikeAuthorPlanDescription(question)
    ) {
      question = built.question
    }
  }

  if (gapsText) {
    const normalizedQuestion = normalizeWs(question)
    const normalizedGaps = normalizeWs(gapsText)

    if (normalizedQuestion === normalizedGaps) {
      question = defaultQuestion
    } else if (normalizedGaps.startsWith(normalizedQuestion) && normalizedQuestion.length > 50) {
      question = defaultQuestion
    } else if (looksLikeTheory(question)) {
      question = defaultQuestion
    }
  }

  question = finalizeQuestionText(question, 'fill_gaps', expectation)

  return { ...task, question, gaps_text: gapsText, gaps_answers: gapsAnswers }
}

function finalizeQuestionText(question: string, type: TaskType, expectation?: string): string {
  let value = stripMetaTaskDescription(question.trim())
  if (looksLikeAuthorPlanDescription(value)) {
    value = ''
  }
  if (isMissingTaskQuestion(value) || looksLikeBareTaskInstruction(value)) {
    value = defaultQuestionForTaskType(type, expectation)
  }
  if (containsMetaTaskDescription(value) || looksLikeAuthorPlanDescription(value)) {
    value = stripMetaTaskDescription(value)
    if (looksLikeAuthorPlanDescription(value) || containsMetaTaskDescription(value)) {
      value = defaultQuestionForTaskType(type, expectation)
    }
  }
  return value
}

function normalizeMatchingTask<T extends AiTaskFields>(task: T, expectation?: string): T {
  let question = finalizeQuestionText(task.question ?? '', 'matching', expectation)
  if (!question) {
    question = defaultQuestionForTaskType('matching', expectation)
  }
  return { ...task, question }
}

function normalizeQuestionTask<T extends AiTaskFields>(
  task: T,
  type: TaskType,
  expectation?: string,
): T {
  let question = finalizeQuestionText(task.question ?? '', type, expectation)
  if (isMissingTaskQuestion(question) || looksLikeBareTaskInstruction(question)) {
    question = defaultQuestionForTaskType(type, expectation)
  }
  return { ...task, question }
}

export function normalizeAiTask<T extends AiTaskFields>(
  task: T,
  type: TaskType,
  expectation?: string,
  sheetTopic?: string,
): T {
  const sanitized = sanitizeTaskTextFields(task)

  switch (type) {
    case 'fill_gaps':
      return normalizeFillGapsTask(sanitized, expectation, sheetTopic)
    case 'matching':
      return normalizeMatchingTask(sanitized, expectation)
    case 'grouping':
    case 'ordering':
    case 'short_answer':
    case 'extended_answer':
    case 'single_choice':
    case 'multiple_choice':
      return normalizeQuestionTask(sanitized, type, expectation)
    default:
      return sanitized
  }
}

export function getBlockQuestion(block: WorksheetBlock): string {
  if (block.type === 'fill_gaps') {
    let question = stripTheoryFromField(block.question?.trim() || DEFAULT_FILL_GAPS_QUESTION)
    const gapsText = block.gapsText?.trim() ?? ''

    if (gapsText) {
      if (normalizeWs(question) === normalizeWs(gapsText)) {
        return DEFAULT_FILL_GAPS_QUESTION
      }
      if (looksLikeTheory(question)) {
        return DEFAULT_FILL_GAPS_QUESTION
      }
    }

    return question || DEFAULT_FILL_GAPS_QUESTION
  }

  if (block.type === 'matching') {
    return stripTheoryFromField(block.question?.trim() || DEFAULT_MATCHING_QUESTION)
  }

  if (block.type === 'grouping') {
    const question = block.question?.trim()
    if (isMissingTaskQuestion(question)) {
      return DEFAULT_GROUPING_QUESTION
    }
    return stripTheoryFromField(question ?? '') || DEFAULT_GROUPING_QUESTION
  }

  if (block.type === 'ordering') {
    const question = stripTheoryFromField(block.question?.trim() ?? '')
    if (isMissingTaskQuestion(question)) {
      return DEFAULT_ORDERING_QUESTION
    }
    return question
  }

  if (block.type === 'short_answer') {
    const question = stripTheoryFromField(block.question?.trim() ?? '')
    if (isMissingTaskQuestion(question)) {
      return DEFAULT_SHORT_ANSWER_QUESTION
    }
    return question
  }

  if (block.type === 'extended_answer') {
    const question = stripTheoryFromField(block.question?.trim() ?? '')
    if (isMissingTaskQuestion(question)) {
      return DEFAULT_EXTENDED_ANSWER_QUESTION
    }
    return question
  }

  if (block.type === 'single_choice' || block.type === 'multiple_choice') {
    const question = stripTheoryFromField(block.question?.trim() ?? '')
    if (isMissingTaskQuestion(question)) {
      return DEFAULT_CHOICE_QUESTION
    }
    return question
  }

  if (block.type === 'text') {
    return block.body ?? ''
  }

  const question = stripTheoryFromField(block.question ?? block.body ?? '')
  return question
}
