import type { AnswerAreaStyle, WorksheetBlock, WorksheetDraft } from './worksheet'

export const QUESTION_MAX_LENGTH = 250
export const TEXT_BODY_MAX_LENGTH = 10_000

export const TABLE_ROWS_MIN = 2
export const TABLE_ROWS_MAX = 10
export const TABLE_COLS_MIN = 2
export const TABLE_COLS_MAX = 6

export const ORDER_ITEMS_MIN = 2
export const ORDER_ITEMS_MAX = 10

export const MATCHING_PAIRS_MIN = 2
export const MATCHING_PAIRS_MAX = 10

export const ANSWER_CELL_SIZE = 20

const GRID_SUBJECTS = new Set([
  'Математика',
  'Физика',
  'Химия',
  'Информатика',
  'Алгебра',
  'Геометрия',
])

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
  return {
    ...block,
    question: asText(block.question),
    body: asText(block.body),
    instruction: asText(block.instruction) ?? '',
    options: block.options?.map((option, index) => ({
      id: option.id || `option_${index + 1}`,
      text: asText(option.text) ?? '',
    })),
    leftItems: block.leftItems?.map((item, index) => ({
      id: item.id || `left_${index + 1}`,
      text: asText(item.text) ?? '',
    })),
    rightItems: block.rightItems?.map((item, index) => ({
      id: item.id || `right_${index + 1}`,
      text: asText(item.text) ?? '',
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
    gapsAnswers: Array.isArray(block.gapsAnswers)
      ? block.gapsAnswers.map((item) => asText(item) ?? '').filter(Boolean)
      : block.gapsAnswers,
    gapsText: asText(block.gapsText),
    gapsSourceText: asText(block.gapsSourceText),
    correctAnswers: Array.isArray(block.correctAnswers)
      ? block.correctAnswers.map((item) => asText(item) ?? '').filter(Boolean)
      : block.correctAnswers,
  }
}

export function sanitizeBlocks(blocks: WorksheetBlock[]): WorksheetBlock[] {
  return blocks.map(sanitizeBlock)
}

export function defaultAnswerStyle(subject: string): AnswerAreaStyle {
  return GRID_SUBJECTS.has(subject) ? 'cells' : 'lines'
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
  const len = Math.max(2, word.length * 2)
  return '_'.repeat(len)
}

export function renderGapsStudentText(sourceText: string, gapWords: string[]): string {
  if (!sourceText.trim()) return ''
  if (!gapWords.length) return sourceText

  let result = sourceText
  for (const word of gapWords) {
    const idx = result.indexOf(word)
    if (idx >= 0) {
      result = result.slice(0, idx) + gapUnderscore(word) + result.slice(idx + word.length)
    }
  }
  return result
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

export function getGapsStudentText(block: WorksheetBlock): string {
  const source = getGapsSourceText(block)
  return renderGapsStudentText(source, block.gapsAnswers ?? [])
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

export function getMatchingCorrectLinks(
  block: WorksheetBlock,
  displayRight: { id: string; text: string }[],
): { leftIndex: number; rightIndex: number }[] {
  const left = block.leftItems ?? []
  const canonicalRight = block.rightItems ?? []

  const findRightIndex = (raw: string): number => {
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

  if (block.correctAnswers?.length) {
    return block.correctAnswers
      .map((answer) => {
        const idMatch = answer.match(/^(left_\d+)\s*(?:→|->)\s*(right_\d+)/i)
        if (idMatch) {
          return {
            leftIndex: left.findIndex((item) => item.id === idMatch[1]),
            rightIndex: displayRight.findIndex((item) => item.id === idMatch[2]),
          }
        }

        const parts = answer.split(/\s*(?:→|->)\s*/)
        if (parts.length === 2) {
          const leftIndex = left.findIndex(
            (item) => normalizeMatchText(item.text) === normalizeMatchText(parts[0]),
          )
          return { leftIndex, rightIndex: findRightIndex(parts[1]) }
        }

        return { leftIndex: -1, rightIndex: -1 }
      })
      .filter((pair) => pair.leftIndex >= 0 && pair.rightIndex >= 0)
  }

  return left
    .map((_, leftIndex) => {
      const target = canonicalRight[leftIndex]
      if (!target) return { leftIndex, rightIndex: -1 }
      const rightIndex = displayRight.findIndex((item) => item.id === target.id)
      return { leftIndex, rightIndex }
    })
    .filter((pair) => pair.rightIndex >= 0)
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
