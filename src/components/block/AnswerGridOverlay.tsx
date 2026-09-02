import { ANSWER_CELL_SIZE } from '@/data/blockUtils'

export type GridOverlayType = 'axes' | 'number_line' | 'ray'

const OVERLAY_STROKE = '#989cb8'

/** Figma reference: 42×20 grid — axis at col 20, row 10; line types at row 5. */
function overlayGeometry(cols: number, rows: number) {
  const cell = ANSWER_CELL_SIZE
  const width = cols * cell
  const height = rows * cell

  const axisCol = Math.min(Math.round(cols * (20 / 42)), cols)
  const axisRow = Math.min(Math.round(rows * 0.5), rows)
  const lineRow = Math.min(Math.round(rows * 0.5), rows)
  const originCol = Math.min(Math.round(cols * (18 / 42)), cols)

  return { cell, width, height, axisCol, axisRow, lineRow, originCol }
}

export function AnswerGridOverlay({
  type,
  cols,
  rows,
}: {
  type: GridOverlayType
  cols: number
  rows: number
}) {
  if (cols < 1 || rows < 1) return null

  const { cell, width, axisCol, axisRow, lineRow, originCol } = overlayGeometry(
    cols,
    rows,
  )
  const lineWidth = cols * cell + 1
  const lineHeight = rows * cell + 1

  const y = lineRow * cell
  const originX = originCol * cell
  const margin = cell

  return (
    <svg
      className="answer-grid-overlay"
      viewBox={`0 0 ${lineWidth} ${lineHeight}`}
      width={lineWidth}
      height={lineHeight}
      aria-hidden
    >
      {type === 'axes' ? (
        <>
          <line
            x1={axisCol * cell}
            y1={0}
            x2={axisCol * cell}
            y2={lineHeight}
            stroke={OVERLAY_STROKE}
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={axisRow * cell}
            x2={lineWidth}
            y2={axisRow * cell}
            stroke={OVERLAY_STROKE}
            strokeWidth={1}
          />
        </>
      ) : null}

      {type === 'number_line' ? (
        <>
          <line
            x1={margin}
            y1={y}
            x2={originX}
            y2={y}
            stroke={OVERLAY_STROKE}
            strokeWidth={1}
          />
          <line
            x1={originX}
            y1={y}
            x2={width - margin}
            y2={y}
            stroke={OVERLAY_STROKE}
            strokeWidth={1}
          />
        </>
      ) : null}

      {type === 'ray' ? (
        <line
          x1={margin}
          y1={y}
          x2={width - margin}
          y2={y}
          stroke={OVERLAY_STROKE}
          strokeWidth={1}
        />
      ) : null}
    </svg>
  )
}
