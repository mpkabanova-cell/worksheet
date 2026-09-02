import type { TaskType, WorksheetBlock } from './worksheet'

export interface AiTaskFields {
  type?: TaskType | string
  question?: string
  gaps_text?: string
  left_items?: string[]
  right_items?: string[]
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

export function looksLikeTheory(text: string): boolean {
  const value = text.trim()
  if (value.length < 60) return false

  const numberedRules = value.match(/\d\.\s/g)?.length ?? 0
  const hasNumberedRules = numberedRules >= 2
  const theoryKeywords = /пишется|имеет значени|правил|приставк|определени/i
  const hasNoBlanks = !value.includes('___') && !value.includes('_______')

  return hasNoBlanks && (hasNumberedRules || theoryKeywords.test(value))
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
  switch (type) {
    case 'fill_gaps':
      return normalizeFillGapsTask(task, expectation)
    case 'matching':
      return normalizeMatchingTask(task, expectation)
    default:
      return task
  }
}

export function getBlockQuestion(block: WorksheetBlock): string {
  if (block.type === 'fill_gaps') {
    let question = block.question?.trim() || DEFAULT_FILL_GAPS_QUESTION
    const gapsText = block.gapsText?.trim() ?? ''

    if (gapsText) {
      if (normalizeWs(question) === normalizeWs(gapsText)) {
        return DEFAULT_FILL_GAPS_QUESTION
      }
      if (looksLikeTheory(question)) {
        return DEFAULT_FILL_GAPS_QUESTION
      }
    }

    return question
  }

  if (block.type === 'matching') {
    return block.question?.trim() || DEFAULT_MATCHING_QUESTION
  }

  if (block.type === 'text') {
    return block.body ?? ''
  }

  return block.question ?? block.body ?? ''
}
