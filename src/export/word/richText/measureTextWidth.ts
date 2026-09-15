import type { ContentSegment } from '@/export/word/richText/parseRichText'
import { normalizeExportText } from '@/export/word/richText/normalizeExportText'
import { FONT, FONT_CSS, FONT_FALLBACK } from '@/export/word/layoutTokens'

export const TEXT_CELL_PADDING_PX = 1
export const MATH_CELL_PADDING_PX = 2
/** Word often renders Arial slightly wider than canvas measureText (esp. Cyrillic). */
export const TEXT_MEASURE_SAFETY = 1.06

export type InlineWidthCell =
  | { kind: 'text'; segments: ContentSegment[] }
  | { kind: 'math'; tex: string }

let canvas: HTMLCanvasElement | null = null

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement('canvas')
  }
  return canvas.getContext('2d')
}

function measureTextWidthDomPx(text: string, fontSizePx: number, bold = false): number {
  if (typeof document === 'undefined') return 0

  const normalized = normalizeExportText(text)
  if (!normalized) return 0

  const span = document.createElement('span')
  span.style.position = 'fixed'
  span.style.left = '-10000px'
  span.style.top = '0'
  span.style.visibility = 'hidden'
  span.style.whiteSpace = 'nowrap'
  span.style.font = `${bold ? '600' : '400'} ${fontSizePx}px ${FONT_CSS}`
  span.textContent = normalized
  document.body.appendChild(span)
  const width = span.getBoundingClientRect().width
  span.remove()
  return Math.ceil(width)
}

export function measureTextWidthPx(
  text: string,
  fontSizePx: number,
  bold = false,
): number {
  const normalized = normalizeExportText(text)
  if (!normalized) return 0

  const ctx = getCanvasContext()
  const canvasWidth = ctx
    ? (() => {
        ctx.font = `${bold ? '600' : '400'} ${fontSizePx}px "${FONT}", "${FONT_FALLBACK}", sans-serif`
        return Math.ceil(ctx.measureText(normalized).width)
      })()
    : Math.ceil(normalized.length * fontSizePx * 0.55)
  const domWidth = measureTextWidthDomPx(normalized, fontSizePx, bold)
  return Math.max(canvasWidth, domWidth)
}

export function measureSegmentsWidthPx(
  segments: ContentSegment[],
  fontSizePx: number,
): number {
  let widthPx = 0

  for (const segment of segments) {
    if (segment.kind !== 'text' || !segment.value) continue
    widthPx += measureTextWidthPx(segment.value, fontSizePx, segment.bold)
  }

  return widthPx
}

export function measureSpaceWidthPx(fontSizePx: number, bold = false): number {
  return measureTextWidthPx(' ', fontSizePx, bold)
}

export function textCellWidthPx(segments: ContentSegment[], fontSizePx: number): number {
  const contentWidth = measureSegmentsWidthPx(segments, fontSizePx)
  if (contentWidth <= 0) return TEXT_CELL_PADDING_PX
  const spaceWidth = measureSpaceWidthPx(fontSizePx)
  return Math.ceil((contentWidth + spaceWidth + TEXT_CELL_PADDING_PX) * TEXT_MEASURE_SAFETY)
}

export function mathCellWidthPx(mathWidthPx: number): number {
  return mathWidthPx + MATH_CELL_PADDING_PX
}

export function measureInlineLineWidthPx(
  cells: InlineWidthCell[],
  fontSizePx: number,
  mathWidthsPx: ReadonlyMap<string, number>,
): number {
  let total = 0

  for (const cell of cells) {
    if (cell.kind === 'math') {
      total += mathCellWidthPx(mathWidthsPx.get(cell.tex) ?? 0)
      continue
    }
    total += textCellWidthPx(cell.segments, fontSizePx)
  }

  return total
}

export function fitFontScale(
  totalWidthPx: number,
  availableWidthPx: number,
  baseSizePx: number,
  baseLinePx: number,
  minSizePx = 12,
): { sizePx: number; linePx: number; fits: boolean } {
  if (totalWidthPx <= availableWidthPx || totalWidthPx <= 0) {
    return { sizePx: baseSizePx, linePx: baseLinePx, fits: true }
  }

  const scale = availableWidthPx / totalWidthPx
  const sizePx = Math.max(minSizePx, Math.floor(baseSizePx * scale))
  const linePx = Math.max(sizePx + 6, Math.round(baseLinePx * scale))
  const fittedWidth = (totalWidthPx * sizePx) / baseSizePx
  return { sizePx, linePx, fits: fittedWidth <= availableWidthPx || sizePx <= minSizePx }
}

function splitTextSegmentIntoWordCells(segment: ContentSegment): InlineWidthCell[] {
  if (segment.kind !== 'text') return []
  const normalized = normalizeExportText(segment.value)
  if (!normalized) return []

  const words = normalized.split(/\s+/).filter(Boolean)
  return words.map((word, index) => ({
    kind: 'text' as const,
    segments: [
      {
        ...segment,
        kind: 'text' as const,
        value: index < words.length - 1 ? `${word} ` : word,
      },
    ],
  }))
}

function flattenCellsToWrapAtoms(cells: InlineWidthCell[]): InlineWidthCell[] {
  const atoms: InlineWidthCell[] = []

  for (const cell of cells) {
    if (cell.kind === 'math') {
      atoms.push(cell)
      continue
    }

    for (const segment of cell.segments) {
      atoms.push(...splitTextSegmentIntoWordCells(segment))
    }
  }

  return atoms
}

function mergeWrapAtoms(atoms: InlineWidthCell[]): InlineWidthCell[] {
  const merged: InlineWidthCell[] = []
  let textSegments: ContentSegment[] = []

  function flushText(): void {
    if (textSegments.length === 0) return
    merged.push({ kind: 'text', segments: [...textSegments] })
    textSegments = []
  }

  for (const atom of atoms) {
    if (atom.kind === 'math') {
      flushText()
      merged.push(atom)
      continue
    }
    textSegments.push(...atom.segments)
  }

  flushText()
  return merged
}

/** Shrink columns to fit maxTotalDxa without going below per-column minimums. */
export function scaleColumnWidthsToMaxWithMin(
  columnWidthsDxa: number[],
  minColumnWidthsDxa: number[],
  maxTotalDxa: number,
): number[] {
  if (columnWidthsDxa.length === 0) return columnWidthsDxa

  const total = columnWidthsDxa.reduce((sum, width) => sum + width, 0)
  if (total <= maxTotalDxa) return columnWidthsDxa

  const result = [...columnWidthsDxa]
  let overflow = total - maxTotalDxa

  for (let pass = 0; pass < 8 && overflow > 0; pass += 1) {
    const shrinkable = result.map((width, index) =>
      Math.max(0, width - (minColumnWidthsDxa[index] ?? width)),
    )
    const shrinkableTotal = shrinkable.reduce((sum, value) => sum + value, 0)
    if (shrinkableTotal <= 0) break

    for (let index = 0; index < result.length && overflow > 0; index += 1) {
      if (shrinkable[index] <= 0) continue
      const cut = Math.min(
        shrinkable[index],
        Math.max(1, Math.ceil((overflow * shrinkable[index]) / shrinkableTotal)),
      )
      result[index] -= cut
      overflow -= cut
    }
  }

  return result
}

/** Grow content columns up to targetTotalDxa (distributes slack by min-width share). */
export function expandColumnWidthsToTarget(
  columnWidthsDxa: number[],
  minColumnWidthsDxa: number[],
  targetTotalDxa: number,
): number[] {
  const total = columnWidthsDxa.reduce((sum, width) => sum + width, 0)
  if (total >= targetTotalDxa) return columnWidthsDxa

  const slack = targetTotalDxa - total
  const result = [...columnWidthsDxa]
  const minTotal = minColumnWidthsDxa.reduce((sum, width) => sum + width, 0) || 1

  for (let index = 0; index < result.length; index += 1) {
    result[index] += Math.floor((slack * minColumnWidthsDxa[index]) / minTotal)
  }

  let remainder = targetTotalDxa - result.reduce((sum, width) => sum + width, 0)
  for (let index = 0; remainder > 0; index = (index + 1) % result.length) {
    result[index] += 1
    remainder -= 1
  }

  return result
}

/** Greedy word wrap for inline question lines once font scaling is exhausted. */
export function wrapInlineCells(
  cells: InlineWidthCell[],
  maxWidthPx: number,
  fontSizePx: number,
  mathWidthsPx: ReadonlyMap<string, number>,
): InlineWidthCell[][] {
  if (cells.length === 0) return [[]]

  const totalWidth = measureInlineLineWidthPx(cells, fontSizePx, mathWidthsPx)
  if (totalWidth <= maxWidthPx) return [cells]

  const atoms = flattenCellsToWrapAtoms(cells)
  if (atoms.length === 0) return [cells]

  const lines: InlineWidthCell[][] = []
  let currentAtoms: InlineWidthCell[] = []

  for (const atom of atoms) {
    const trialAtoms = [...currentAtoms, atom]
    const trialCells = mergeWrapAtoms(trialAtoms)
    const trialWidth = measureInlineLineWidthPx(trialCells, fontSizePx, mathWidthsPx)

    if (trialWidth > maxWidthPx && currentAtoms.length > 0) {
      lines.push(mergeWrapAtoms(currentAtoms))
      currentAtoms = [atom]
      continue
    }

    currentAtoms = trialAtoms
  }

  if (currentAtoms.length > 0) {
    lines.push(mergeWrapAtoms(currentAtoms))
  }

  return lines.length > 0 ? lines : [cells]
}
