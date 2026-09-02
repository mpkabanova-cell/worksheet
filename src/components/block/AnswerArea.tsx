import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import { MathText } from '@/components/MathText'
import { AnswerCellsGrid } from '@/components/block/AnswerCellsGrid'
import type { GridOverlayType } from '@/components/block/AnswerGridOverlay'
import {
  getDisplayAnswerText,
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
  const minHeight = lines * 28

  return (
    <textarea
      className={`answer-inline-input answer-inline-input--${style}`}
      value={value}
      placeholder={style === 'block' ? 'Введите текст' : undefined}
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
      <MathText text={value} as="div" />
    </div>
  )
}

function gridOverlayForStyle(style: AnswerAreaStyle): GridOverlayType | undefined {
  if (style === 'axes' || style === 'number_line' || style === 'ray') return style
  return undefined
}

function isCellGridStyle(
  style: AnswerAreaStyle,
): style is 'cells' | 'axes' | 'number_line' | 'ray' {
  return style === 'cells' || style === 'axes' || style === 'number_line' || style === 'ray'
}

function CellsAnswerSlot({
  rows,
  style,
  mode,
  value,
  onChange,
}: {
  rows: number
  style: 'cells' | 'axes' | 'number_line' | 'ray'
  mode: 'empty' | 'edit' | 'readonly'
  value: string
  onChange?: (text: string) => void
}) {
  return (
    <div className="ws-task-slot answer-cells-slot">
      <AnswerCellsGrid
        rows={rows}
        overlay={gridOverlayForStyle(style)}
        mode={mode}
        value={value}
        onChange={onChange}
      />
    </div>
  )
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
  const answerText = getDisplayAnswerText(block)
  const rawAnswerText = block.correctAnswers?.[0] ?? answerText
  const editingAnswer = Boolean(isEditing && onChangeAnswer)

  if (showAnswer && answerText) {
    if (isCellGridStyle(style)) {
      return (
        <CellsAnswerSlot rows={lines} style={style} mode="readonly" value={answerText} />
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

    return (
      <div className="ws-task-slot lines answer-area-readonly">
        {Array.from({ length: lines }).map((_, i) => (
          <i key={i} />
        ))}
        <AnswerReadonlyOverlay value={answerText} style={style} />
      </div>
    )
  }

  if (editingAnswer) {
    if (isCellGridStyle(style)) {
      return (
        <CellsAnswerSlot
          rows={lines}
          style={style}
          mode="edit"
          value={rawAnswerText}
          onChange={onChangeAnswer}
        />
      )
    }

    if (style === 'block') {
      return (
        <div
          className="ws-task-slot answer-block-area answer-area-editable"
          style={{ minHeight: `${lines * 28}px` }}
        >
          <AnswerInlineEditor
            value={rawAnswerText}
            lines={lines}
            style={style}
            onChange={onChangeAnswer}
          />
        </div>
      )
    }

    return (
      <div className="ws-task-slot lines answer-area-editable">
        {Array.from({ length: lines }).map((_, i) => (
          <i key={i} />
        ))}
        <AnswerInlineEditor
          value={rawAnswerText}
          lines={lines}
          style={style}
          onChange={onChangeAnswer}
        />
      </div>
    )
  }

  if (isCellGridStyle(style)) {
    return <CellsAnswerSlot rows={lines} style={style} mode="empty" value="" />
  }

  if (style === 'block') {
    return (
      <div className="ws-task-slot answer-block-area" style={{ minHeight: `${lines * 28}px` }}>
        <span className="answer-placeholder">Введите текст</span>
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
