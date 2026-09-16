import type { TaskType, WorksheetBlock } from './worksheet'

export interface AiTaskFields {
  type?: TaskType | string
  question?: string
  gaps_text?: string
  left_items?: string[]
  right_items?: string[]
  options?: string[]
}

export function normalizeWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function expectationToQuestion(expectation?: string): string {
  const value = expectation?.trim()
  if (!value) return ''

  return value
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
    /пишется|имеет значени|правил|приставк|определени|обозначается|обозначают|множеств.*букв|буквой\s*[A-ZА-ЯQNЗ]|любое целое|любое число|называется|называют|можно представить/i
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

const DEFAULT_FILL_GAPS_QUESTION = 'Заполните пропуски в тексте.'
const DEFAULT_MATCHING_QUESTION =
  'Сопоставьте элементы левого столбца с элементами правого.'

function defaultQuestionForType(type: TaskType, expectation?: string): string {
  const fromExpectation = expectationToQuestion(expectation)
  if (fromExpectation) return fromExpectation

  if (type === 'fill_gaps') return DEFAULT_FILL_GAPS_QUESTION
  if (type === 'matching') return DEFAULT_MATCHING_QUESTION
  return ''
}

function sanitizeTaskTextFields<T extends AiTaskFields>(task: T): T {
  const next = { ...task }

  if (next.question != null) {
    next.question = stripTheoryFromField(next.question)
  }

  if (next.options?.length) {
    next.options = next.options.map((option) => stripTheoryFromField(option))
  }

  if (next.gaps_text != null) {
    next.gaps_text = stripLeadingTheoryFromGaps(next.gaps_text)
  }

  return next
}

function normalizeFillGapsTask<T extends AiTaskFields>(
  task: T,
  expectation?: string,
): T {
  let question = (task.question ?? '').trim()
  const gapsText = (task.gaps_text ?? '').trim()
  const defaultQuestion = defaultQuestionForType('fill_gaps', expectation)

  if (!question) {
    question = defaultQuestion
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

  return { ...task, question, gaps_text: gapsText }
}

function normalizeMatchingTask<T extends AiTaskFields>(task: T, expectation?: string): T {
  let question = (task.question ?? '').trim()
  if (!question) {
    question = defaultQuestionForType('matching', expectation)
  }
  return { ...task, question }
}

export function normalizeAiTask<T extends AiTaskFields>(
  task: T,
  type: TaskType,
  expectation?: string,
): T {
  const sanitized = sanitizeTaskTextFields(task)

  switch (type) {
    case 'fill_gaps':
      return normalizeFillGapsTask(sanitized, expectation)
    case 'matching':
      return normalizeMatchingTask(sanitized, expectation)
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

  if (block.type === 'text') {
    return block.body ?? ''
  }

  return stripTheoryFromField(block.question ?? block.body ?? '')
}
