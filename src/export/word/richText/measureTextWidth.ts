import type { ContentSegment } from '@/export/word/richText/parseRichText'
import { FONT } from '@/export/word/layoutTokens'

const TEXT_CELL_PADDING_PX = 8

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
  if (!text) return 0

  const ctx = getCanvasContext()
  if (!ctx) return Math.ceil(text.length * fontSizePx * 0.55)

  ctx.font = `${bold ? '600' : '400'} ${fontSizePx}px "${FONT}", "Times New Roman", serif`
  return Math.ceil(ctx.measureText(text).width)
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
  return contentWidth + TEXT_CELL_PADDING_PX
}
