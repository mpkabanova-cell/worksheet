import type {
  AnswerAreaStyle,
  ChoiceOption,
  ChoiceOptionFormat,
  MatchPair,
  WorksheetBlock,
  WorksheetDraft,
} from './worksheet'
import { uid } from './worksheet'
import { gapWordOccursOutsideMath, splitMathSegments } from '@/data/mathTextUtils'

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
  return 'Введите текст'
}

export const TABLE_ROWS_MIN = 2
export const TABLE_ROWS_MAX = 10
export const TABLE_COLS_MIN = 2
export const TABLE_COLS_MAX = 6

export const ORDER_ITEMS_MIN = 2
export const ORDER_ITEMS_MAX = 10

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
  if (style === 'cells') {
    const charsPerRow = 48
    return paragraphs.reduce(
      (sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / charsPerRow)),
      0,
    )
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
    text: clampText(asText(option.text) ?? '', CHOICE_OPTION_MAX),
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
    question: asText(block.question),
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
      ? block.orderItems.map((item) => asText(item) ?? '').filter(Boolean)
      : block.orderItems,
    gapsText: asText(block.gapsText),
    gapsSourceText: asText(block.gapsSourceText),
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
    sanitized.gapsAnswers = sanitizeGapAnswers(
      getGapsSourceText(sanitized),
      sanitized.gapsAnswers,
    )
  }

  return sanitized
}

export function sanitizeBlocks(blocks: WorksheetBlock[]): WorksheetBlock[] {
  return blocks.map(sanitizeBlock)
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
    gapsAnswers: block.gapsAnswers ? [...block.gapsAnswers] : block.gapsAnswers,
    correctAnswers: block.correctAnswers ? [...block.correctAnswers] : block.correctAnswers,
    correctOptionIds: block.correctOptionIds ? [...block.correctOptionIds] : block.correctOptionIds,
    choiceDisplayOrder: block.choiceDisplayOrder ? [...block.choiceDisplayOrder] : block.choiceDisplayOrder,
    tableCells: block.tableCells?.map((row) => [...row]),
    tableHeaders: block.tableHeaders ? [...block.tableHeaders] : block.tableHeaders,
    tableAnswerBank: block.tableAnswerBank ? [...block.tableAnswerBank] : block.tableAnswerBank,
    orderDisplayItems: block.orderDisplayItems ? [...block.orderDisplayItems] : block.orderDisplayItems,
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

export function sanitizeGapAnswers(sourceText: string, gapWords: string[]): string[] {
  return gapWords.filter((word) => gapWordOccursOutsideMath(sourceText, word))
}

export function markGapAnswersInText(sourceText: string, gapWords: string[]): string {
  const validGapWords = sanitizeGapAnswers(sourceText, gapWords)
  if (!validGapWords.length) return sourceText

  const segments = splitMathSegments(sourceText)
  return segments
    .map((segment) => {
      if (segment.kind === 'math') {
        return segment.display ? `$$${segment.value}$$` : `$${segment.value}$`
      }
      let plain = segment.value
      for (const word of validGapWords) {
        const idx = plain.indexOf(word)
        if (idx >= 0) {
          plain = `${plain.slice(0, idx)}<u>${word}</u>${plain.slice(idx + word.length)}`
        }
      }
      return plain
    })
    .join('')
}

export function renderGapsStudentText(sourceText: string, gapWords: string[]): string {
  if (!sourceText.trim()) return ''
  const validGapWords = sanitizeGapAnswers(sourceText, gapWords)
  if (!validGapWords.length) return sourceText

  const segments = splitMathSegments(sourceText)
  return segments
    .map((segment) => {
      if (segment.kind === 'math') {
        return segment.display ? `$$${segment.value}$$` : `$${segment.value}$`
      }
      let plain = segment.value
      for (const word of validGapWords) {
        const idx = plain.indexOf(word)
        if (idx >= 0) {
          plain = plain.slice(0, idx) + gapUnderscore(word) + plain.slice(idx + word.length)
        }
      }
      return plain
    })
    .join('')
}

export function tokenizeGapText(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? []
}

export function getGapsSourceText(block: WorksheetBlock): string {
  if (block.gapsSourceText?.trim()) return block.gapsSourceText
  if (block.gapsText?.trim()) {
    let text = block.gapsText
    for (const word of block.gapsAnswers ?? []) {
      text = text.replace(/_{3,}/, word)
    }
    return text
  }
  return ''
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
  if (editable && selected) return items
  if (block.orderDisplayItems?.length === items.length) return block.orderDisplayItems
  return stableShuffle(items, block.id)
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
): number {
  const bySide = findMatchingIndexedSide('right', raw, displayRight)
  if (bySide >= 0) return bySide

  const normalized = normalizeMatchText(raw)
  let index = displayRight.findIndex((item) => normalizeMatchText(item.text) === normalized)
  if (index >= 0) return index

  const canonicalIndex = canonicalRight.findIndex(
    (item) => normalizeMatchText(item.text) === normalized || item.id === raw.trim(),
  )
  if (canonicalIndex < 0) return -1
  const target = canonicalRight[canonicalIndex]
  index = displayRight.findIndex((item) => item.id === target.id)
  return index
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
  const rowCount = Math.max(left.length, displayRight.length)
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

  const findRightIndex = (raw: string): number =>
    findMatchingRightIndex(raw, displayRight, canonicalRight)

  const positionalLinks = () =>
    left
      .map((_, leftIndex) => {
        const target = canonicalRight[leftIndex]
        if (!target) return { leftIndex, rightIndex: -1 }
        const rightIndex = displayRight.findIndex((item) => item.id === target.id)
        return { leftIndex, rightIndex }
      })
      .filter((pair) => pair.rightIndex >= 0)

  const answers = (block.correctAnswers ?? []).map((answer) => answer.trim()).filter(Boolean)
  if (answers.length) {
    const parsed = answers
      .map((answer) => {
        const idMatch = answer.match(/^(left_\d+)\s*(?:→|->)\s*(right_\d+)/i)
        if (idMatch) {
          return {
            leftIndex: findMatchingIndexedSide('left', idMatch[1], left),
            rightIndex: findMatchingIndexedSide('right', idMatch[2], displayRight),
          }
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

export function clampOrderCount(n: number): number {
  return Math.max(ORDER_ITEMS_MIN, Math.min(ORDER_ITEMS_MAX, n))
}

export function clampMatchingCount(n: number): number {
  return Math.max(MATCHING_PAIRS_MIN, Math.min(MATCHING_PAIRS_MAX, n))
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
