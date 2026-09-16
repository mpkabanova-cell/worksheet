import { useState } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import {
  GROUPING_HEADER_PLACEHOLDER,
  TABLE_COLS_DEFAULT,
  TABLE_ROWS_DEFAULT,
  getTableAnswerBank,
} from '@/data/blockUtils'
import { MathEditableInput } from '@/components/MathEditableInput'
import { MathText } from '@/components/MathText'

interface TableViewProps {
  block: WorksheetBlock
  editable: boolean
  selected: boolean
  isEditing: boolean
  showAnswer?: boolean
  onChange?: (patch: Partial<WorksheetBlock>) => void
}

type ActiveCell = { kind: 'header'; index: number } | { kind: 'body'; row: number; col: number }

export function TableView({
  block,
  editable,
  selected,
  isEditing,
  showAnswer = false,
  onChange,
}: TableViewProps) {
  const rows = block.tableRows ?? TABLE_ROWS_DEFAULT
  const cols = block.tableCols ?? TABLE_COLS_DEFAULT
  const cells =
    block.tableCells ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
  const headers =
    block.tableHeaders ?? Array.from({ length: cols }, () => GROUPING_HEADER_PLACEHOLDER)
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)

  const setHeader = (index: number, value: string) => {
    const next = [...headers]
    next[index] = value
    onChange?.({ tableHeaders: next })
  }

  const setCell = (row: number, col: number, value: string) => {
    const next = cells.map((line, rowIndex) =>
      line.map((cell, colIndex) => (rowIndex === row && colIndex === col ? value : cell)),
    )
    onChange?.({ tableCells: next })
  }

  const answerBank = getTableAnswerBank(block, editable, selected)
  const showCellValues = isEditing || showAnswer

  const isActive = (cell: ActiveCell) =>
    activeCell?.kind === cell.kind &&
    (cell.kind === 'header'
      ? activeCell.kind === 'header' && activeCell.index === cell.index
      : activeCell.kind === 'body' && activeCell.row === cell.row && activeCell.col === cell.col)

  return (
    <div className="table-widget">
      <table className="ws-table ws-table--widget">
        <thead>
          <tr>
            {headers.slice(0, cols).map((header, index) => {
              const cell = { kind: 'header' as const, index }
              const editingHeader = isEditing && isActive(cell)

              return (
                <th key={index}>
                  {editingHeader ? (
                    <MathEditableInput
                      className="table-header-input"
                      value={header}
                      placeholder={GROUPING_HEADER_PLACEHOLDER}
                      showToolbar
                      floatingToolbar
                      onChange={(value) => setHeader(index, value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : isEditing ? (
                    <button
                      type="button"
                      className={`table-cell-trigger ${!header.trim() ? 'is-placeholder' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveCell(cell)
                      }}
                    >
                      {header.trim() ? (
                        <MathText text={header} as="span" />
                      ) : (
                        GROUPING_HEADER_PLACEHOLDER
                      )}
                    </button>
                  ) : (
                    <span className={!header.trim() ? 'is-placeholder' : undefined}>
                      {header.trim() ? <MathText text={header} as="span" /> : GROUPING_HEADER_PLACEHOLDER}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: cols }).map((_, colIndex) => {
                const value = cells[rowIndex]?.[colIndex] ?? ''
                const cell = { kind: 'body' as const, row: rowIndex, col: colIndex }
                const editingCell = isEditing && isActive(cell)
                const visibleValue = showCellValues ? value : ''
                const showAsAnswer = showAnswer && !isEditing && value.trim()

                return (
                  <td key={colIndex}>
                    {editingCell ? (
                      <MathEditableInput
                        className="table-cell-input"
                        value={value}
                        placeholder="Введите текст"
                        showToolbar
                        floatingToolbar
                        onChange={(nextValue) => setCell(rowIndex, colIndex, nextValue)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : isEditing ? (
                      <button
                        type="button"
                        className={`table-cell-trigger ${!value.trim() ? 'is-empty' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveCell(cell)
                        }}
                      >
                        {value.trim() ? <MathText text={value} as="span" /> : null}
                      </button>
                    ) : showAsAnswer ? (
                      <span className="table-cell-answer">
                        <MathText text={value} as="span" />
                      </span>
                    ) : visibleValue ? (
                      <MathText text={visibleValue} as="span" />
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {answerBank.length > 0 ? (
        <div className="table-answer-bank">
          {answerBank.map((word, index) => (
            <span key={`${word}-${index}`} className="table-answer-chip">
              <MathText text={word} as="span" />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
