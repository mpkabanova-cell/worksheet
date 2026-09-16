import type {
  AnswerAreaStyle,
  ChoiceOption,
  ChoiceOptionFormat,
  MatchPair,
  WorksheetBlock,
  WorksheetDraft,
} from './worksheet'
import { uid } from './worksheet'
import {
  cellsRowsNeededForText,
  gapWordOccursOutsideMath,
  hasForbiddenGapsInFormulas,
  looksLikeMathPlainText,
  migrateGapsTextToSource,
  sanitizeGapsSourceText,
  splitMathSegments,
} from '@/data/mathTextUtils'
import { stripLeadingTheoryFromGaps, stripTheoryFromField } from '@/data/taskContent'

export const CHOICE_QUESTION_MAX = 500
export const CHOICE_OPTION_MAX = 300
export const CHOICE_OPTION_COUNT_DEFAULT = 4
export const CHOICE_OPTION_COUNT_MIN = 2
export const CHOICE_OPTION_COUNT_MAX = 10

export const CHOICE_FORMAT_LABELS: Record<ChoiceOptionFormat, string> = {
  text: 'Текст',
  image: 'Изображение',
  text_image: 'Текст и изображение',
}

export const CHOICE_OPTION_COUNT_OPTIONS = Array.from(
  { length: CHOICE_OPTION_COUNT_MAX - CHOICE_OPTION_COUNT_MIN + 1 },
  (_, index) => String(index + CHOICE_OPTION_COUNT_MIN),
)

export const CHOICE_FORMAT_OPTIONS = (Object.keys(CHOICE_FORMAT_LABELS) as ChoiceOptionFormat[]).map(
  (key) => CHOICE_FORMAT_LABELS[key],
)

const LABEL_TO_CHOICE_FORMAT: Record<string, ChoiceOptionFormat> = {
  Текст: 'text',
  Изображение: 'image',
  'Текст и изображение': 'text_image',
}

export function choiceFormatFromLabel(label: string): ChoiceOptionFormat {
  return LABEL_TO_CHOICE_FORMAT[label] ?? 'text'
}

export function choiceLabelFromFormat(format: ChoiceOptionFormat): string {
  return CHOICE_FORMAT_LABELS[format]
}

export function isChoiceBlock(block: WorksheetBlock): boolean {
  return block.type === 'single_choice' || block.type === 'multiple_choice'
}

export function getChoiceQuestionMaxLength(block: WorksheetBlock): number {
  return isChoiceBlock(block) ? CHOICE_QUESTION_MAX : QUESTION_MAX_LENGTH
}

export const QUESTION_MAX_LENGTH = 2000
export const TEXT_BODY_MAX_LENGTH = 10_000

export const ANSWER_QUESTION_PLACEHOLDER = 'Введите текст'
export const CHOICE_QUESTION_PLACEHOLDER = 'Введите вопрос…'

const QUESTION_PLACEHOLDERS = new Set([
  ANSWER_QUESTION_PLACEHOLDER,
  'Введите условие…',
  'Введите условие...',
  'Введите текст',
  'Введите текст…',
  CHOICE_QUESTION_PLACEHOLDER,
  'Введите вопрос...',
  'Введите вопрос…',
])

export function isQuestionPlaceholder(text: string): boolean {
  const value = text.trim()
  return !value || QUESTION_PLACEHOLDERS.has(value)
}

export function questionPlaceholderForBlock(block: WorksheetBlock): string {
  if (block.type === 'short_answer' || block.type === 'extended_answer') {
    return ANSWER_QUESTION_PLACEHOLDER
  }
  if (isChoiceBlock(block)) {
    return CHOICE_QUESTION_PLACEHOLDER
  }
  if (block.type === 'grouping') {
    return GROUPING_QUESTION_PLACEHOLDER
  }
  return 'Введите текст'
}

export const TABLE_ROWS_MIN = 2
export const TABLE_ROWS_MAX = 10
export const TABLE_ROWS_DEFAULT = 4
export const TABLE_COLS_MIN = 2
export const TABLE_COLS_MAX = 6
export const TABLE_COLS_DEFAULT = 3
export const GROUPING_HEADER_PLACEHOLDER = 'Название группы'
export const GROUPING_DEFAULT_QUESTION = 'Распределите элементы по группам.'
export const GROUPING_QUESTION_PLACEHOLDER = GROUPING_DEFAULT_QUESTION

export const ORDER_ITEMS_MIN = 2
export const ORDER_ITEMS_MAX = 10
export const ORDER_ITEM_COUNT_DEFAULT = 5

export const ORDER_ITEM_COUNT_OPTIONS = Array.from(
  { length: ORDER_ITEMS_MAX - ORDER_ITEMS_MIN + 1 },
  (_, index) => String(index + ORDER_ITEMS_MIN),
)

export const MATCHING_PAIRS_MIN = 2
export const MATCHING_PAIRS_MAX = 10
export const MATCHING_PAIR_COUNT_DEFAULT = 3

export const MATCHING_PAIR_COUNT_OPTIONS = Array.from(
  { length: MATCHING_PAIRS_MAX - MATCHING_PAIRS_MIN + 1 },
  (_, index) => String(index + MATCHING_PAIRS_MIN),
)

export const ANSWER_CELL_SIZE = 16

/** Линии: 2–10 строк. */
export const ANSWER_HEIGHT_LINES_MIN = 2
export const ANSWER_HEIGHT_LINES_MAX = 10
/** Клетки, блок, оси, координатная прямая, луч: 5–10. */
export const ANSWER_HEIGHT_COMPACT_MIN = 5
export const ANSWER_HEIGHT_COMPACT_MAX = 10

export const ANSWER_STYLE_LABELS: Record<AnswerAreaStyle, string> = {
  lines: 'Линии',
  cells: 'Клетки',
  block: 'Блок ответа',
  axes: 'Оси',
  number_line: 'Координатная прямая',
  ray: 'Луч',
}

const ANSWER_STYLE_ORDER: AnswerAreaStyle[] = [
  'lines',
  'cells',
  'block',
  'axes',
  'number_line',
  'ray',
]

export const ANSWER_STYLE_OPTIONS = ANSWER_STYLE_ORDER.map((s) => ANSWER_STYLE_LABELS[s])

const LABEL_TO_STYLE: Record<string, AnswerAreaStyle> = {
  Линии: 'lines',
  Клетки: 'cells',
  'Блок ответа': 'block',
  Блок: 'block',
  Оси: 'axes',
  'Координатная прямая': 'number_line',
  Луч: 'ray',
}

/** Предметы с клеточной областью (математика, информатика, физика, экономика). */
const STEM_GRID_SUBJECTS = new Set([
  'Математика',
  'Алгебра',
  'Алгебра и начала математического анализа',
  'Вероятность и статистика',
  'Геометрия',
  'Информатика',
  'Физика',
  'Экономика',
])

/** Математические предметы для осей, координатной прямой и луча. */
const MATH_GRAPH_SUBJECTS = new Set([
  'Математика',
  'Алгебра',
  'Алгебра и начала математического анализа',
  'Вероятность и статистика',
  'Геометрия',
])

export function answerStyleFromLabel(label: string): AnswerAreaStyle {
  return LABEL_TO_STYLE[label] ?? 'lines'
}

export function answerLabelFromStyle(style: AnswerAreaStyle): string {
  return ANSWER_STYLE_LABELS[style]
}

export function answerHeightFieldLabel(style: AnswerAreaStyle): string {
  if (style === 'lines') return 'Количество строк для ответа'
  return 'Высота блока'
}

export function answerHeightRange(style: AnswerAreaStyle): { min: number; max: number } {
  if (style === 'lines') {
    return { min: ANSWER_HEIGHT_LINES_MIN, max: ANSWER_HEIGHT_LINES_MAX }
  }
  return { min: ANSWER_HEIGHT_COMPACT_MIN, max: ANSWER_HEIGHT_COMPACT_MAX }
}

export function answerHeightOptionsForStyle(style: AnswerAreaStyle): string[] {
  const { min, max } = answerHeightRange(style)
  return Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
}

export function clampAnswerHeight(style: AnswerAreaStyle, value: number): number {
  const { min, max } = answerHeightRange(style)
  const n = Number.isFinite(value) ? value : min
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function defaultAnswerHeight(style: AnswerAreaStyle): number {
  return answerHeightRange(style).min
}

export function getDefaultBlockAnswerLines(block: WorksheetBlock, subject: string): number {
  const style = getBlockAnswerStyle(block, subject)
  const base = defaultAnswerHeight(style)
  if (block.type === 'extended_answer') {
    if (style === 'lines') return clampAnswerHeight(style, ANSWER_HEIGHT_LINES_MIN)
    return clampAnswerHeight(style, Math.min(ANSWER_HEIGHT_COMPACT_MAX, base + 3))
  }
  return base
}

export function getAvailableAnswerStyles(subject: string): AnswerAreaStyle[] {
  if (!subject) return [...ANSWER_STYLE_ORDER]
  const available = new Set<AnswerAreaStyle>(['block'])
  if (!STEM_GRID_SUBJECTS.has(subject)) {
    available.add('lines')
  }
  if (STEM_GRID_SUBJECTS.has(subject)) {
    available.add('cells')
  }
  if (MATH_GRAPH_SUBJECTS.has(subject)) {
    available.add('axes')
    available.add('number_line')
    available.add('ray')
  }
  return ANSWER_STYLE_ORDER.filter((style) => available.has(style))
}

export function answerStyleOptionsForSubject(subject: string): string[] {
  return getAvailableAnswerStyles(subject).map(answerLabelFromStyle)
}

export function getBlockAnswerStyle(block: WorksheetBlock, subject: string): AnswerAreaStyle {
  const available = getAvailableAnswerStyles(subject)
  const stored = block.answerAreaStyle
  if (stored && available.includes(stored)) return stored
  const fallback = defaultAnswerStyle(subject)
  return available.includes(fallback) ? fallback : available[0] ?? 'block'
}

export function reconcileAnswerBlockStyle(block: WorksheetBlock, subject: string): WorksheetBlock {
  const style = getBlockAnswerStyle(block, subject)
  return {
    ...block,
    answerAreaStyle: style,
    answerLines: clampAnswerHeight(style, block.answerLines ?? defaultAnswerHeight(style)),
  }
}

export function getCorrectAnswerText(block: WorksheetBlock): string {
  if (!block.correctAnswers?.length) return ''
  if (block.correctAnswers.length === 1) return block.correctAnswers[0]
  return block.correctAnswers.join('\n')
}

/** Текст эталона для отображения (без служебного префикса «Ответ:»). */
export function getDisplayAnswerText(block: WorksheetBlock): string {
  return getCorrectAnswerText(block)
    .replace(/^Ответ\s*:\s*/i, '')
    .trim()
}

const ANSWER_CHARS_PER_LINE = 72

function linesNeededForAnswerText(text: string, style: AnswerAreaStyle): number {
  if (!text.trim()) return 0
  const paragraphs = text.split(/\n/)
  if (style === 'lines' || style === 'block') {
    return paragraphs.reduce(
      (sum, paragraph) =>
        sum + Math.max(1, Math.ceil(paragraph.length / ANSWER_CHARS_PER_LINE)),
      0,
    )
  }
  if (style === 'cells' || style === 'axes' || style === 'number_line' || style === 'ray') {
    return cellsRowsNeededForText(text)
  }
  return paragraphs.reduce((sum, paragraph) => sum + Math.max(1, paragraph.length > 0 ? 1 : 0), 0)
}

export function getConfiguredAnswerLines(block: WorksheetBlock, subject: string): number {
  const style = getBlockAnswerStyle(block, subject)
  return clampAnswerHeight(
    style,
    block.answerLines ?? getDefaultBlockAnswerLines(block, subject),
  )
}

/** Высота области ответа с учётом эталона (show answer / inline-редактирование). */
export function getEffectiveAnswerLines(
  block: WorksheetBlock,
  subject: string,
  expandForAnswer: boolean,
): number {
  const style = getBlockAnswerStyle(block, subject)
  const configured = getConfiguredAnswerLines(block, subject)
  if (!expandForAnswer) return configured
  const needed = linesNeededForAnswerText(getDisplayAnswerText(block), style)
  if (!needed) return configured
  return clampAnswerHeight(style, Math.max(configured, needed))
}

export function clampText(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

function asText(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

/** Приводит блок к безопасному виду после ответа модели (защита от падения UI). */
export function sanitizeBlock(block: WorksheetBlock): WorksheetBlock {
  const baseOptions = block.options?.map((option, index) => ({
    id: option.id || `option_${index + 1}`,
    text: clampText(stripTheoryFromField(asText(option.text) ?? ''), CHOICE_OPTION_MAX),
    imageData: option.imageData,
    imageFileName: asText(option.imageFileName),
  }))

  const choiceExtras = isChoiceBlock(block)
    ? (() => {
        const normalized: WorksheetBlock = {
          ...block,
          choiceOptionFormat: block.choiceOptionFormat ?? 'text',
          choiceOptionCount: clampChoiceOptionCount(
            block.choiceOptionCount ?? block.options?.length ?? CHOICE_OPTION_COUNT_DEFAULT,
          ),
          choiceShuffle: block.choiceShuffle ?? false,
        }
        return {
          choiceOptionFormat: normalized.choiceOptionFormat,
          choiceOptionCount: normalized.choiceOptionCount,
          choiceShuffle: normalized.choiceShuffle,
          options: resizeChoiceOptions(normalized, baseOptions ?? []),
        }
      })()
    : {}

  const sanitized: WorksheetBlock = {
    ...block,
    question: stripTheoryFromField(asText(block.question) ?? ''),
    body: asText(block.body),
    instruction: asText(block.instruction) ?? '',
    options: baseOptions,
    ...choiceExtras,
    leftItems: block.leftItems?.map((item, index) => ({
      id: item.id || `left_${index + 1}`,
      text: asText(item.text) ?? '',
      imageData: item.imageData,
      imageFileName: asText(item.imageFileName),
    })),
    rightItems: block.rightItems?.map((item, index) => ({
      id: item.id || `right_${index + 1}`,
      text: asText(item.text) ?? '',
      imageData: item.imageData,
      imageFileName: asText(item.imageFileName),
    })),
    groups: block.groups?.map((group, index) => ({
      id: group.id || `g${index + 1}`,
      title: asText(group.title) ?? '',
      items: Array.isArray(group.items)
        ? group.items.map((item) => asText(item) ?? '').filter(Boolean)
        : [],
    })),
    orderItems: Array.isArray(block.orderItems)
      ? block.orderItems.map((item) => asText(item) ?? '')
      : block.orderItems,
    ...(block.type === 'ordering' ? { orderShuffle: block.orderShuffle ?? true } : {}),
    gapsText: block.gapsText != null ? stripLeadingTheoryFromGaps(asText(block.gapsText) ?? '') : undefined,
    gapsSourceText: block.gapsSourceText != null
      ? stripLeadingTheoryFromGaps(asText(block.gapsSourceText) ?? '')
      : undefined,
    gapsAnswers: Array.isArray(block.gapsAnswers)
      ? block.gapsAnswers.map((item) => asText(item) ?? '').filter(Boolean)
      : block.gapsAnswers,
    correctAnswers: Array.isArray(block.correctAnswers)
      ? block.correctAnswers.map((item) => asText(item) ?? '').filter(Boolean)
      : block.correctAnswers,
    ...(block.type === 'short_answer' || block.type === 'extended_answer'
      ? {
          answerLines: clampAnswerHeight(
            getBlockAnswerStyle(block, ''),
            block.answerLines ?? defaultAnswerHeight(getBlockAnswerStyle(block, '')),
          ),
        }
      : {}),
  }

  if (sanitized.type === 'fill_gaps' && Array.isArray(sanitized.gapsAnswers)) {
    const rawSource = sanitized.gapsSourceText?.trim()
      ? sanitized.gapsSourceText
      : sanitized.gapsText?.trim()
        ? migrateGapsTextToSource(sanitized.gapsText, sanitized.gapsAnswers ?? [])
        : ''
    const source = sanitizeGapsSourceText(rawSource)
    sanitized.gapsSourceText = source
    sanitized.gapsText = undefined
    sanitized.gapsAnswers = sanitizeGapAnswers(source, sanitized.gapsAnswers)
    return rejectInvalidFillGapsBlock(sanitized)
  }

  if (sanitized.type === 'matching') {
    return rejectInvalidMatchingBlock(normalizeMatchingBlock(sanitized))
  }

  if (sanitized.type === 'grouping' || sanitized.type === 'table') {
    return normalizeGroupingBlock(sanitized)
  }

  return sanitized
}

function rejectInvalidFillGapsBlock(block: WorksheetBlock): WorksheetBlock {
  if (block.type !== 'fill_gaps') return block
  if (isValidFillGapsBlock(block)) return block

  const source =
    getGapsSourceText(block) || block.gapsSourceText?.trim() || block.gapsText?.trim() || ''
  const question = block.question?.trim() || 'Заполните пропуски в тексте.'

  return {
    ...block,
    type: 'text',
    body: source.trim() || question,
    question: undefined,
    gapsSourceText: undefined,
    gapsText: undefined,
    gapsAnswers: undefined,
    gapsShuffleAnswers: undefined,
  }
}

function parseMatchingPairsFromAnswers(
  block: WorksheetBlock,
): { leftIndex: number; rightIndex: number }[] {
  const left = block.leftItems ?? []
  const right = block.rightItems ?? []
  const answers = (block.correctAnswers ?? []).map((answer) => answer.trim()).filter(Boolean)
  const usedRightIndices = new Set<number>()
  const pairs: { leftIndex: number; rightIndex: number }[] = []

  const findRightIndex = (raw: string): number => {
    const index = findMatchingRightIndex(raw, right, right, usedRightIndices)
    if (index >= 0) usedRightIndices.add(index)
    return index
  }

  for (const answer of answers) {
    const idMatch = answer.match(/^(left_\d+)\s*(?:→|->)\s*(right_\d+)/i)
    if (idMatch) {
      const leftIndex = findMatchingIndexedSide('left', idMatch[1], left)
      const rightIndex = findMatchingIndexedSide('right', idMatch[2], right)
      if (leftIndex < 0 || rightIndex < 0) continue
      if (usedRightIndices.has(rightIndex)) continue
      usedRightIndices.add(rightIndex)
      pairs.push({ leftIndex, rightIndex })
      continue
    }

    const parts = answer.split(/\s*(?:→|->)\s*/)
    if (parts.length !== 2) continue

    let leftIndex = left.findIndex(
      (item) => normalizeMatchText(item.text) === normalizeMatchText(parts[0]),
    )
    if (leftIndex < 0) {
      leftIndex = findMatchingIndexedSide('left', parts[0], left)
    }
    const rightIndex = findRightIndex(parts[1])
    if (leftIndex < 0 || rightIndex < 0) continue
    pairs.push({ leftIndex, rightIndex })
  }

  return pairs
}

export function looksLikeAmbiguousSetMatching(block: WorksheetBlock): boolean {
  if (block.type !== 'matching') return false

  const question = normalizeMatchText(block.question ?? '')
  if (/наименьш/i.test(question) && /множеств/i.test(question)) return true

  const rightLabels = (block.rightItems ?? []).map((item) => item.text.toLowerCase())
  const numberSetLabels = ['рациональн', 'цел', 'натуральн', 'действительн', 'иррациональн']
  const setLabelCount = rightLabels.filter((label) =>
    numberSetLabels.some((keyword) => label.includes(keyword)),
  ).length

  const leftHasNumbers = (block.leftItems ?? []).some((item) => {
    const text = item.text.trim()
    return /^-?\d+([,.]\d+)?$/.test(text) || /\$[^$]*\d[^$]*\$/.test(text)
  })

  return setLabelCount >= 2 && leftHasNumbers
}

export function isMatchingBijective(block: WorksheetBlock): boolean {
  if (block.type !== 'matching') return true

  const rowCount = getMatchingRowCount(block)
  if (rowCount === 0) return false

  const pairs = parseMatchingPairsFromAnswers(block)
  if (pairs.length !== rowCount) return false

  const leftUsed = new Set<number>()
  const rightUsed = new Set<number>()

  for (const { leftIndex, rightIndex } of pairs) {
    if (leftIndex < 0 || leftIndex >= rowCount || rightIndex < 0 || rightIndex >= rowCount) {
      return false
    }
    if (leftUsed.has(leftIndex) || rightUsed.has(rightIndex)) return false
    leftUsed.add(leftIndex)
    rightUsed.add(rightIndex)
  }

  return leftUsed.size === rowCount && rightUsed.size === rowCount
}

export function isValidMatchingBlock(block: WorksheetBlock): boolean {
  if (block.type !== 'matching') return true
  if (looksLikeAmbiguousSetMatching(block)) return false
  return isMatchingBijective(block)
}

function stripMatchingBlockFields(block: WorksheetBlock): WorksheetBlock {
  return {
    ...block,
    leftItems: undefined,
    rightItems: undefined,
    matchingPairCount: undefined,
    matchingLeftFormat: undefined,
    matchingRightFormat: undefined,
    matchingShuffleRight: undefined,
    matchingDisplayRight: undefined,
    correctAnswers: undefined,
    groups: undefined,
  }
}

function buildGroupingFromClassification(
  block: WorksheetBlock,
  question: string,
  leftTexts: string[],
  rightTexts: string[],
): WorksheetBlock {
  const uniqueRight = [...new Set(rightTexts.map((text) => text.trim()).filter(Boolean))]
  const cols = clampTableCols(Math.max(uniqueRight.length, TABLE_COLS_MIN))
  const headers = Array.from({ length: cols }, (_, index) =>
    uniqueRight[index] || GROUPING_HEADER_PLACEHOLDER,
  )
  let rows = clampTableRows(
    Math.max(TABLE_ROWS_DEFAULT, leftTexts.filter(Boolean).length),
  )
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))

  for (const answer of block.correctAnswers ?? []) {
    const parts = answer.split(/\s*(?:→|->)\s*/)
    if (parts.length !== 2) continue
    const leftText = parts[0].trim()
    const rightText = parts[1].trim()
    const colIndex = headers.findIndex(
      (header) => normalizeMatchText(header) === normalizeMatchText(rightText),
    )
    if (colIndex < 0 || !leftText) continue
    let rowIndex = cells.findIndex((row) => !row[colIndex]?.trim())
    if (rowIndex < 0) {
      cells.push(Array.from({ length: cols }, () => ''))
      rowIndex = cells.length - 1
    }
    cells[rowIndex][colIndex] = leftText
    rows = Math.max(rows, cells.length)
  }

  return stripMatchingBlockFields({
    ...block,
    type: 'grouping',
    question: question.trim() || GROUPING_DEFAULT_QUESTION,
    tableRows: clampTableRows(cells.length),
    tableCols: cols,
    tableHeaders: headers,
    tableCells: cells.slice(0, rows),
    tableAnswerBank: [...new Set(leftTexts.map((text) => text.trim()).filter(Boolean))],
    tableShowAnswerBank: block.tableShowAnswerBank ?? true,
    tableShuffleAnswers: block.tableShuffleAnswers ?? true,
  })
}

function convertMatchingToGrouping(block: WorksheetBlock): WorksheetBlock {
  const leftTexts = (block.leftItems ?? []).map((item) => item.text.trim()).filter(Boolean)
  const rightTexts = (block.rightItems ?? []).map((item) => item.text.trim()).filter(Boolean)
  if (!leftTexts.length || !rightTexts.length) {
    return stripMatchingBlockFields({
      ...block,
      type: 'grouping',
      question: block.question?.trim() || GROUPING_DEFAULT_QUESTION,
      ...createDefaultGroupingTableFields(),
    })
  }

  return buildGroupingFromClassification(
    block,
    block.question?.trim() || GROUPING_DEFAULT_QUESTION,
    leftTexts,
    rightTexts,
  )
}

export function looksLikeRejectedMatchingDump(text: string): boolean {
  const value = text.trim()
  if (!value || !/^Сопостав/i.test(value)) return false
  return value.includes('•') || /\n\s*•\s*/.test(value)
}

function rejectInvalidMatchingBlock(block: WorksheetBlock): WorksheetBlock {
  if (block.type !== 'matching') return block
  if (isValidMatchingBlock(block)) return block
  return convertMatchingToGrouping(block)
}

export function sanitizeBlocks(blocks: WorksheetBlock[]): WorksheetBlock[] {
  return blocks
    .filter((block) => block.type !== 'text' || !looksLikeRejectedMatchingDump(block.body ?? ''))
    .map(sanitizeBlock)
}

export function normalizeWorksheetDraft(draft: WorksheetDraft): WorksheetDraft {
  return {
    ...draft,
    blocks: sanitizeBlocks(draft.blocks ?? []),
  }
}

export function defaultAnswerStyle(subject: string): AnswerAreaStyle {
  return STEM_GRID_SUBJECTS.has(subject) ? 'cells' : 'lines'
}

export function cloneBlock(block: WorksheetBlock): WorksheetBlock {
  return {
    ...block,
    id: uid(),
    issued: false,
    options: block.options?.map((option) => ({ ...option })),
    leftItems: block.leftItems?.map((item) => ({ ...item })),
    rightItems: block.rightItems?.map((item) => ({ ...item })),
    groups: block.groups?.map((group) => ({
      ...group,
      items: [...group.items],
    })),
    orderItems: block.orderItems ? [...block.orderItems] : block.orderItems,
    orderShuffle: block.orderShuffle,
    gapsAnswers: block.gapsAnswers ? [...block.gapsAnswers] : block.gapsAnswers,
    correctAnswers: block.correctAnswers ? [...block.correctAnswers] : block.correctAnswers,
    correctOptionIds: block.correctOptionIds ? [...block.correctOptionIds] : block.correctOptionIds,
    choiceDisplayOrder: block.choiceDisplayOrder ? [...block.choiceDisplayOrder] : block.choiceDisplayOrder,
    tableCells: block.tableCells?.map((row) => [...row]),
    tableHeaders: block.tableHeaders ? [...block.tableHeaders] : block.tableHeaders,
    tableAnswerBank: block.tableAnswerBank ? [...block.tableAnswerBank] : block.tableAnswerBank,
    orderDisplayItems: block.orderDisplayItems ? [...block.orderDisplayItems] : block.orderDisplayItems,
    orderDisplayOrder: block.orderDisplayOrder ? [...block.orderDisplayOrder] : block.orderDisplayOrder,
    matchingDisplayRight: block.matchingDisplayRight?.map((item) => ({ ...item })),
  }
}

export function shuffleArray<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** Stable shuffle for student view (same order until block id changes). */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0
    const j = hash % (i + 1)
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function gapUnderscore(word: string): string {
  const len = Math.max(7, word.length + 3)
  return '_'.repeat(len)
}

function isGapWordChar(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch)
}

function findGapWordOccurrence(text: string, word: string, fromIndex = 0): number {
  let idx = fromIndex
  while (idx < text.length) {
    const found = text.indexOf(word, idx)
    if (found < 0) return -1

    const before = found > 0 ? text[found - 1]! : ''
    const after = found + word.length < text.length ? text[found + word.length]! : ''
    if (!isGapWordChar(before) && !isGapWordChar(after)) return found

    idx = found + 1
  }
  return -1
}

function replaceFirstGapWordOccurrence(text: string, word: string, replacement: string): string {
  const idx = findGapWordOccurrence(text, word)
  if (idx < 0) return text
  return `${text.slice(0, idx)}${replacement}${text.slice(idx + word.length)}`
}

function gapWordsByLengthDesc(words: string[]): string[] {
  return [...words].sort((a, b) => b.length - a.length)
}

export function sanitizeGapAnswers(sourceText: string, gapWords: string[]): string[] {
  return gapWords.filter((word) => gapWordOccursOutsideMath(sourceText, word))
}

function mapEditablePlainSegments(
  sourceText: string,
  gapWords: string[],
  mapPlain: (plain: string, validGapWords: string[]) => string,
): string {
  const validGapWords = sanitizeGapAnswers(sourceText, gapWords)
  if (!validGapWords.length) return sourceText

  return splitMathSegments(sourceText)
    .map((segment) => {
      if (segment.kind === 'math') {
        return segment.display ? `$$${segment.value}$$` : `$${segment.value}$`
      }
      if (looksLikeMathPlainText(segment.value)) {
        return segment.value
      }
      return mapPlain(segment.value, validGapWords)
    })
    .join('')
}

export function markGapAnswersInText(sourceText: string, gapWords: string[]): string {
  return mapEditablePlainSegments(sourceText, gapWords, (plain, validGapWords) => {
    let next = plain
    for (const word of gapWordsByLengthDesc(validGapWords)) {
      const wrapped = `<u>${word}</u>`
      if (next.includes(wrapped)) continue
      next = replaceFirstGapWordOccurrence(next, word, wrapped)
    }
    return next
  })
}

export function renderGapsStudentText(sourceText: string, gapWords: string[]): string {
  if (!sourceText.trim()) return ''
  return mapEditablePlainSegments(sourceText, gapWords, (plain, validGapWords) => {
    let next = plain
    for (const word of gapWordsByLengthDesc(validGapWords)) {
      next = replaceFirstGapWordOccurrence(next, word, gapUnderscore(word))
    }
    return next
  })
}

export function tokenizeGapText(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? []
}

export function getGapsSourceText(block: WorksheetBlock): string {
  if (block.gapsSourceText?.trim()) {
    return sanitizeGapsSourceText(block.gapsSourceText)
  }
  if (block.gapsText?.trim()) {
    return sanitizeGapsSourceText(
      migrateGapsTextToSource(block.gapsText, block.gapsAnswers ?? []),
    )
  }
  return ''
}

export function getFillGapsValidationError(block: WorksheetBlock): string | null {
  if (block.type !== 'fill_gaps') return null
  const source = getGapsSourceText(block)
  if (!source.trim()) return 'empty'
  if (hasForbiddenGapsInFormulas(source, block.gapsAnswers ?? [])) return 'gaps_in_formulas'
  if (getValidGapAnswers(block).length === 0) return 'no_valid_gaps'
  return null
}

export function isValidFillGapsBlock(block: WorksheetBlock): boolean {
  return getFillGapsValidationError(block) == null
}

export function getValidGapAnswers(block: WorksheetBlock): string[] {
  return sanitizeGapAnswers(getGapsSourceText(block), block.gapsAnswers ?? [])
}

export function getGapsStudentText(block: WorksheetBlock): string {
  const source = getGapsSourceText(block)
  const gapWords = getValidGapAnswers(block)
  return renderGapsStudentText(source, gapWords)
}

export function getGapsDisplayAnswers(
  block: WorksheetBlock,
  editable: boolean,
  selected: boolean,
): string[] {
  const answers = getValidGapAnswers(block)
  if (!answers.length) return []
  if (editable && selected) return answers
  if (!block.gapsShuffleAnswers) return answers
  return stableShuffle(answers, `${block.id}-gaps`)
}

export function getOrderDisplayItems(
  block: WorksheetBlock,
  editable: boolean,
  selected: boolean,
): string[] {
  const items = block.orderItems ?? []
  const order = getOrderDisplayOrder(block, editable, selected)
  return order.map((index) => items[index] ?? '')
}

function deriveOrderIndices(correctItems: string[], displayItems: string[]): number[] {
  const used = new Set<number>()
  return displayItems.map((item) => {
    for (let i = 0; i < correctItems.length; i += 1) {
      if (used.has(i)) continue
      if (correctItems[i] === item) {
        used.add(i)
        return i
      }
    }
    return 0
  })
}

export function getOrderDisplayOrder(
  block: WorksheetBlock,
  editable: boolean,
  selected: boolean,
): number[] {
  const items = block.orderItems ?? []
  const count = items.length
  if (count === 0) return []
  if (editable && selected) return items.map((_, index) => index)
  if (block.orderShuffle === false) return items.map((_, index) => index)
  if (block.orderDisplayOrder?.length === count) return block.orderDisplayOrder
  if (block.orderDisplayItems?.length === count) {
    return deriveOrderIndices(items, block.orderDisplayItems)
  }
  return stableShuffle(
    Array.from({ length: count }, (_, index) => index),
    block.id,
  )
}

export function getOrderAnswerNumbers(block: WorksheetBlock): number[] {
  return getOrderDisplayOrder(block, false, false).map((index) => index + 1)
}

export function shuffleOrderDisplay(items: string[]): {
  orderDisplayItems: string[]
  orderDisplayOrder: number[]
} {
  const order = shuffleArray(Array.from({ length: items.length }, (_, index) => index))
  return {
    orderDisplayOrder: order,
    orderDisplayItems: order.map((index) => items[index] ?? ''),
  }
}

export function getMatchingRightItems(
  block: WorksheetBlock,
  editable: boolean,
  selected: boolean,
) {
  const items = block.rightItems ?? []
  if (editable && selected) return items
  if (block.matchingShuffleRight === false) return items
  if (block.matchingDisplayRight?.length === items.length) return block.matchingDisplayRight
  return stableShuffle(items, `${block.id}-right`)
}

export function normalizeMatchText(value: string): string {
  return value
    .trim()
    .replace(/^["'«]|["'»]$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function findMatchingIndexedSide(prefix: 'left' | 'right', token: string, items: { id: string }[]): number {
  const trimmed = token.trim()
  const byId = items.findIndex((item) => item.id === trimmed)
  if (byId >= 0) return byId

  const indexMatch = trimmed.match(new RegExp(`^${prefix}_(\\d+)$`, 'i'))
  if (indexMatch) {
    const index = Number.parseInt(indexMatch[1], 10) - 1
    if (index >= 0 && index < items.length) return index
  }
  return -1
}

function findMatchingRightIndex(
  raw: string,
  displayRight: { id: string; text: string }[],
  canonicalRight: { id: string; text: string }[],
  usedRightIndices?: Set<number>,
): number {
  const bySide = findMatchingIndexedSide('right', raw, displayRight)
  if (bySide >= 0 && !usedRightIndices?.has(bySide)) return bySide

  const normalized = normalizeMatchText(raw)
  for (let index = 0; index < displayRight.length; index += 1) {
    if (usedRightIndices?.has(index)) continue
    if (normalizeMatchText(displayRight[index].text) === normalized) return index
  }

  const canonicalIndex = canonicalRight.findIndex(
    (item) => normalizeMatchText(item.text) === normalized || item.id === raw.trim(),
  )
  if (canonicalIndex < 0) return -1
  const target = canonicalRight[canonicalIndex]
  for (let index = 0; index < displayRight.length; index += 1) {
    if (usedRightIndices?.has(index)) continue
    if (displayRight[index].id === target.id) return index
  }
  return -1
}

function matchingItemHasContent(item: MatchPair, text: string): boolean {
  return Boolean(text.trim() || item.imageData)
}

function getMatchingAnswerTextFromCorrectAnswers(
  block: WorksheetBlock,
  side: 'left' | 'right',
  index: number,
  displayRight: MatchPair[],
): string {
  const left = block.leftItems ?? []
  const canonicalRight = block.rightItems ?? []
  const answers = (block.correctAnswers ?? []).map((answer) => answer.trim()).filter(Boolean)

  for (const answer of answers) {
    const idMatch = answer.match(/^(left_\d+)\s*(?:→|->)\s*(right_\d+)/i)
    if (idMatch) {
      const leftIndex = findMatchingIndexedSide('left', idMatch[1], left)
      const rightIndex = findMatchingIndexedSide('right', idMatch[2], displayRight)
      if (side === 'left' && leftIndex === index) {
        return left[leftIndex]?.text?.trim() || left[leftIndex]?.text || ''
      }
      if (side === 'right' && rightIndex === index) {
        const canonicalIndex = findMatchingIndexedSide('right', idMatch[2], canonicalRight)
        return (
          displayRight[rightIndex]?.text?.trim() ||
          canonicalRight[canonicalIndex]?.text?.trim() ||
          displayRight[rightIndex]?.text ||
          canonicalRight[canonicalIndex]?.text ||
          ''
        )
      }
      continue
    }

    const parts = answer.split(/\s*(?:→|->)\s*/)
    if (parts.length !== 2) continue

    let leftIndex = left.findIndex(
      (item) => normalizeMatchText(item.text) === normalizeMatchText(parts[0]),
    )
    if (leftIndex < 0) {
      leftIndex = findMatchingIndexedSide('left', parts[0], left)
    }
    const rightIndex = findMatchingRightIndex(parts[1], displayRight, canonicalRight)

    if (side === 'left' && leftIndex === index) return parts[0].trim()
    if (side === 'right' && rightIndex === index) return parts[1].trim()
  }

  return ''
}

export function resolveMatchingExportText(
  block: WorksheetBlock,
  side: 'left' | 'right',
  index: number,
  item: MatchPair,
  displayRight: MatchPair[],
  showAnswer: boolean,
): string {
  if (item.text?.trim()) return item.text
  if (item.imageData) return item.text ?? ''

  if (showAnswer) {
    const fromAnswers = getMatchingAnswerTextFromCorrectAnswers(block, side, index, displayRight)
    if (fromAnswers.trim()) return fromAnswers
  }

  return item.text ?? ''
}

export function getMatchingExportRows(
  block: WorksheetBlock,
  displayRight: MatchPair[],
  showAnswer: boolean,
): { index: number; left: MatchPair; right: MatchPair }[] {
  const left = block.leftItems ?? []
  const rowCount = getMatchingRowCount(block)
  const rows: { index: number; left: MatchPair; right: MatchPair }[] = []

  for (let index = 0; index < rowCount; index += 1) {
    const leftItem = left[index] ?? { id: `left-${index}`, text: '' }
    const rightItem = displayRight[index] ?? { id: `right-${index}`, text: '' }
    const leftText = resolveMatchingExportText(block, 'left', index, leftItem, displayRight, showAnswer)
    const rightText = resolveMatchingExportText(block, 'right', index, rightItem, displayRight, showAnswer)
    const resolvedLeft = { ...leftItem, text: leftText }
    const resolvedRight = { ...rightItem, text: rightText }

    if (!matchingItemHasContent(resolvedLeft, leftText) && !matchingItemHasContent(resolvedRight, rightText)) {
      continue
    }

    rows.push({ index, left: resolvedLeft, right: resolvedRight })
  }

  return rows
}

export function getMatchingCorrectLinks(
  block: WorksheetBlock,
  displayRight: { id: string; text: string }[],
): { leftIndex: number; rightIndex: number }[] {
  const left = block.leftItems ?? []
  const canonicalRight = block.rightItems ?? []
  const usedRightIndices = new Set<number>()

  const findRightIndex = (raw: string): number => {
    const index = findMatchingRightIndex(raw, displayRight, canonicalRight, usedRightIndices)
    if (index >= 0) usedRightIndices.add(index)
    return index
  }

  const positionalLinks = () => {
    usedRightIndices.clear()
    return left
      .map((_, leftIndex) => {
        const target = canonicalRight[leftIndex]
        if (!target) return { leftIndex, rightIndex: -1 }
        const rightIndex = findMatchingRightIndex(
          target.id,
          displayRight,
          canonicalRight,
          usedRightIndices,
        )
        if (rightIndex >= 0) usedRightIndices.add(rightIndex)
        return { leftIndex, rightIndex }
      })
      .filter((pair) => pair.rightIndex >= 0)
  }

  const answers = (block.correctAnswers ?? []).map((answer) => answer.trim()).filter(Boolean)
  if (answers.length) {
    usedRightIndices.clear()
    const parsed = answers
      .map((answer) => {
        const idMatch = answer.match(/^(left_\d+)\s*(?:→|->)\s*(right_\d+)/i)
        if (idMatch) {
          const leftIndex = findMatchingIndexedSide('left', idMatch[1], left)
          const rightIndex = findMatchingIndexedSide('right', idMatch[2], displayRight)
          if (rightIndex >= 0 && usedRightIndices.has(rightIndex)) {
            return { leftIndex: -1, rightIndex: -1 }
          }
          if (rightIndex >= 0) usedRightIndices.add(rightIndex)
          return { leftIndex, rightIndex }
        }

        const parts = answer.split(/\s*(?:→|->)\s*/)
        if (parts.length === 2) {
          let leftIndex = left.findIndex(
            (item) => normalizeMatchText(item.text) === normalizeMatchText(parts[0]),
          )
          if (leftIndex < 0) {
            leftIndex = findMatchingIndexedSide('left', parts[0], left)
          }
          return { leftIndex, rightIndex: findRightIndex(parts[1]) }
        }

        return { leftIndex: -1, rightIndex: -1 }
      })
      .filter((pair) => pair.leftIndex >= 0 && pair.rightIndex >= 0)

    if (parsed.length > 0) return parsed
  }

  return positionalLinks()
}

export function getTableAnswerBank(block: WorksheetBlock, editable: boolean, selected: boolean): string[] {
  const bank = block.tableAnswerBank ?? []
  if (!block.tableShowAnswerBank) return []
  if (editable && selected) return bank
  if (block.tableShuffleAnswers) return stableShuffle(bank, `${block.id}-table`)
  return bank
}

export function countTaskBlocksBefore(blocks: WorksheetBlock[], page: number, beforeIndex: number): number {
  let count = 0
  for (let p = 0; p < page; p += 1) {
    count += blocks.filter(
      (b) =>
        b.page === p &&
        b.type !== 'page_break' &&
        b.type !== 'text' &&
        b.type !== 'answer_field',
    ).length
  }
  const pageBlocks = blocks.filter((b) => b.page === page)
  for (let i = 0; i < beforeIndex && i < pageBlocks.length; i += 1) {
    const b = pageBlocks[i]
    if (b.type !== 'page_break' && b.type !== 'text' && b.type !== 'answer_field') {
      count += 1
    }
  }
  return count
}

export function pageBlockCount(blocks: WorksheetBlock[], page: number): number {
  return blocks.filter((b) => b.page === page).length
}

export function isPageEmpty(blocks: WorksheetBlock[], page: number): boolean {
  return pageBlockCount(blocks, page) === 0
}

export function removePageFromDraft<T extends { pages: number; blocks: WorksheetBlock[] }>(
  draft: T,
  pageToRemove: number,
): T {
  const blocks = draft.blocks
    .filter((b) => b.page !== pageToRemove)
    .map((b) => (b.page > pageToRemove ? { ...b, page: b.page - 1 } : b))
  return {
    ...draft,
    pages: Math.max(1, draft.pages - 1),
    blocks,
  }
}

/** Перераспределяет блоки по страницам относительно маркеров page_break. */
export function syncPagesFromBreaks(draft: WorksheetDraft): WorksheetDraft {
  if (!draft.blocks.length) {
    return { ...draft, pages: Math.max(1, draft.pages) }
  }

  const ordered = [...draft.blocks].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    return draft.blocks.indexOf(a) - draft.blocks.indexOf(b)
  })

  let page = 0
  const blocks = ordered.map((block) => {
    if (block.type === 'page_break') {
      const synced = { ...block, page }
      page += 1
      return synced
    }
    return { ...block, page }
  })

  const maxPage = blocks.reduce((max, block) => Math.max(max, block.page), 0)
  const pages = Math.max(1, maxPage + 1)

  const unchanged =
    pages === draft.pages &&
    blocks.every((block) => {
      const prev = draft.blocks.find((b) => b.id === block.id)
      return prev && prev.page === block.page
    })

  if (unchanged) return draft

  return { ...draft, blocks, pages }
}

export function qrCodeUrl(data: string, size = 160): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

export function clampTableRows(n: number): number {
  return Math.max(TABLE_ROWS_MIN, Math.min(TABLE_ROWS_MAX, n))
}

export function clampTableCols(n: number): number {
  return Math.max(TABLE_COLS_MIN, Math.min(TABLE_COLS_MAX, n))
}

export function isGroupingTableBlock(block: WorksheetBlock): boolean {
  return block.type === 'grouping' || block.type === 'table'
}

export function groupsToTableFields(
  groups: { title?: string; items?: string[] }[],
): Pick<
  WorksheetBlock,
  'tableRows' | 'tableCols' | 'tableHeaders' | 'tableCells' | 'tableAnswerBank'
> {
  const cols = clampTableCols(groups.length || TABLE_COLS_DEFAULT)
  const headers = Array.from({ length: cols }, (_, index) =>
    groups[index]?.title?.trim() || GROUPING_HEADER_PLACEHOLDER,
  )
  const itemRows = groups.slice(0, cols).map((group) => group.items ?? [])
  const rows = clampTableRows(
    Math.max(TABLE_ROWS_DEFAULT, ...itemRows.map((items) => items.length), 0),
  )
  const cells = Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => itemRows[colIndex]?.[rowIndex]?.trim() ?? ''),
  )
  const bank = [
    ...new Set(
      groups
        .flatMap((group) => group.items ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]

  return {
    tableRows: rows,
    tableCols: cols,
    tableHeaders: headers,
    tableCells: cells,
    tableAnswerBank: bank,
  }
}

export function createDefaultGroupingTableFields(): Pick<
  WorksheetBlock,
  | 'tableRows'
  | 'tableCols'
  | 'tableHeaders'
  | 'tableCells'
  | 'tableAnswerBank'
  | 'tableShowAnswerBank'
  | 'tableShuffleAnswers'
> {
  const rows = TABLE_ROWS_DEFAULT
  const cols = TABLE_COLS_DEFAULT
  return {
    tableRows: rows,
    tableCols: cols,
    tableHeaders: Array.from({ length: cols }, () => GROUPING_HEADER_PLACEHOLDER),
    tableCells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    tableAnswerBank: [],
    tableShowAnswerBank: true,
    tableShuffleAnswers: true,
  }
}

export function resizeGroupingTable(
  block: WorksheetBlock,
  newRows: number,
  newCols: number,
): WorksheetBlock {
  const rows = clampTableRows(newRows)
  const cols = clampTableCols(newCols)
  const cells = block.tableCells ?? []
  const headers = block.tableHeaders ?? []
  const nextCells = Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => cells[rowIndex]?.[colIndex] ?? ''),
  )
  const nextHeaders = Array.from({ length: cols }, (_, index) =>
    headers[index]?.trim() ? headers[index] : GROUPING_HEADER_PLACEHOLDER,
  )

  return {
    ...block,
    tableRows: rows,
    tableCols: cols,
    tableCells: nextCells,
    tableHeaders: nextHeaders,
  }
}

function normalizeGroupingBlock(block: WorksheetBlock): WorksheetBlock {
  let next: WorksheetBlock =
    block.type === 'table'
      ? { ...block, type: 'grouping' }
      : { ...block }

  if (next.type !== 'grouping') return block

  if (next.groups?.length && !next.tableCells?.length) {
    next = {
      ...next,
      ...groupsToTableFields(next.groups),
      groups: undefined,
    }
  }

  const rows = clampTableRows(next.tableRows ?? TABLE_ROWS_DEFAULT)
  const cols = clampTableCols(next.tableCols ?? TABLE_COLS_DEFAULT)
  const cells = next.tableCells ?? []
  const headers = next.tableHeaders ?? []

  next = {
    ...next,
    tableRows: rows,
    tableCols: cols,
    tableHeaders: Array.from({ length: cols }, (_, index) =>
      headers[index]?.trim() ? headers[index] : GROUPING_HEADER_PLACEHOLDER,
    ),
    tableCells: Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: cols }, (_, colIndex) => cells[rowIndex]?.[colIndex] ?? ''),
    ),
    tableAnswerBank: next.tableAnswerBank ?? [],
    tableShowAnswerBank: next.tableShowAnswerBank ?? true,
    tableShuffleAnswers: next.tableShuffleAnswers ?? true,
    question:
      isQuestionPlaceholder(next.question?.trim() ?? '') || !next.question?.trim()
        ? GROUPING_DEFAULT_QUESTION
        : next.question,
    groups: undefined,
  }

  return next
}

export function clampOrderCount(n: number): number {
  return Math.max(ORDER_ITEMS_MIN, Math.min(ORDER_ITEMS_MAX, n))
}

export function resizeOrderItems(block: WorksheetBlock): WorksheetBlock {
  const count = clampOrderCount(block.orderItems?.length ?? ORDER_ITEM_COUNT_DEFAULT)
  const items = [...(block.orderItems ?? [])]

  while (items.length < count) items.push('')

  return {
    ...block,
    orderItems: items.slice(0, count),
    orderDisplayItems: undefined,
    orderDisplayOrder: undefined,
  }
}

export function clampMatchingCount(n: number): number {
  return Math.max(MATCHING_PAIRS_MIN, Math.min(MATCHING_PAIRS_MAX, n))
}

function inferMatchingPairCount(left: MatchPair[], right: MatchPair[]): number {
  const maxLen = Math.max(left.length, right.length)
  let count = 0
  for (let index = 0; index < maxLen; index += 1) {
    const leftItem = left[index]
    const rightItem = right[index]
    const hasLeft = Boolean(leftItem && matchingItemHasContent(leftItem, leftItem.text ?? ''))
    const hasRight = Boolean(rightItem && matchingItemHasContent(rightItem, rightItem.text ?? ''))
    if (hasLeft && hasRight) count = index + 1
  }
  return clampMatchingCount(Math.max(count, MATCHING_PAIRS_MIN))
}

function normalizeMatchingBlock(block: WorksheetBlock): WorksheetBlock {
  const left = block.leftItems ?? []
  const right = block.rightItems ?? []
  const count =
    block.matchingPairCount != null
      ? clampMatchingCount(block.matchingPairCount)
      : inferMatchingPairCount(left, right)

  return resizeMatchingPairs({
    ...block,
    matchingPairCount: count,
    leftItems: left,
    rightItems: right,
  })
}

export function getMatchingRowCount(block: WorksheetBlock): number {
  return clampMatchingCount(
    block.matchingPairCount ??
      inferMatchingPairCount(block.leftItems ?? [], block.rightItems ?? []),
  )
}

export function resizeMatchingPairs(block: WorksheetBlock): WorksheetBlock {
  const count = clampMatchingCount(
    block.matchingPairCount ?? block.leftItems?.length ?? MATCHING_PAIR_COUNT_DEFAULT,
  )
  const left = [...(block.leftItems ?? [])]
  const right = [...(block.rightItems ?? [])]

  while (left.length < count) {
    left.push({ id: uid('left'), text: '' })
    right.push({ id: uid('right'), text: '' })
  }

  return {
    ...block,
    matchingPairCount: count,
    leftItems: left.slice(0, count),
    rightItems: right.slice(0, count),
    matchingDisplayRight: undefined,
  }
}

export function clampChoiceOptionCount(n: number): number {
  return Math.max(CHOICE_OPTION_COUNT_MIN, Math.min(CHOICE_OPTION_COUNT_MAX, n))
}

export function defaultChoiceOptionText(index: number): string {
  return `Ответ ${index + 1}`
}

export function resizeChoiceOptions(
  block: WorksheetBlock,
  current: ChoiceOption[],
): ChoiceOption[] {
  const count = clampChoiceOptionCount(
    block.choiceOptionCount ?? current.length ?? CHOICE_OPTION_COUNT_DEFAULT,
  )
  const next = [...current]
  while (next.length < count) {
    const i = next.length
    next.push({ id: uid('option'), text: defaultChoiceOptionText(i) })
  }
  return next.slice(0, count)
}

export function getChoiceDisplayOptions(
  block: WorksheetBlock,
  editable: boolean,
  selected: boolean,
): ChoiceOption[] {
  const options = resizeChoiceOptions(block, block.options ?? [])
  if (editable && selected) return options
  if (!block.choiceShuffle) return options
  if (block.choiceDisplayOrder?.length === options.length) {
    const byId = new Map(options.map((o) => [o.id, o]))
    const ordered = block.choiceDisplayOrder
      .map((id) => byId.get(id))
      .filter((o): o is ChoiceOption => Boolean(o))
    if (ordered.length === options.length) return ordered
  }
  return stableShuffle(options, block.id)
}

export function toggleCorrectOption(
  block: WorksheetBlock,
  optionId: string,
): WorksheetBlock {
  if (block.type === 'single_choice') {
    const nextId = block.correctOptionId === optionId ? undefined : optionId
    return { ...block, correctOptionId: nextId }
  }
  if (block.type === 'multiple_choice') {
    const current = block.correctOptionIds ?? []
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId]
    return { ...block, correctOptionIds: next }
  }
  return block
}

export function isOptionCorrect(block: WorksheetBlock, optionId: string): boolean {
  const options = block.options ?? []
  const option = options.find((item) => item.id === optionId)

  if (block.type === 'single_choice') {
    if (block.correctOptionId === optionId) return true
    const correctOption = block.correctOptionId
      ? options.find((item) => item.id === block.correctOptionId)
      : undefined
    const answerText = block.correctAnswers?.[0]?.trim()
    if (option && answerText && normalizeMatchText(option.text) === normalizeMatchText(answerText)) {
      return true
    }
    if (option && correctOption && option.id === correctOption.id) return true
    return false
  }

  if (block.type === 'multiple_choice') {
    if ((block.correctOptionIds ?? []).includes(optionId)) return true
    const answerTexts = (block.correctAnswers ?? []).map((item) => normalizeMatchText(item))
    if (option && answerTexts.includes(normalizeMatchText(option.text))) return true
    return false
  }

  return false
}

export function hasValidChoiceCorrectAnswers(block: WorksheetBlock): boolean {
  if (block.type === 'single_choice') return Boolean(block.correctOptionId)
  if (block.type === 'multiple_choice') {
    return (block.correctOptionIds?.length ?? 0) >= 1
  }
  return true
}
