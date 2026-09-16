import type { WorksheetBlock } from '@/data/worksheet'
import {
  GROUPING_HEADER_PLACEHOLDER,
  TABLE_COLS_DEFAULT,
  TABLE_ROWS_DEFAULT,
  getTableAnswerBank,
} from '@/data/blockUtils'
import { getGroupingLayoutSpec } from '@/export/word/layoutSpec'
import { captureDomToPng } from '@/export/word/rasterize/domToPng'
import { appendMathText, ensureKatexStyles } from '@/export/word/rasterize/renderMathHtml'
import type { DomImageResult, ExportContext } from '@/export/word/types'

const BORDER_TERTIARY = '#9399BD'
const BG_WHITE = '#ffffff'
const TEXT_DEFAULT = '#161A33'
const TEXT_SECONDARY = '#656C94'

function appendCellContent(parent: HTMLElement, text: string, positive: boolean): void {
  const trimmed = text.trim()
  if (!trimmed) return
  appendMathText(parent, trimmed, {
    fontSize: 14,
    lineHeight: 20,
    positive,
    cellsLayout: true,
    cellSize: 20,
  })
}

function createHeaderCell(text: string): HTMLTableCellElement {
  const cell = document.createElement('th')
  cell.style.fontSize = '16px'
  cell.style.fontWeight = '500'
  cell.style.lineHeight = '24px'
  cell.style.color = TEXT_SECONDARY
  cell.style.background = BG_WHITE
  cell.style.textAlign = 'left'
  cell.style.padding = '8px 12px'
  cell.style.borderRight = `1px solid ${BORDER_TERTIARY}`
  cell.style.borderBottom = `1px solid ${BORDER_TERTIARY}`
  cell.style.verticalAlign = 'middle'

  const label = text.trim() || GROUPING_HEADER_PLACEHOLDER
  appendMathText(cell, label, { fontSize: 16, lineHeight: 24, color: TEXT_SECONDARY })
  return cell
}

function createBodyCell(value: string, showAnswer: boolean): HTMLTableCellElement {
  const cell = document.createElement('td')
  cell.style.height = '32px'
  cell.style.minHeight = '32px'
  cell.style.padding = '8px'
  cell.style.borderRight = `1px solid ${BORDER_TERTIARY}`
  cell.style.borderTop = `1px solid ${BORDER_TERTIARY}`
  cell.style.verticalAlign = 'middle'
  cell.style.boxSizing = 'border-box'

  if (showAnswer && value.trim()) {
    appendCellContent(cell, value, true)
  }

  return cell
}

function createAnswerItem(text: string): HTMLSpanElement {
  const item = document.createElement('span')
  item.style.display = 'inline-flex'
  item.style.alignItems = 'center'
  item.style.fontSize = '14px'
  item.style.lineHeight = '20px'
  item.style.color = TEXT_DEFAULT
  appendMathText(item, text, { fontSize: 14, lineHeight: 20, cellsLayout: true, cellSize: 20 })
  return item
}

export async function rasterizeGrouping(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DomImageResult> {
  const rows = block.tableRows ?? TABLE_ROWS_DEFAULT
  const cols = block.tableCols ?? TABLE_COLS_DEFAULT
  const cells = block.tableCells ?? []
  const headers = block.tableHeaders ?? []
  const bank = !showAnswer ? getTableAnswerBank(block, false, false) : []
  const spec = getGroupingLayoutSpec()

  const cacheKey = [
    'grouping',
    block.id,
    showAnswer,
    rows,
    cols,
    headers.slice(0, cols).join('|'),
    cells
      .slice(0, rows)
      .map((row) => row.slice(0, cols).join('|'))
      .join(';'),
    bank.join('|'),
  ].join(':')

  ensureKatexStyles(document.body)

  const widget = document.createElement('div')
  widget.style.width = `${spec.contentWidthPx}px`
  widget.style.boxSizing = 'border-box'

  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'separate'
  table.style.borderSpacing = '0'
  table.style.border = `1px solid ${BORDER_TERTIARY}`
  table.style.borderRadius = '8px'
  table.style.overflow = 'hidden'
  table.style.tableLayout = 'fixed'
  table.style.background = BG_WHITE

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (let colIndex = 0; colIndex < cols; colIndex += 1) {
    const headerCell = createHeaderCell(headers[colIndex] ?? '')
    if (colIndex === cols - 1) {
      headerCell.style.borderRight = 'none'
    }
    headerRow.appendChild(headerCell)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = document.createElement('tr')
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const value = cells[rowIndex]?.[colIndex] ?? ''
      const cell = createBodyCell(value, showAnswer)
      if (colIndex === cols - 1) {
        cell.style.borderRight = 'none'
      }
      row.appendChild(cell)
    }
    tbody.appendChild(row)
  }
  table.appendChild(tbody)
  widget.appendChild(table)

  if (bank.length > 0) {
    const bankWrap = document.createElement('div')
    bankWrap.style.display = 'flex'
    bankWrap.style.flexWrap = 'wrap'
    bankWrap.style.gap = '24px'
    bankWrap.style.marginTop = '24px'
    for (const word of bank) {
      bankWrap.appendChild(createAnswerItem(word))
    }
    widget.appendChild(bankWrap)
  }

  const board = document.createElement('div')
  board.style.position = 'relative'
  board.style.display = 'block'
  board.style.width = `${spec.captureWidthPx}px`
  board.style.boxSizing = 'border-box'
  board.style.padding = `${spec.borderPaddingPx}px`
  board.style.overflow = 'hidden'
  board.style.background = BG_WHITE
  board.appendChild(widget)

  return captureDomToPng(board, cacheKey, ctx, undefined, {
    fitContent: false,
    contentPaddingPx: 0,
  })
}
