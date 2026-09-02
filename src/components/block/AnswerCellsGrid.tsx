import { useLayoutEffect, useRef, useState } from 'react'
import { MathText } from '@/components/MathText'
import { ANSWER_CELL_SIZE } from '@/data/blockUtils'
import { AnswerGridOverlay, type GridOverlayType } from '@/components/block/AnswerGridOverlay'

type CellsMode = 'empty' | 'edit' | 'readonly'

export function AnswerCellsGrid({
  rows,
  mode,
  value,
  overlay,
  onChange,
}: {
  rows: number
  mode: CellsMode
  value: string
  overlay?: GridOverlayType
  onChange?: (text: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const update = () => {
      const width = el.clientWidth
      setCols(Math.max(1, Math.floor(width / ANSWER_CELL_SIZE)))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const gridWidth = cols > 0 ? cols * ANSWER_CELL_SIZE : undefined
  const gridHeight = rows * ANSWER_CELL_SIZE

  return (
    <div ref={wrapRef} className="answer-cells-wrap">
      <div
        className={`answer-cells-grid${mode === 'edit' ? ' answer-area-editable' : ''}${mode === 'readonly' ? ' answer-area-readonly' : ''}`}
        style={{
          width: gridWidth,
          height: gridHeight,
          ['--cell-size' as string]: `${ANSWER_CELL_SIZE}px`,
          ['--cols' as string]: String(cols),
          ['--rows' as string]: String(rows),
        }}
        aria-hidden={mode === 'empty' ? true : undefined}
      >
        {mode === 'edit' ? (
          <textarea
            className="answer-inline-input answer-inline-input--cells"
            value={value}
            rows={rows}
            spellCheck={false}
            onChange={(e) => onChange?.(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
        {mode === 'readonly' && value ? (
          <div className="answer-inline-readonly answer-inline-readonly--cells">
            <MathText text={value} as="div" />
          </div>
        ) : null}
        {overlay && cols > 0 ? (
          <AnswerGridOverlay type={overlay} cols={cols} rows={rows} />
        ) : null}
      </div>
    </div>
  )
}
