import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import {
  ANSWER_CELL_SIZE,
  getDisplayAnswerText,
  getEffectiveAnswerLines,
} from '@/data/blockUtils'
import {
  COLORS,
  LAYOUT,
  SLOT_CONTENT_WIDTH_PX,
  answerCellsColumnCount,
  answerCellsGridSizePx,
} from '@/export/word/layoutTokens'
import { captureDomToPng } from '@/export/word/rasterize/domToPng'
import { appendMathText, ensureKatexStyles } from '@/export/word/rasterize/renderMathHtml'
import type { DomImageResult, ExportContext } from '@/export/word/types'

type GridOverlayType = 'axes' | 'number_line' | 'ray'

const SLOT_WIDTH_PX = SLOT_CONTENT_WIDTH_PX
const BORDER_SECONDARY = `#${COLORS.borderSecondary}`
const GRID_LINE = `#${COLORS.gridLine}`
const TEXT_SECONDARY = `#${COLORS.textSecondary}`
const OVERLAY_STROKE = '#989cb8'

function gridSizePx(cells: number): number {
  return answerCellsGridSizePx(cells)
}

function createLabel(text = 'Ответ:'): HTMLSpanElement {
  const label = document.createElement('span')
  label.textContent = text
  label.style.fontSize = '14px'
  label.style.lineHeight = '20px'
  label.style.color = TEXT_SECONDARY
  label.style.flexShrink = '0'
  return label
}

function createRuledLine(filled = false): HTMLElement {
  const line = document.createElement('i')
  line.style.display = 'block'
  line.style.minHeight = `${LAYOUT.answerLineHeight}px`
  line.style.borderBottom = `1px solid ${BORDER_SECONDARY}`
  line.style.fontStyle = 'normal'
  if (filled) {
    line.style.display = 'flex'
    line.style.alignItems = 'baseline'
    line.style.flexWrap = 'wrap'
    line.style.gap = '4px'
  }
  return line
}

function overlayGeometry(cols: number, rows: number) {
  const cell = ANSWER_CELL_SIZE
  const width = cols * cell
  const axisCol = Math.min(Math.round(cols * (20 / 42)), cols)
  const axisRow = Math.min(Math.round(rows * 0.5), rows)
  const lineRow = Math.min(Math.round(rows * 0.5), rows)
  const originCol = Math.min(Math.round(cols * (18 / 42)), cols)
  return { cell, width, axisCol, axisRow, lineRow, originCol }
}

function createGridOverlaySvg(type: GridOverlayType, cols: number, rows: number): SVGSVGElement {
  const { cell, width, axisCol, axisRow, lineRow, originCol } = overlayGeometry(cols, rows)
  const lineWidth = cols * cell + 1
  const lineHeight = rows * cell + 1
  const y = lineRow * cell
  const originX = originCol * cell
  const margin = cell

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${lineWidth} ${lineHeight}`)
  svg.setAttribute('width', String(lineWidth))
  svg.setAttribute('height', String(lineHeight))
  svg.style.position = 'absolute'
  svg.style.inset = '0'
  svg.style.pointerEvents = 'none'
  svg.style.zIndex = '1'

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(x1))
    line.setAttribute('y1', String(y1))
    line.setAttribute('x2', String(x2))
    line.setAttribute('y2', String(y2))
    line.setAttribute('stroke', OVERLAY_STROKE)
    line.setAttribute('stroke-width', '1')
    svg.appendChild(line)
  }

  if (type === 'axes') {
    addLine(axisCol * cell, 0, axisCol * cell, lineHeight)
    addLine(0, axisRow * cell, lineWidth, axisRow * cell)
  } else if (type === 'number_line') {
    addLine(margin, y, originX, y)
    addLine(originX, y, width - margin, y)
  } else if (type === 'ray') {
    addLine(margin, y, width - margin, y)
  }

  return svg
}

function createCellsGrid(
  rows: number,
  cols: number,
  overlay?: GridOverlayType,
  answerText?: string,
): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.style.width = '100%'

  const grid = document.createElement('div')
  grid.style.position = 'relative'
  grid.style.boxSizing = 'border-box'
  grid.style.width = `${gridSizePx(cols)}px`
  grid.style.height = `${gridSizePx(rows)}px`
  grid.style.backgroundColor = '#ffffff'
  grid.style.backgroundImage = `
    linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px),
    linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)
  `
  grid.style.backgroundSize = `${ANSWER_CELL_SIZE}px ${ANSWER_CELL_SIZE}px`
  grid.style.backgroundPosition = '0 0'

  if (answerText) {
    const overlayDiv = document.createElement('div')
    overlayDiv.style.position = 'absolute'
    overlayDiv.style.top = '0'
    overlayDiv.style.right = '0'
    overlayDiv.style.bottom = '0'
    overlayDiv.style.left = `${ANSWER_CELL_SIZE}px`
    overlayDiv.style.margin = '0'
    overlayDiv.style.overflow = 'hidden'
    overlayDiv.style.color = '#161A33'
    overlayDiv.style.fontSize = '14px'
    overlayDiv.style.lineHeight = `${ANSWER_CELL_SIZE}px`
    overlayDiv.style.pointerEvents = 'none'
    appendMathText(overlayDiv, answerText, {
      fontSize: 14,
      lineHeight: ANSWER_CELL_SIZE,
      cellSize: ANSWER_CELL_SIZE,
      cellsLayout: true,
    })
    grid.appendChild(overlayDiv)
  }

  if (overlay) {
    grid.appendChild(createGridOverlaySvg(overlay, cols, rows))
  }

  wrap.appendChild(grid)
  return wrap
}

function buildLinesDom(lines: number, showAnswer: boolean, answerText?: string): HTMLDivElement {
  const root = document.createElement('div')
  root.style.width = `${SLOT_WIDTH_PX}px`
  root.style.display = 'flex'
  root.style.flexDirection = 'column'

  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.width = '100%'

  const body = document.createElement('div')
  body.style.display = 'flex'
  body.style.flexDirection = 'column'
  body.style.gap = '4px'
  body.style.width = '100%'

  if (showAnswer && answerText) {
    const filled = createRuledLine(true)
    filled.appendChild(createLabel())
    appendMathText(filled, answerText, { fontSize: 14, lineHeight: 28, positive: true })
    body.appendChild(filled)
    for (let i = 1; i < lines; i += 1) {
      body.appendChild(createRuledLine())
    }
  } else {
    body.style.position = 'relative'
    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.right = '0'
    overlay.style.height = '20px'
    overlay.style.lineHeight = '20px'
    overlay.style.pointerEvents = 'none'
    overlay.style.zIndex = '1'
    overlay.appendChild(createLabel())
    body.appendChild(overlay)

    for (let i = 0; i < lines; i += 1) {
      body.appendChild(createRuledLine())
    }
  }

  wrap.appendChild(body)
  root.appendChild(wrap)
  return root
}

function buildBlockDom(lines: number, showAnswer: boolean, answerText?: string): HTMLDivElement {
  const minHeight = Math.max(lines + 1, 3) * LAYOUT.answerLineHeight
  const root = document.createElement('div')
  root.style.width = `${SLOT_WIDTH_PX}px`

  const area = document.createElement('div')
  area.style.position = 'relative'
  area.style.overflow = 'hidden'
  area.style.minHeight = `${minHeight}px`
  area.style.width = '100%'
  area.style.backgroundColor = '#ffffff'
  area.style.backgroundImage = `repeating-linear-gradient(to bottom, transparent 0, transparent 27px, ${BORDER_SECONDARY} 27px, ${BORDER_SECONDARY} 28px)`
  area.style.backgroundSize = '100% 28px'

  const head = document.createElement('div')
  head.style.position = 'absolute'
  head.style.top = '0'
  head.style.left = '0'
  head.style.padding = '0 12px'
  head.style.pointerEvents = 'none'
  head.style.zIndex = '1'
  head.appendChild(createLabel())
  area.appendChild(head)

  if (showAnswer && answerText) {
    const valueWrap = document.createElement('div')
    valueWrap.style.position = 'absolute'
    valueWrap.style.inset = '0'
    valueWrap.style.display = 'flex'
    valueWrap.style.alignItems = 'baseline'
    valueWrap.style.flexWrap = 'wrap'
    valueWrap.style.gap = '4px'
    valueWrap.style.padding = '0 12px'
    valueWrap.style.lineHeight = '28px'
    valueWrap.appendChild(createLabel())
    appendMathText(valueWrap, answerText, { fontSize: 14, lineHeight: 28, positive: true })
    area.appendChild(valueWrap)
  }

  root.appendChild(area)
  return root
}

function buildCellsDom(
  rows: number,
  cols: number,
  overlay?: GridOverlayType,
  answerText?: string,
): HTMLDivElement {
  const root = document.createElement('div')
  root.style.width = `${SLOT_WIDTH_PX}px`
  root.style.paddingTop = `${LAYOUT.answerCellsSlotPaddingTopPx}px`

  const head = document.createElement('div')
  head.style.display = 'flex'
  head.style.alignItems = 'baseline'
  head.style.minHeight = '20px'
  head.style.fontSize = '14px'
  head.style.lineHeight = '20px'
  head.style.marginBottom = '0'
  head.appendChild(createLabel())
  root.appendChild(head)

  root.appendChild(createCellsGrid(rows, cols, overlay, answerText))
  return root
}

function overlayForStyle(style: AnswerAreaStyle): GridOverlayType | undefined {
  if (style === 'axes' || style === 'number_line' || style === 'ray') return style
  return undefined
}

export async function rasterizeAnswerArea(
  block: WorksheetBlock,
  style: AnswerAreaStyle,
  subject: string,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DomImageResult> {
  const lines = getEffectiveAnswerLines(block, subject, showAnswer)
  const answerText = showAnswer ? getDisplayAnswerText(block) : undefined
  const cols = answerCellsColumnCount(SLOT_CONTENT_WIDTH_PX)
  const overlay = overlayForStyle(style)

  const cacheKey = `answer:${block.id}:${style}:${lines}:${cols}:${showAnswer}:${answerText ?? ''}`

  ensureKatexStyles(document.body)

  let dom: HTMLDivElement
  if (style === 'block') {
    dom = buildBlockDom(lines, showAnswer, answerText || undefined)
  } else if (style === 'cells' || style === 'axes' || style === 'number_line' || style === 'ray') {
    dom = buildCellsDom(lines, cols, overlay, answerText || undefined)
  } else {
    dom = buildLinesDom(lines, showAnswer, answerText || undefined)
  }

  return captureDomToPng(dom, cacheKey, ctx)
}
