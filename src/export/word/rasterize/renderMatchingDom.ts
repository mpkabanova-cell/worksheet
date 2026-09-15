import type { ChoiceOptionFormat, MatchPair, WorksheetBlock } from '@/data/worksheet'
import {
  getMatchingCorrectLinks,
  getMatchingRightItems,
} from '@/data/blockUtils'
import { MATCHING_EXPORT_WIDTH_PX } from '@/export/word/layoutTokens'
import { captureDomToPng } from '@/export/word/rasterize/domToPng'
import { appendMathText, ensureKatexStyles } from '@/export/word/rasterize/renderMathHtml'
import type { DomImageResult, ExportContext } from '@/export/word/types'
import choiceImagePlaceholder from '@/assets/worksheet/choice-image-placeholder.png'

const SLOT_WIDTH_PX = MATCHING_EXPORT_WIDTH_PX
const BORDER_TERTIARY = '#9399BD'
const BORDER_BRAND = '#503AE0'
const BG_WHITE = '#ffffff'
const TEXT_TERTIARY = '#9399BD'
const TEXT_DEFAULT = '#161A33'

interface MatchLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

function isImageFormat(format: ChoiceOptionFormat): boolean {
  return format === 'image' || format === 'text_image'
}

/** Platform correct-match frame: brand border only, no background fill. */
function applyCorrectBorder(el: HTMLElement): void {
  el.style.border = `1px solid ${BORDER_BRAND}`
}

function createDot(highlighted: boolean): HTMLSpanElement {
  const wrap = document.createElement('span')
  wrap.style.display = 'inline-flex'
  wrap.style.width = '20px'
  wrap.style.height = '20px'
  wrap.style.flexShrink = '0'
  wrap.style.alignItems = 'center'
  wrap.style.justifyContent = 'center'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '20')
  svg.setAttribute('height', '20')
  svg.setAttribute('viewBox', '0 0 20 20')

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', '10')
  circle.setAttribute('cy', '10')
  circle.setAttribute('r', '9')
  circle.setAttribute('fill', highlighted ? BORDER_BRAND : BG_WHITE)
  circle.setAttribute('stroke', highlighted ? BORDER_BRAND : BORDER_TERTIARY)
  circle.setAttribute('stroke-width', '1')
  svg.appendChild(circle)
  wrap.appendChild(svg)
  return wrap
}

function createTextBox(text: string, highlighted: boolean): HTMLDivElement {
  const box = document.createElement('div')
  box.style.flex = '1'
  box.style.minWidth = '0'
  box.style.minHeight = '48px'
  box.style.display = 'flex'
  box.style.alignItems = 'center'
  box.style.boxSizing = 'border-box'
  box.style.border = `1px solid ${highlighted ? BORDER_BRAND : BORDER_TERTIARY}`
  box.style.borderRadius = '12px'
  box.style.padding = '12px 12px 12px 16px'
  box.style.fontSize = '14px'
  box.style.lineHeight = '20px'
  box.style.color = TEXT_DEFAULT
  box.style.background = BG_WHITE
  if (highlighted) {
    applyCorrectBorder(box)
  }

  const trimmed = text.trim()
  if (!trimmed) {
    box.style.color = TEXT_TERTIARY
    box.textContent = 'Ответ'
  } else {
    appendMathText(box, trimmed, { fontSize: 14, lineHeight: 20 })
  }

  return box
}

function createImageBox(item: MatchPair, highlighted: boolean): HTMLDivElement {
  const box = document.createElement('div')
  box.style.position = 'relative'
  box.style.flex = '1'
  box.style.minWidth = '0'
  box.style.maxWidth = '268px'
  box.style.aspectRatio = '1 / 1'
  box.style.border = `1px solid ${highlighted ? BORDER_BRAND : BORDER_TERTIARY}`
  box.style.borderRadius = '12px'
  box.style.overflow = 'hidden'
  box.style.background = '#E4E6F7'
  if (highlighted) {
    applyCorrectBorder(box)
  }

  const img = document.createElement('img')
  img.src = item.imageData || choiceImagePlaceholder
  img.alt = ''
  img.style.width = '100%'
  img.style.height = '100%'
  img.style.objectFit = 'cover'
  img.style.display = 'block'
  box.appendChild(img)

  return box
}

function createItemCell(
  format: ChoiceOptionFormat,
  item: MatchPair,
  highlighted: boolean,
): HTMLDivElement {
  if (isImageFormat(format)) {
    return createImageBox(item, highlighted)
  }
  return createTextBox(item.text, highlighted)
}

function createSide(
  side: 'left' | 'right',
  format: ChoiceOptionFormat,
  item: MatchPair,
  highlighted: boolean,
): { sideEl: HTMLDivElement; dot: HTMLSpanElement } {
  const sideEl = document.createElement('div')
  sideEl.style.flex = '1'
  sideEl.style.minWidth = '0'
  sideEl.style.display = 'flex'
  sideEl.style.alignItems = 'center'
  sideEl.style.gap = '8px'
  sideEl.style.justifyContent = side === 'left' ? 'flex-end' : 'flex-start'

  const cell = createItemCell(format, item, highlighted)
  const dot = createDot(highlighted)

  if (side === 'left') {
    sideEl.appendChild(cell)
    sideEl.appendChild(dot)
  } else {
    sideEl.appendChild(dot)
    sideEl.appendChild(cell)
  }

  return { sideEl, dot }
}

function measureMatchLines(
  board: HTMLDivElement,
  leftDots: HTMLSpanElement[],
  rightDots: HTMLSpanElement[],
  links: { leftIndex: number; rightIndex: number }[],
): MatchLine[] {
  const boardRect = board.getBoundingClientRect()
  return links
    .map(({ leftIndex, rightIndex }) => {
      const leftDot = leftDots[leftIndex]?.getBoundingClientRect()
      const rightDot = rightDots[rightIndex]?.getBoundingClientRect()
      if (!leftDot || !rightDot) return null
      return {
        x1: leftDot.left + leftDot.width / 2 - boardRect.left,
        y1: leftDot.top + leftDot.height / 2 - boardRect.top,
        x2: rightDot.left + rightDot.width / 2 - boardRect.left,
        y2: rightDot.top + rightDot.height / 2 - boardRect.top,
      }
    })
    .filter((line): line is MatchLine => line !== null)
}

function addMatchLinesSvg(board: HTMLDivElement, lines: MatchLine[]): void {
  if (lines.length === 0) return

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.position = 'absolute'
  svg.style.inset = '0'
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.pointerEvents = 'none'
  svg.style.overflow = 'visible'

  for (const line of lines) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    el.setAttribute('x1', String(line.x1))
    el.setAttribute('y1', String(line.y1))
    el.setAttribute('x2', String(line.x2))
    el.setAttribute('y2', String(line.y2))
    el.setAttribute('stroke', BORDER_BRAND)
    el.setAttribute('stroke-width', '2')
    svg.appendChild(el)
  }

  board.insertBefore(svg, board.firstChild)
}

export async function rasterizeMatching(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DomImageResult> {
  const leftFormat = block.matchingLeftFormat ?? 'text'
  const rightFormat = block.matchingRightFormat ?? 'text'
  const left = block.leftItems ?? []
  const right = getMatchingRightItems(block, false, false)
  const links = showAnswer ? getMatchingCorrectLinks(block, right) : []
  const highlightedLeft = new Set(links.map((l) => l.leftIndex))
  const highlightedRight = new Set(links.map((l) => l.rightIndex))
  const rowCount = Math.max(left.length, right.length)

  const cacheKey = `matching:${block.id}:${showAnswer}:${(block.correctAnswers ?? []).join('|')}:${rowCount}:${left.map((i) => i.text).join('|')}:${right.map((i) => i.text).join('|')}`

  ensureKatexStyles(document.body)

  const board = document.createElement('div')
  board.style.position = 'relative'
  board.style.width = `${SLOT_WIDTH_PX}px`
  board.style.maxWidth = `${SLOT_WIDTH_PX}px`
  board.style.boxSizing = 'border-box'
  board.style.overflow = 'visible'

  const rowsWrap = document.createElement('div')
  rowsWrap.style.display = 'flex'
  rowsWrap.style.flexDirection = 'column'
  rowsWrap.style.gap = '16px'
  rowsWrap.style.width = '100%'

  const leftDots: HTMLSpanElement[] = []
  const rightDots: HTMLSpanElement[] = []
  const emptyItem = (id: string): MatchPair => ({ id, text: '' })

  for (let index = 0; index < rowCount; index += 1) {
    const leftItem = left[index] ?? emptyItem(`left-${index}`)
    const rightItem = right[index] ?? emptyItem(`right-${index}`)

    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '40px'
    row.style.width = '100%'

    const leftSide = createSide('left', leftFormat, leftItem, highlightedLeft.has(index))
    const rightSide = createSide('right', rightFormat, rightItem, highlightedRight.has(index))

    leftDots[index] = leftSide.dot
    rightDots[index] = rightSide.dot

    row.appendChild(leftSide.sideEl)
    row.appendChild(rightSide.sideEl)
    rowsWrap.appendChild(row)
  }

  board.appendChild(rowsWrap)

  return captureDomToPng(
    board,
    cacheKey,
    ctx,
    showAnswer && links.length > 0
      ? () => {
          const matchLines = measureMatchLines(board, leftDots, rightDots, links)
          addMatchLinesSvg(board, matchLines)
        }
      : undefined,
  )
}
