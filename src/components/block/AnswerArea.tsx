import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import { ANSWER_CELL_SIZE } from '@/data/blockUtils'

interface AnswerAreaProps {
  block: WorksheetBlock
  style: AnswerAreaStyle
}

export function AnswerArea({ block, style }: AnswerAreaProps) {
  const lines = block.answerLines ?? (block.type === 'extended_answer' ? 5 : 1)

  if (style === 'cells') {
    return (
      <div
        className="ws-task-slot answer-cells-grid"
        style={{
          height: `${lines * ANSWER_CELL_SIZE}px`,
          ['--rows' as string]: String(lines),
        }}
        aria-hidden
      />
    )
  }

  if (style === 'block') {
    return <div className="ws-task-slot answer-block-area" style={{ minHeight: `${lines * 28}px` }} />
  }

  if (style === 'axes') {
    return (
      <div className="ws-task-slot answer-axes">
        <svg viewBox="0 0 320 120" className="axes-svg" aria-hidden>
          <line x1="20" y1="100" x2="300" y2="100" stroke="currentColor" />
          <line x1="20" y1="100" x2="20" y2="20" stroke="currentColor" />
          <polygon points="300,100 292,96 292,104" fill="currentColor" />
          <polygon points="20,20 16,28 24,28" fill="currentColor" />
        </svg>
        {Array.from({ length: Math.max(1, lines - 1) }).map((_, i) => (
          <i key={i} className="answer-line-extra" />
        ))}
      </div>
    )
  }

  if (style === 'ray') {
    return (
      <div className="ws-task-slot answer-axes">
        <svg viewBox="0 0 320 80" className="axes-svg" aria-hidden>
          <line x1="20" y1="60" x2="300" y2="60" stroke="currentColor" />
          <polygon points="300,60 292,56 292,64" fill="currentColor" />
        </svg>
      </div>
    )
  }

  return (
    <div className="ws-task-slot lines">
      {Array.from({ length: lines }).map((_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}
