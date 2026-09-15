import type { ContentSegment } from '@/export/word/richText/parseRichText'
import { normalizeExportText } from '@/export/word/richText/normalizeExportText'
import { FONT, FONT_CSS } from '@/export/word/layoutTokens'

export const TEXT_CELL_PADDING_PX = 1
export const MATH_CELL_PADDING_PX = 2
/** Word often renders STIX slightly wider than canvas measureText (esp. Cyrillic). */
export const TEXT_MEASURE_SAFETY = 1.03

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
        ctx.font = `${bold ? '600' : '400'} ${fontSizePx}px "${FONT}", "Times New Roman", serif`
        return Math.ceil(ctx.measureText(normalized).width)
      })()
    : Math.ceil(normalized.length * fontSizePx * 0.55)
  const domWidth = measureTextWidthDomPx(normalized, fontSizePx, bold)
  // DOM often measures wider than Word renders in narrow cells — use it only when canvas underestimates.
  if (domWidth > canvasWidth * 1.05) return canvasWidth
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

export function scaleColumnWidthsToMax(
  columnWidths: number[],
  maxTotal: number,
  fixedPrefixCount = 1,
): number[] {
  return scaleColumnWidthsToMaxWithMin(columnWidths, columnWidths, maxTotal, fixedPrefixCount)
}

export function scaleColumnWidthsToMaxWithMin(
  columnWidths: number[],
  minWidths: number[],
  maxTotal: number,
  fixedPrefixCount = 1,
): number[] {
  if (columnWidths.length !== minWidths.length) {
    throw new Error('columnWidths and minWidths must have the same length')
  }

  const total = columnWidths.reduce((sum, width) => sum + width, 0)
  if (total <= maxTotal) return columnWidths

  const fixedTotal = columnWidths.slice(0, fixedPrefixCount).reduce((sum, width) => sum + width, 0)
  const maxContent = Math.max(1, maxTotal - fixedTotal)
  const contentWidths = columnWidths.slice(fixedPrefixCount)
  const contentMins = minWidths.slice(fixedPrefixCount)
  const contentTotal = contentWidths.reduce((sum, width) => sum + width, 0)

  if (contentTotal <= maxContent) return columnWidths

  const slackTotal = contentWidths.reduce(
    (sum, width, index) => sum + Math.max(0, width - contentMins[index]),
    0,
  )

  if (slackTotal <= 0) {
    return [...columnWidths.slice(0, fixedPrefixCount), ...contentMins]
  }

  const targetReduction = contentTotal - maxContent
  let remaining = targetReduction
  const scaledContent = contentWidths.map((width, index) => {
    const slack = Math.max(0, width - contentMins[index])
    if (slack <= 0) return width
    const reduction = Math.min(slack, Math.round(targetReduction * (slack / slackTotal)))
    remaining -= reduction
    return width - reduction
  })

  if (remaining > 0) {
    for (let index = scaledContent.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const slack = scaledContent[index] - contentMins[index]
      if (slack <= 0) continue
      const take = Math.min(slack, remaining)
      scaledContent[index] -= take
      remaining -= take
    }
  }

  return [
    ...columnWidths.slice(0, fixedPrefixCount),
    ...scaledContent.map((width, index) => Math.max(contentMins[index], width)),
  ]
}
