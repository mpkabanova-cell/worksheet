import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import { MathEditableInput } from '@/components/MathEditableInput'
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

function AnswerLabel() {
  return <span className="answer-field-label">Ответ:</span>
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
    <MathEditableInput
      className={`answer-inline-input answer-inline-input--${style}`}
      multiline
      rows={Math.max(1, lines)}
      value={value}
      placeholder={style === 'block' ? 'Введите текст' : undefined}
      style={{ minHeight: `${minHeight}px` }}
      onChange={(text) => onChange?.(text)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function AnswerReadonlyOverlay({
  value,
  style,
  showPrefix = false,
}: {
  value: string
  style: AnswerAreaStyle
  showPrefix?: boolean
}) {
  if (showPrefix) {
    return (
      <div className={`answer-inline-readonly answer-inline-readonly--${style} answer-inline-readonly--labeled`}>
        <AnswerLabel />
        <span className="answer-field-value">
          <MathText text={value} as="span" />
        </span>
      </div>
    )
  }

  return (
    <div className={`answer-inline-readonly answer-inline-readonly--${style}`}>
      <MathText text={value} as="div" />
    </div>
  )
}

function AnswerLineRules({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <i key={i} />
      ))}
    </>
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
      <div className="answer-lines-head">
        <AnswerLabel />
      </div>
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

function LinesAnswerSlot({
  lines,
  mode,
  value,
  showAnswerValue,
  onChange,
}: {
  lines: number
  mode: 'empty' | 'edit' | 'readonly'
  value: string
  showAnswerValue?: boolean
  onChange?: (text: string) => void
}) {
  const extraLines = Math.max(0, lines - (showAnswerValue && value ? 1 : 0))

  return (
    <div className="ws-task-slot lines answer-slot">
      <div className="answer-lines-wrap">
        {showAnswerValue && value ? (
          <div className="answer-lines-body answer-area-readonly">
            <div className="answer-line-row answer-line-row--filled">
              <AnswerLabel />
              <span className="answer-field-value">
                <MathText text={value} as="span" />
              </span>
            </div>
            <AnswerLineRules count={extraLines} />
          </div>
        ) : (
          <>
            <div
              className={`answer-lines-body ${mode === 'edit' ? 'answer-area-editable' : ''} answer-lines-body--ruled`}
            >
              <div className="answer-lines-label-overlay">
                <AnswerLabel />
              </div>
              <AnswerLineRules count={lines} />
              {mode === 'edit' ? (
                <AnswerInlineEditor value={value} lines={lines} style="lines" onChange={onChange} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BlockAnswerSlot({
  lines,
  mode,
  value,
  showAnswerValue,
  onChange,
}: {
  lines: number
  mode: 'empty' | 'edit' | 'readonly'
  value: string
  showAnswerValue?: boolean
  onChange?: (text: string) => void
}) {
  return (
    <div className="ws-task-slot answer-slot">
      <div
        className="answer-block-area answer-block-area--ruled"
        style={{ minHeight: `${Math.max(lines + 1, 3) * 28}px` }}
      >
        {mode === 'empty' ? (
          <>
            <div className="answer-lines-head answer-lines-head--inset">
              <AnswerLabel />
            </div>
            <span className="answer-placeholder">Введите текст</span>
          </>
        ) : null}
        {mode === 'edit' ? (
          <>
            <div className="answer-lines-head answer-lines-head--inset">
              <AnswerLabel />
            </div>
            <AnswerInlineEditor
              value={value}
              lines={lines}
              style="block"
              onChange={onChange}
            />
          </>
        ) : null}
        {mode === 'readonly' && showAnswerValue && value ? (
          <AnswerReadonlyOverlay value={value} style="block" showPrefix />
        ) : null}
      </div>
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
        <BlockAnswerSlot
          lines={lines}
          mode="readonly"
          value={answerText}
          showAnswerValue
        />
      )
    }

    return (
      <LinesAnswerSlot
        lines={lines}
        mode="readonly"
        value={answerText}
        showAnswerValue
      />
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
        <BlockAnswerSlot
          lines={lines}
          mode="edit"
          value={rawAnswerText}
          onChange={onChangeAnswer}
        />
      )
    }

    return <LinesAnswerSlot lines={lines} mode="empty" value="" />
  }

  if (isCellGridStyle(style)) {
    return <CellsAnswerSlot rows={lines} style={style} mode="empty" value="" />
  }

  if (style === 'block') {
    return <BlockAnswerSlot lines={lines} mode="empty" value="" />
  }

  return <LinesAnswerSlot lines={lines} mode="empty" value="" />
}
