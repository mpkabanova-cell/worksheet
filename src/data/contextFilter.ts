export interface ContextBlock {
  title: string
  body: string
}

export type ContextLineRole =
  | 'heading'
  | 'condition'
  | 'data_table'
  | 'solution'
  | 'answer_key'
  | 'noise'

export interface SegmentedContextLine {
  text: string
  role: ContextLineRole
}

const IRRELEVANT_TITLE_RE =
  /^(решение|ответ|ключ|разбор|пояснен|пример\s+решения|ответы|детальная\s+информация|результаты\s+работы|пример\s+выполнения|комментарий|пояснение\s+к\s+решению)/i

const SOLUTION_MARKER_LINE_RE =
  /^\s*(#{0,3}\s*)?(Решение|Разбор|Пояснение|Пример\s+решения|Ответы|Результаты\s+работы\s+алгоритма|Пример\s+выполнения\s+алгоритма|Детальная\s+информация|HTML\s+Текст)\s*:?\s*$/i

const INLINE_ANSWER_KEY_RE =
  /^\s*(#{0,3}\s*)?(Ответ|Ключ)\s*:/i

const HEADING_LINE_RE = [
  /^#{1,3}\s+\S/,
  /^\d+\s*[-–—]\s*\d+\s*класс/i,
  /^Задани[ея]\s*\d+/i,
  /^Задач[аи]\s*\d+/i,
  /^Упражнени[ея]\s*\d+/i,
  /^Вариант\s*\d+/i,
  /^Часть\s*\d+/i,
]

const TASK_NUMBER_HEADING_RE = /^\d+\.\s+[A-ZА-ЯЁ]/

const TIME_ARITHMETIC_RE =
  /^(\+\s*)?\d+\s*минут?\s*=|^(\+\s*)?\d+\s*минут?\s*=\s*\d+\s*минут|^\d+\s*минут\s*=\s*\d+\s*минут/i

const STANDALONE_ANSWER_MINUTES_RE = /^\d+\s*минут\.?\s*$/i

const ROUTE_DATA_RE = /\s[-–—]\s+.*\d+\s*минут/i

const BRACKET_ONLY_RE = /^\[[^\]]+\]\s*$/

const PAGE_MARKER_RE = /^--\s*\d+\s+of\s+\d+\s*--$/i

const CODE_LINE_RE = /^\s*(def\s+\w+|import\s+\w+|for\s+\w+\s+in|while\s+|return\s+)/

const SOLUTION_TOOL_RE = /графоанализатор|программа\s+"граф/i

const RELEVANT_ROLES = new Set<ContextLineRole>(['heading', 'condition', 'data_table'])

interface SegmentState {
  mode: 'condition' | 'solution'
}

export function isIrrelevantSectionTitle(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  return IRRELEVANT_TITLE_RE.test(t)
}

function normalizeLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function headingText(line: string): string {
  return line.trim().replace(/^#{1,3}\s+/, '')
}

export function isLikelyBlockHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 120) return false
  if (isTimeArithmeticLine(t)) return false
  if (isRouteDataLine(t)) return false
  if (BRACKET_ONLY_RE.test(t)) return false
  if (HEADING_LINE_RE.some((re) => re.test(t))) return true
  if (TASK_NUMBER_HEADING_RE.test(t)) return true
  if (isIrrelevantSectionTitle(t)) return true
  return false
}

function isTimeArithmeticLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (TIME_ARITHMETIC_RE.test(t)) return true
  if (/^[+\d\s=минут\.]+$/i.test(t)) return true
  return false
}

function isRouteDataLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  return ROUTE_DATA_RE.test(t)
}

function isNoiseLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^---+$/.test(t)) return true
  if (PAGE_MARKER_RE.test(t)) return true
  return false
}

function isSolutionMarkerLine(line: string): boolean {
  const t = line.trim()
  return SOLUTION_MARKER_LINE_RE.test(t) || INLINE_ANSWER_KEY_RE.test(t)
}

function isSolutionContentLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (isTimeArithmeticLine(t)) return true
  if (STANDALONE_ANSWER_MINUTES_RE.test(t)) return true
  if (BRACKET_ONLY_RE.test(t)) return true
  if (CODE_LINE_RE.test(t)) return true
  if (SOLUTION_TOOL_RE.test(t)) return true
  if (/^создаем\s+(ребра|нагруженный)/i.test(t)) return true
  if (/^из\s+вершины\s+\d+/i.test(t)) return true
  if (/^программа\s+"/i.test(t)) return true
  return false
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 8).length
}

/** Новая задача после блока решения: длинное условие с вопросом. */
function isNewTaskAfterSolution(line: string, state: SegmentState): boolean {
  if (state.mode !== 'solution') return false
  const t = line.trim()
  if (!t || t.length < 80) return false
  if (!t.includes('?')) return false
  if (isSolutionContentLine(t)) return false
  if (isRouteDataLine(t)) return false
  if (isSolutionMarkerLine(t)) return false
  if (isExplicitTaskHeading(t)) return false
  return t.length >= 120 || sentenceCount(t) >= 2
}

function isExplicitTaskHeading(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (HEADING_LINE_RE.some((re) => re.test(t))) return true
  if (TASK_NUMBER_HEADING_RE.test(t)) return true
  return false
}

function classifyLineRole(line: string, state: SegmentState): ContextLineRole {
  const trimmed = line.trim()

  if (isNoiseLine(line)) return 'noise'

  if (isExplicitTaskHeading(trimmed)) {
    if (isIrrelevantSectionTitle(headingText(trimmed))) {
      state.mode = 'solution'
      return 'solution'
    }
    state.mode = 'condition'
    return 'heading'
  }

  if (isNewTaskAfterSolution(trimmed, state)) {
    state.mode = 'condition'
    return 'condition'
  }

  if (isRouteDataLine(trimmed)) {
    state.mode = 'condition'
    return 'data_table'
  }

  if (isSolutionMarkerLine(trimmed)) {
    state.mode = 'solution'
    return INLINE_ANSWER_KEY_RE.test(trimmed) ? 'answer_key' : 'solution'
  }

  if (state.mode === 'solution') {
    if (isSolutionContentLine(trimmed)) {
      return STANDALONE_ANSWER_MINUTES_RE.test(trimmed) || INLINE_ANSWER_KEY_RE.test(trimmed)
        ? 'answer_key'
        : 'solution'
    }
    if (BRACKET_ONLY_RE.test(trimmed)) return 'noise'
    return 'solution'
  }

  if (isSolutionContentLine(trimmed)) {
    return STANDALONE_ANSWER_MINUTES_RE.test(trimmed) ? 'answer_key' : 'solution'
  }

  if (BRACKET_ONLY_RE.test(trimmed)) return 'noise'

  return 'condition'
}

/** Классифицирует каждую строку extract с учётом scoped solution. */
export function segmentContextText(text: string): SegmentedContextLine[] {
  const state: SegmentState = { mode: 'condition' }
  return normalizeLines(text).map((line) => ({
    text: line,
    role: classifyLineRole(line, state),
  }))
}

function joinRelevantSegments(segments: SegmentedContextLine[]): string {
  return segments
    .filter((segment) => RELEVANT_ROLES.has(segment.role))
    .map((segment) => segment.text)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Разбивает текст на блоки по явным заголовкам (класс, задание N, markdown). */
export function splitContextBlocks(text: string): ContextBlock[] {
  const lines = normalizeLines(text)
  const blocks: ContextBlock[] = []
  let currentTitle = ''
  let currentLines: string[] = []

  const flush = () => {
    const body = currentLines.join('\n').trim()
    if (currentTitle || body) {
      blocks.push({ title: currentTitle.trim(), body })
    }
    currentLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (isLikelyBlockHeading(trimmed) && (currentLines.length > 0 || currentTitle)) {
      flush()
      currentTitle = headingText(trimmed)
      continue
    }
    if (isLikelyBlockHeading(trimmed) && currentLines.length === 0 && !currentTitle) {
      currentTitle = headingText(trimmed)
      continue
    }
    currentLines.push(line)
  }
  flush()

  if (blocks.length === 1 && !blocks[0].title && blocks[0].body) {
    return [{ title: '', body: blocks[0].body }]
  }

  return blocks
}

/** @deprecated Используйте segmentContextText; оставлено для совместимости тестов. */
export function stripSolutionTail(body: string): string {
  return joinRelevantSegments(segmentContextText(body))
}

/** Убирает решения, ответы и шум; сохраняет условия и таблицы данных. */
export function stripIrrelevantSections(text: string): string {
  return joinRelevantSegments(segmentContextText(text))
}

/** Выбирает один блок по названию (подстрока, без учёта регистра). */
export function selectContextBlock(text: string, blockName: string): string {
  const query = blockName.trim().toLowerCase()
  if (!query) return text

  const blocks = splitContextBlocks(text)
  const exact = blocks.find((b) => b.title.toLowerCase() === query)
  if (exact) return exact.body

  const partial = blocks.find(
    (b) =>
      b.title.toLowerCase().includes(query) ||
      query.includes(b.title.toLowerCase()),
  )
  if (partial) return partial.body

  const lines = normalizeLines(text)
  const lineIdx = lines.findIndex((line) => line.trim().toLowerCase().includes(query))
  if (lineIdx === -1) return text

  const title = lines[lineIdx].trim()
  const chunk: string[] = []
  for (let i = lineIdx + 1; i < lines.length; i++) {
    if (isLikelyBlockHeading(lines[i].trim()) && chunk.length > 0) break
    chunk.push(lines[i])
  }
  return [title, ...chunk].join('\n').trim()
}

/** Заголовки блоков для подсказки пользователю (без секций-решений). */
export function listContextBlockTitles(text: string): string[] {
  return splitContextBlocks(text)
    .map((b) => b.title.trim())
    .filter((title) => title && !isIrrelevantSectionTitle(title))
    .filter((title) => !isTimeArithmeticLine(title))
    .filter((title) => title.length >= 3)
}

/** Ищет заголовок блока, упомянутый в пожеланиях учителя. */
export function inferBlockFromWishes(wishes: string, text: string): string | null {
  const query = wishes.trim()
  if (!query) return null

  const titles = listContextBlockTitles(text)
  const lower = query.toLowerCase()

  const exact = titles.find((title) => lower.includes(title.toLowerCase()))
  if (exact) return exact

  const partial = titles.find(
    (title) =>
      title.length >= 4 &&
      (lower.includes(title.toLowerCase()) || title.toLowerCase().includes(lower.slice(0, 24))),
  )
  if (partial) return partial

  const gradeMatch = lower.match(/\d+\s*[-–—]\s*\d+\s*класс/)
  if (gradeMatch) {
    const byGrade = titles.find((title) => title.toLowerCase().includes(gradeMatch[0]))
    if (byGrade) return byGrade
  }

  return null
}

export function resolveContextSource(
  text: string,
  options?: { block?: string | null; wishes?: string | null },
): string {
  let content = text.replace(/\r\n/g, '\n').trim()
  if (!content) return ''

  const blockFromWishes =
    !options?.block?.trim() && options?.wishes?.trim()
      ? inferBlockFromWishes(options.wishes, content)
      : null

  const block = options?.block?.trim() || blockFromWishes
  if (block) {
    content = selectContextBlock(content, block)
  }

  return content
}

export function prepareReferenceContent(
  text: string,
  options?: { block?: string | null; wishes?: string | null },
): string {
  const content = resolveContextSource(text, options)
  if (!content) return ''
  return stripIrrelevantSections(content)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapRelevanceLine(line: string, kind: 'relevant' | 'irrelevant'): string {
  if (!line.trim()) return ''
  return `<span class="ctx-${kind}">${escapeHtml(line)}</span>`
}

/** Размечает исходный extract: релевантные условия и нерелевантные решения/ответы. */
export function annotateExtractRelevance(
  text: string,
  options?: { block?: string | null; wishes?: string | null },
): string {
  const source = resolveContextSource(text, options)
  if (!source) return ''

  return segmentContextText(source)
    .map(({ text: line, role }) => {
      if (!line.trim()) return ''
      const relevant = RELEVANT_ROLES.has(role)
      return wrapRelevanceLine(line, relevant ? 'relevant' : 'irrelevant')
    })
    .join('\n')
}
