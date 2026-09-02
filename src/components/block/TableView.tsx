import type { WorksheetBlock } from '@/data/worksheet'
import { getTableAnswerBank } from '@/data/blockUtils'
import { MathText } from '@/components/MathText'

interface TableViewProps {
  block: WorksheetBlock
  editable: boolean
  selected: boolean
  isEditing: boolean
  onChange?: (patch: Partial<WorksheetBlock>) => void
}

export function TableView({
  block,
  editable,
  selected,
  isEditing,
  onChange,
}: TableViewProps) {
  const rows = block.tableRows ?? 3
  const cols = block.tableCols ?? 3
  const cells =
    block.tableCells ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
  const headers =
    block.tableHeaders ?? Array.from({ length: cols }, () => 'Название группы')

  const setHeader = (index: number, value: string) => {
    const next = [...headers]
    next[index] = value
    onChange?.({ tableHeaders: next })
  }

  const setCell = (row: number, col: number, value: string) => {
    const next = cells.map((line, ri) =>
      line.map((cell, ci) => (ri === row && ci === col ? value : cell)),
    )
    onChange?.({ tableCells: next })
  }

  const answerBank = getTableAnswerBank(block, editable, selected)

  return (
    <div className="table-widget">
      <table className="ws-table ws-table--widget">
        <thead>
          <tr>
            {headers.slice(0, cols).map((header, index) => (
              <th key={index}>
                {isEditing ? (
                  <input
                    className="table-header-input"
                    value={header}
                    placeholder="Название группы"
                    onChange={(e) => setHeader(index, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  header || 'Название группы'
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: cols }).map((_, colIndex) => {
                const value = cells[rowIndex]?.[colIndex] ?? ''
                return (
                  <td key={colIndex}>
                    {isEditing ? (
                      <input
                        className="table-cell-input"
                        value={value}
                        onChange={(e) => setCell(rowIndex, colIndex, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : value ? (
                      <MathText text={value} as="span" />
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
          {answerBank.map((word) => (
            <span key={word} className="table-answer-chip">
              {word}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
