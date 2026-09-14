import type { ContentSegment } from '@/export/word/richText/parseRichText'
import { normalizeExportText } from '@/export/word/richText/normalizeExportText'
import { FONT } from '@/export/word/layoutTokens'

export const TEXT_CELL_PADDING_PX = 4
export const MATH_CELL_PADDING_PX = 4
/** Word often renders STIX slightly wider than canvas measureText. */
export const TEXT_MEASURE_SAFETY = 1.04

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

export function measureTextWidthPx(
  text: string,
  fontSizePx: number,
  bold = false,
): number {
  const normalized = normalizeExportText(text)
  if (!normalized) return 0

  const ctx = getCanvasContext()
  if (!ctx) return Math.ceil(normalized.length * fontSizePx * 0.55)

  ctx.font = `${bold ? '600' : '400'} ${fontSizePx}px "${FONT}", "Times New Roman", serif`
  return Math.ceil(ctx.measureText(normalized).width)
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

export function textCellWidthPx(segments: ContentSegment[], fontSizePx: number): number {
  const contentWidth = measureSegmentsWidthPx(segments, fontSizePx)
  if (contentWidth <= 0) return TEXT_CELL_PADDING_PX
  return Math.ceil((contentWidth + TEXT_CELL_PADDING_PX) * TEXT_MEASURE_SAFETY)
}

export function measureInlineLineWidthPx(
  cells: InlineWidthCell[],
  fontSizePx: number,
  mathWidthsPx: ReadonlyMap<string, number>,
): number {
  let total = 0

  for (const cell of cells) {
    if (cell.kind === 'math') {
      total += (mathWidthsPx.get(cell.tex) ?? 0) + MATH_CELL_PADDING_PX
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
  const total = columnWidths.reduce((sum, width) => sum + width, 0)
  if (total <= maxTotal) return columnWidths

  const fixed = columnWidths.slice(0, fixedPrefixCount).reduce((sum, width) => sum + width, 0)
  const contentWidths = columnWidths.slice(fixedPrefixCount)
  const contentTotal = contentWidths.reduce((sum, width) => sum + width, 0)
  const maxContent = Math.max(1, maxTotal - fixed)

  if (contentTotal <= maxContent) return columnWidths

  const scale = maxContent / contentTotal
  return [
    ...columnWidths.slice(0, fixedPrefixCount),
    ...contentWidths.map((width) => Math.max(1, Math.round(width * scale))),
  ]
}

/** Expand content columns so their total is at least minContentTotal (fixed prefix unchanged). */
export function scaleColumnWidthsToMin(
  columnWidths: number[],
  minContentTotal: number,
  fixedPrefixCount = 1,
): number[] {
  const contentWidths = columnWidths.slice(fixedPrefixCount)
  const contentTotal = contentWidths.reduce((sum, width) => sum + width, 0)
  if (contentTotal >= minContentTotal) return columnWidths

  if (contentTotal === 0) {
    return [...columnWidths.slice(0, fixedPrefixCount), minContentTotal]
  }

  const scale = minContentTotal / contentTotal
  const scaled = contentWidths.map((width) => Math.max(1, Math.round(width * scale)))
  const scaledTotal = scaled.reduce((sum, width) => sum + width, 0)
  if (scaledTotal !== minContentTotal && scaled.length > 0) {
    scaled[scaled.length - 1] += minContentTotal - scaledTotal
  }

  return [...columnWidths.slice(0, fixedPrefixCount), ...scaled]
}
