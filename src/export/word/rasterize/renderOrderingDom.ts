import type { WorksheetBlock } from '@/data/worksheet'
import {
  getOrderAnswerNumbers,
  getOrderDisplayItems,
} from '@/data/blockUtils'
import { getOrderingLayoutSpec } from '@/export/word/layoutSpec'
import { captureDomToPng } from '@/export/word/rasterize/domToPng'
import { appendMathText, ensureKatexStyles } from '@/export/word/rasterize/renderMathHtml'
import type { DomImageResult, ExportContext } from '@/export/word/types'

const BORDER_TERTIARY = '#9399BD'
const BG_WHITE = '#ffffff'
const TEXT_DEFAULT = '#161A33'
const TEXT_SECONDARY = '#656C94'
const TEXT_POSITIVE = '#0DB56C'

export async function rasterizeOrdering(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DomImageResult> {
  const items = getOrderDisplayItems(block, false, false)
  const answerNumbers = showAnswer ? getOrderAnswerNumbers(block) : []
  const spec = getOrderingLayoutSpec()
  const cacheKey = `ordering:${block.id}:${showAnswer}:${items.join('|')}:${answerNumbers.join(',')}`

  ensureKatexStyles(document.body)

  const stack = document.createElement('div')
  stack.style.display = 'flex'
  stack.style.flexDirection = 'column'
  stack.style.width = `${spec.contentWidthPx}px`
  stack.style.boxSizing = 'border-box'
  stack.style.border = `1px solid ${BORDER_TERTIARY}`
  stack.style.borderRadius = '8px'
  stack.style.overflow = 'hidden'
  stack.style.background = BG_WHITE

  items.forEach((item, index) => {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'stretch'
    if (index > 0) {
      row.style.borderTop = `1px solid ${BORDER_TERTIARY}`
    }

    const numCell = document.createElement('div')
    numCell.style.width = '48px'
    numCell.style.flexShrink = '0'
    numCell.style.display = 'flex'
    numCell.style.alignItems = 'center'
    numCell.style.justifyContent = 'center'
    numCell.style.padding = '10px 8px'
    numCell.style.borderRight = `1px solid ${BORDER_TERTIARY}`
    numCell.style.fontSize = '14px'
    numCell.style.lineHeight = '20px'
    numCell.style.textAlign = 'center'
    numCell.style.boxSizing = 'border-box'

    if (showAnswer && answerNumbers[index]) {
      numCell.textContent = String(answerNumbers[index])
      numCell.style.color = TEXT_POSITIVE
      numCell.style.fontWeight = '500'
    }

    const body = document.createElement('div')
    body.style.flex = '1'
    body.style.minWidth = '0'
    body.style.display = 'flex'
    body.style.alignItems = 'center'
    body.style.minHeight = '40px'
    body.style.padding = '10px 12px'
    body.style.boxSizing = 'border-box'
    body.style.fontSize = '14px'
    body.style.lineHeight = '20px'

    const trimmed = item.trim()
    if (trimmed) {
      body.style.color = TEXT_DEFAULT
      appendMathText(body, trimmed, { fontSize: 14, lineHeight: 20 })
    } else {
      body.style.color = TEXT_SECONDARY
      body.textContent = 'Текст'
    }

    row.appendChild(numCell)
    row.appendChild(body)
    stack.appendChild(row)
  })

  const board = document.createElement('div')
  board.style.position = 'relative'
  board.style.display = 'block'
  board.style.width = `${spec.captureWidthPx}px`
  board.style.boxSizing = 'border-box'
  board.style.padding = `${spec.borderPaddingPx}px`
  board.style.overflow = 'hidden'
  board.style.background = BG_WHITE
  board.appendChild(stack)

  return captureDomToPng(board, cacheKey, ctx, undefined, {
    fitContent: false,
    contentPaddingPx: 0,
  })
}
