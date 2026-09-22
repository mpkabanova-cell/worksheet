export interface ContextBlock {
  title: string
  body: string
}

const IRRELEVANT_TITLE_RE =
  /^(решение|ответ|ключ|разбор|пояснен|пример\s+решения|ответы|детальная\s+информация|результаты\s+работы|пример\s+выполнения|комментарий|пояснение\s+к\s+решению)/i

const SOLUTION_CUT_LINE_RE =
  /^\s*(#{0,3}\s*)?(Решение|Ответ|Ключ|Разбор|Пояснение|Пример\s+решения|Ответы|Результаты\s+работы\s+алгоритма|Пример\s+выполнения\s+алгоритма|Детальная\s+информация|HTML\s+Текст)\s*:?\s*$/i

const HEADING_LINE_RE = [
  /^#{1,3}\s+\S/,
  /^\d+\s*[-–—]\s*\d+\s*класс/i,
  /^Задани[ея]\s*\d+/i,
  /^Задач[аи]\s*\d+/i,
  /^Упражнени[ея]\s*\d+/i,
  /^Вариант\s*\d+/i,
  /^Часть\s*\d+/i,
]

export function isIrrelevantSectionTitle(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  return IRRELEVANT_TITLE_RE.test(t)
}

export function isLikelyBlockHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 120) return false
  if (/^\d+\s*минут\s*=/.test(t)) return false
  if (/=\s*\d+\s*минут/.test(t)) return false
  if (/^[+\d\s=минут\.]+$/i.test(t)) return false
  if (HEADING_LINE_RE.some((re) => re.test(t))) return true
  if (isIrrelevantSectionTitle(t)) return true
  if (/^[A-ZА-ЯЁ0-9][^.!?]{0,70}$/.test(t) && t.length <= 48 && !t.includes(',')) return true
  return false
}

/** Разбивает текст на блоки по заголовкам (класс, задание N, markdown-заголовок). */
export function splitContextBlocks(text: string): ContextBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  /** @type {ContextBlock[]} */
  const blocks: ContextBlock[] = []
  let currentTitle = ''
  /** @type {string[]} */
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
      currentTitle = trimmed.replace(/^#{1,3}\s+/, '')
      continue
    }
    if (isLikelyBlockHeading(trimmed) && currentLines.length === 0 && !currentTitle) {
      currentTitle = trimmed.replace(/^#{1,3}\s+/, '')
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

/** Обрезает хвост блока от «Решение:» и подобных маркеров. */
export function stripSolutionTail(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const cutIdx = lines.findIndex((line) => SOLUTION_CUT_LINE_RE.test(line.trim()))
  if (cutIdx === -1) return body.trim()
  return lines.slice(0, cutIdx).join('\n').trim()
}

/** Убирает блоки-решения и хвосты с ответами внутри релевантных блоков. */
export function stripIrrelevantSections(text: string): string {
  const blocks = splitContextBlocks(text)
  if (blocks.length <= 1 && !blocks[0]?.title) {
    return stripSolutionTail(text)
  }

  return blocks
    .filter((block) => !isIrrelevantSectionTitle(block.title))
    .map((block) => stripSolutionTail(block.body))
    .filter(Boolean)
    .join('\n\n')
    .trim()
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

  const lineIdx = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .findIndex((line) => line.trim().toLowerCase().includes(query))
  if (lineIdx === -1) return text

  const lines = text.replace(/\r\n/g, '\n').split('\n')
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
    .filter((title) => !/^\d+\s*минут\s*=/.test(title))
    .filter((title) => title.length >= 3)
}

export function prepareReferenceContent(
  text: string,
  options?: { block?: string | null },
): string {
  let content = text.trim()
  if (!content) return ''

  if (options?.block?.trim()) {
    content = selectContextBlock(content, options.block)
  }

  return stripIrrelevantSections(content)
}
