import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import { MathText } from '@/components/MathText'
import {
  ANSWER_CELL_SIZE,
  getCorrectAnswerText,
  getEffectiveAnswerLines,
} from '@/data/blockUtils'

interface AnswerAreaProps {
  block: WorksheetBlock
  style: AnswerAreaStyle
  subject: string
  showAnswer: boolean
  isEditing?: boolean
  onChangeAnswer?: (text: string) => void
}

function AnswerInlineEditor({
  value,
  lines,
  style,
  onChange,
}: {
  value: string
  lines: number
  style: AnswerAreaStyle
  onChange?: (text: string) => void
}) {
  const minHeight =
    style === 'cells'
      ? lines * ANSWER_CELL_SIZE
      : style === 'block'
        ? lines * 28
        : lines * 28

  return (
    <textarea
      className={`answer-inline-input answer-inline-input--${style}`}
      value={value}
      placeholder="Введите текст"
      rows={Math.max(1, lines)}
      style={{ minHeight: `${minHeight}px` }}
      onChange={(e) => onChange?.(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function AnswerReadonlyOverlay({
  value,
  style,
}: {
  value: string
  style: AnswerAreaStyle
}) {
  return (
    <div className={`answer-inline-readonly answer-inline-readonly--${style}`}>
      <MathText text={value} />
    </div>
  )
}

function GraphSvg({ style }: { style: 'axes' | 'number_line' | 'ray' }) {
  if (style === 'axes') {
    return (
      <svg viewBox="0 0 320 120" className="axes-svg" aria-hidden>
        <line x1="20" y1="100" x2="300" y2="100" stroke="currentColor" />
        <line x1="20" y1="100" x2="20" y2="20" stroke="currentColor" />
        <polygon points="300,100 292,96 292,104" fill="currentColor" />
        <polygon points="20,20 16,28 24,28" fill="currentColor" />
      </svg>
    )
  }

  if (style === 'number_line') {
    return (
      <svg viewBox="0 0 320 80" className="axes-svg" aria-hidden>
        <line x1="20" y1="60" x2="300" y2="60" stroke="currentColor" />
        <line x1="160" y1="52" x2="160" y2="68" stroke="currentColor" strokeWidth="1.5" />
        {[80, 120, 200, 240].map((x) => (
          <line key={x} x1={x} y1="56" x2={x} y2="64" stroke="currentColor" />
        ))}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 320 80" className="axes-svg" aria-hidden>
      <line x1="20" y1="60" x2="300" y2="60" stroke="currentColor" />
      <polygon points="300,60 292,56 292,64" fill="currentColor" />
    </svg>
  )
}

function graphExtraLines(style: 'axes' | 'number_line' | 'ray', lines: number) {
  const extraCount =
    style === 'axes' ? Math.max(1, lines - 1) : lines > 1 ? lines - 1 : 0
  return Array.from({ length: extraCount }).map((_, i) => (
    <i key={i} className="answer-line-extra" />
  ))
}

function GraphAnswerSlot({
  style,
  lines,
  mode,
  answerText,
  onChangeAnswer,
}: {
  style: 'axes' | 'number_line' | 'ray'
  lines: number
  mode: 'default' | 'edit' | 'readonly'
  answerText: string
  onChangeAnswer?: (text: string) => void
}) {
  const className = `ws-task-slot answer-axes${
    mode === 'edit' ? ' answer-area-editable' : mode === 'readonly' ? ' answer-area-readonly' : ''
  }`

  return (
    <div className={className}>
      <GraphSvg style={style} />
      {graphExtraLines(style, lines)}
      {mode === 'edit' ? (
        <AnswerInlineEditor
          value={answerText}
          lines={lines}
          style={style}
          onChange={onChangeAnswer}
        />
      ) : null}
      {mode === 'readonly' ? <AnswerReadonlyOverlay value={answerText} style={style} /> : null}
    </div>
  )
}

function isGraphStyle(style: AnswerAreaStyle): style is 'axes' | 'number_line' | 'ray' {
  return style === 'axes' || style === 'number_line' || style === 'ray'
}

export function AnswerArea({
  block,
  style,
  subject,
  showAnswer,
  isEditing,
  onChangeAnswer,
}: AnswerAreaProps) {
  const expandForAnswer = showAnswer || Boolean(isEditing)
  const lines = getEffectiveAnswerLines(block, subject, expandForAnswer)
  const answerText = getCorrectAnswerText(block)
  const cellStyle = {
    height: `${lines * ANSWER_CELL_SIZE}px`,
    ['--cell-size' as string]: `${ANSWER_CELL_SIZE}px`,
    ['--rows' as string]: String(lines),
  }

  if (isEditing) {
    if (style === 'cells') {
      return (
        <div className="ws-task-slot answer-cells-grid answer-area-editable" style={cellStyle}>
          <AnswerInlineEditor
            value={answerText}
            lines={lines}
            style={style}
            onChange={onChangeAnswer}
          />
        </div>
      )
    }

    if (style === 'block') {
      return (
        <div
          className="ws-task-slot answer-block-area answer-area-editable"
          style={{ minHeight: `${lines * 28}px` }}
        >
          <AnswerInlineEditor
            value={answerText}
            lines={lines}
            style={style}
            onChange={onChangeAnswer}
          />
        </div>
      )
    }

    if (isGraphStyle(style)) {
      return (
        <GraphAnswerSlot
          style={style}
          lines={lines}
          mode="edit"
          answerText={answerText}
          onChangeAnswer={onChangeAnswer}
        />
      )
    }

    return (
      <div className="ws-task-slot lines answer-area-editable">
        {Array.from({ length: lines }).map((_, i) => (
          <i key={i} />
        ))}
        <AnswerInlineEditor
          value={answerText}
          lines={lines}
          style={style}
          onChange={onChangeAnswer}
        />
      </div>
    )
  }

  if (showAnswer && answerText) {
    if (style === 'cells') {
      return (
        <div className="ws-task-slot answer-cells-grid answer-area-readonly" style={cellStyle}>
          <AnswerReadonlyOverlay value={answerText} style={style} />
        </div>
      )
    }

    if (style === 'block') {
      return (
        <div
          className="ws-task-slot answer-block-area answer-area-readonly"
          style={{ minHeight: `${lines * 28}px` }}
        >
          <AnswerReadonlyOverlay value={answerText} style={style} />
        </div>
      )
    }

    if (isGraphStyle(style)) {
      return (
        <GraphAnswerSlot
          style={style}
          lines={lines}
          mode="readonly"
          answerText={answerText}
        />
      )
    }

    return (
      <div className="ws-task-slot lines answer-area-readonly">
        {Array.from({ length: lines }).map((_, i) => (
          <i key={i} />
        ))}
        <AnswerReadonlyOverlay value={answerText} style={style} />
      </div>
    )
  }

  if (style === 'cells') {
    return <div className="ws-task-slot answer-cells-grid" style={cellStyle} aria-hidden />
  }

  if (style === 'block') {
    return (
      <div className="ws-task-slot answer-block-area" style={{ minHeight: `${lines * 28}px` }}>
        <span className="answer-placeholder">Введите текст</span>
      </div>
    )
  }

  if (isGraphStyle(style)) {
    return <GraphAnswerSlot style={style} lines={lines} mode="default" answerText="" />
  }

  return (
    <div className="ws-task-slot lines">
      {Array.from({ length: lines }).map((_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}
