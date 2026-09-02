import type { DragEvent } from 'react'
import { useEffect, useState } from 'react'
import type { BlockPreviewState, WorksheetBlock } from '@/data/worksheet'
import {
  clampText,
  getBlockAnswerStyle,
  getConfiguredAnswerLines,
  getCorrectAnswerText,
  getGapsSourceText,
  getGapsStudentText,
  getOrderDisplayItems,
  getTableAnswerBank,
  QUESTION_MAX_LENGTH,
  TEXT_BODY_MAX_LENGTH,
} from '@/data/blockUtils'
import { getBlockQuestion } from '@/data/taskContent'
import { MathText } from '@/components/MathText'
import { WysiwygTextarea } from '@/components/WysiwygTextarea'
import { FigmaIcon } from '@/components/ui'
import { AnswerArea } from '@/components/block/AnswerArea'
import { FillGapsEditor, FillGapsStudent } from '@/components/block/FillGapsBody'
import { MatchingView } from '@/components/block/MatchingView'
import { MediaBlockView } from '@/components/block/MediaBlockView'
import starFilled from '@/assets/worksheet/star-filled.svg'
import starEmpty from '@/assets/worksheet/star-empty.svg'
import widgetArrowUp from '@/assets/worksheet/tools/widget-arrow-up.svg'
import widgetArrowDown from '@/assets/worksheet/tools/widget-arrow-down.svg'
import widgetRegenerate from '@/assets/worksheet/tools/widget-regenerate.svg'
import widgetDuplicate from '@/assets/worksheet/tools/widget-duplicate.svg'
import widgetTrash from '@/assets/worksheet/tools/widget-trash.svg'
import widgetDragHandle from '@/assets/worksheet/tools/widget-drag-handle.svg'

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`Сложность ${value} из 3`}>
      {[1, 2, 3].map((n) => (
        <img
          key={n}
          src={n <= value ? starFilled : starEmpty}
          alt=""
          width={16}
          height={16}
          className={n <= value ? 'filled' : ''}
        />
      ))}
    </span>
  )
}

function DifficultyPicker({
  value,
  onChange,
  onClear,
}: {
  value?: number
  onChange: (value: 1 | 2 | 3) => void
  onClear: () => void
}) {
  return (
    <span className="diff-picker diff-picker--inline" onClick={(e) => e.stopPropagation()}>
      {([1, 2, 3] as const).map((n) => (
        <button
          key={n}
          type="button"
          className={(value ?? 0) >= n ? 'on' : ''}
          onClick={() => onChange(n)}
          aria-label={`Сложность ${n}`}
        >
          <img
            src={(value ?? 0) >= n ? starFilled : starEmpty}
            alt=""
            width={16}
            height={16}
          />
        </button>
      ))}
      <button type="button" className="diff-clear" onClick={onClear}>
        Сбросить
      </button>
    </span>
  )
}

export function BlockCard({
  block,
  taskNumber,
  subject,
  editable,
  selected,
  showAnswer,
  showDifficulty,
  previewState,
  dragging,
  onSelect,
  onChangeBlock,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRegenerateBlock,
  onDragStart,
  onDragEnd,
}: {
  block: WorksheetBlock
  taskNumber: number
  subject: string
  editable: boolean
  selected: boolean
  showAnswer: boolean
  showDifficulty: boolean
  previewState?: BlockPreviewState | null
  dragging?: boolean
  onSelect: () => void
  onChangeBlock?: (block: WorksheetBlock) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onRegenerateBlock: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}) {
  const isIssued = block.issued === true || previewState === 'issued'
  const isEditing = editable && selected && !!onChangeBlock && !isIssued
  const [editingQuestion, setEditingQuestion] = useState(false)

  useEffect(() => {
    if (!selected) setEditingQuestion(false)
  }, [selected, block.id])

  const patchBlock = (patch: Partial<WorksheetBlock>) => {
    onChangeBlock?.({ ...block, ...patch })
  }

  if (block.type === 'page_break') {
    if (!editable) return null
    return (
      <div className={`ws-task-wrap ${selected ? 'selected' : ''} editable`}>
        {selected ? (
          <BlockTools
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onRegenerateBlock={onRegenerateBlock}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ) : null}
        <div
          className={`page-break-block ${selected ? 'selected' : ''} editable ${dragging ? 'dragging' : ''}`}
          onClick={onSelect}
        >
          — Разрыв страницы —
        </div>
      </div>
    )
  }

  if (block.type === 'answer_field') {
    return (
      <div className={`ws-task-wrap ${selected ? 'selected' : ''} ${editable ? 'editable' : ''}`}>
        {editable && selected ? (
          <BlockTools
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onRegenerateBlock={onRegenerateBlock}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ) : null}
        <article
          className={`ws-task plain media-task ${selected ? 'selected' : ''} ${editable ? 'editable' : ''}`}
          onClick={editable ? onSelect : undefined}
        >
          <MediaBlockView
            block={block}
            editable={editable}
            selected={selected}
            onChange={onChangeBlock}
          />
        </article>
      </div>
    )
  }

  const question = getBlockQuestion(block)
  const questionText = block.question?.trim() ?? question.trim()
  const isQuestionEmpty = !questionText
  const isPlainText = block.type === 'text'
  const rows = block.tableRows ?? 3
  const cols = block.tableCols ?? 3
  const cells = block.tableCells
  const headers = block.tableHeaders ?? Array.from({ length: cols }, (_, i) => `Группа ${i + 1}`)
  const gapsStudentText = getGapsStudentText(block)
  const answerStyle = getBlockAnswerStyle(block, subject)
  const isAnswerBlock = block.type === 'short_answer' || block.type === 'extended_answer'
  const configuredHeight = isAnswerBlock ? getConfiguredAnswerLines(block, subject) : 0
  const effectiveShowAnswer = showAnswer || previewState === 'show-answer'
  const visualState: BlockPreviewState =
    previewState && isAnswerBlock
      ? previewState
      : isIssued && isAnswerBlock
        ? 'issued'
        : effectiveShowAnswer && isAnswerBlock
          ? 'show-answer'
          : selected
            ? 'active'
            : 'default'

  return (
    <div
      className={`ws-task-wrap ${selected ? 'selected' : ''} ${editable ? 'editable' : ''} ${previewState && isAnswerBlock ? 'has-preview-state' : ''} ${isIssued ? 'is-issued' : ''}`}
    >
      {editable && selected && !isIssued ? (
        <BlockTools
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onRegenerateBlock={onRegenerateBlock}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ) : null}
      {editable && selected && isIssued ? (
        <BlockTools duplicateOnly onDuplicate={onDuplicate} />
      ) : null}
      <article
        className={`ws-task ws-task--${visualState} ${selected && visualState === 'active' ? 'selected' : ''} ${editable && !isIssued ? 'editable' : ''} ${isIssued ? 'issued' : ''} ${isPlainText ? 'plain' : ''} ${isAnswerBlock ? 'answer-task' : ''} ${isEditing ? 'editing-inline' : ''} ${dragging ? 'dragging' : ''}`}
        onClick={
          editable
            ? (e) => {
                onSelect()
                if (!(e.target as HTMLElement).closest('.ws-task-question-row')) {
                  setEditingQuestion(false)
                }
              }
            : undefined
        }
        title={isIssued ? 'Задание выдано. Создайте копию для редактирования.' : undefined}
      >
        {isIssued && isAnswerBlock ? (
          <p className="ws-task-issued-label">Выдано — создайте копию для редактирования</p>
        ) : null}

        {!isPlainText ? (
          <div className={`ws-task-head ${isAnswerBlock ? 'ws-task-head--answer' : ''}`}>
            <span className="ws-task-num">{taskNumber}.</span>
            <div className="ws-task-main">
              <div className="ws-task-question-row">
                {isEditing && editingQuestion ? (
                  <WysiwygTextarea
                    className="ws-inline-textarea"
                    rows={2}
                    value={block.question ?? question}
                    maxLength={QUESTION_MAX_LENGTH}
                    placeholder="Введите текст"
                    floatingToolbar
                    onChange={(value) =>
                      patchBlock({ question: clampText(value, QUESTION_MAX_LENGTH) })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : isEditing ? (
                  <p
                    className={`ws-task-text ws-task-text--clickable ${isQuestionEmpty ? 'is-placeholder' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingQuestion(true)
                    }}
                  >
                    {isQuestionEmpty ? (
                      'Введите текст'
                    ) : (
                      <MathText text={block.question ?? question} as="span" />
                    )}
                  </p>
                ) : (
                  <p className={`ws-task-text ${isQuestionEmpty ? 'is-placeholder' : ''}`}>
                    {isQuestionEmpty ? 'Введите текст' : <MathText text={question} />}
                  </p>
                )}
              </div>
              {isAnswerBlock ? (
                <div className="ws-task-meta">
                  <span className="diff-label">Сложность:</span>
                  {isEditing ? (
                    <DifficultyPicker
                      value={block.difficulty}
                      onChange={(n) => patchBlock({ difficulty: n })}
                      onClear={() => patchBlock({ difficulty: undefined })}
                    />
                  ) : (
                    <Stars value={block.difficulty ?? 0} />
                  )}
                </div>
              ) : isEditing || (showDifficulty && block.difficulty) ? (
                <div className="ws-task-meta">
                  <span className="diff-label">Сложность:</span>
                  {isEditing ? (
                    <DifficultyPicker
                      value={block.difficulty}
                      onChange={(n) => patchBlock({ difficulty: n })}
                      onClear={() => patchBlock({ difficulty: undefined })}
                    />
                  ) : block.difficulty ? (
                    <Stars value={block.difficulty} />
                  ) : null}
                </div>
              ) : null}
            </div>
            {isAnswerBlock && selected ? (
              <span className="ws-task-height-badge" aria-label={`Высота блока ${configuredHeight}`}>
                {configuredHeight}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="ws-task-main plain-body">
            {isEditing ? (
              <WysiwygTextarea
                className="ws-inline-textarea"
                rows={6}
                value={block.body ?? ''}
                maxLength={TEXT_BODY_MAX_LENGTH}
                placeholder="Текст блока…"
                floatingToolbar
                onChange={(value) =>
                  patchBlock({ body: clampText(value, TEXT_BODY_MAX_LENGTH) })
                }
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="ws-task-text">
                <MathText text={block.body ?? ''} />
              </div>
            )}
          </div>
        )}

        {block.type === 'single_choice' || block.type === 'multiple_choice' ? (
          <div className="ws-task-slot options">
            {(block.options ?? []).map((opt, index) => {
              const correct =
                block.type === 'single_choice'
                  ? opt.id === block.correctOptionId
                  : (block.correctOptionIds ?? []).includes(opt.id)

              if (isEditing) {
                return (
                  <label key={opt.id} className="option option-edit">
                    <span className="checkbox" />
                    <input
                      className="option-inline-input"
                      value={opt.text}
                      placeholder={`Вариант ${String.fromCharCode(65 + index)}`}
                      onChange={(e) => {
                        const options = (block.options ?? []).map((item, i) =>
                          i === index ? { ...item, text: e.target.value } : item,
                        )
                        patchBlock({ options })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                )
              }

              return (
                <label key={opt.id} className={`option ${showAnswer && correct ? 'correct' : ''}`}>
                  <span className="checkbox" />
                  <MathText text={opt.text} />
                </label>
              )
            })}
          </div>
        ) : null}

        {isAnswerBlock ? (
          <AnswerArea
            block={block}
            style={answerStyle}
            subject={subject}
            showAnswer={effectiveShowAnswer}
            isEditing={isEditing}
            onChangeAnswer={(text) =>
              patchBlock({
                correctAnswers: text
                  ? [text.replace(/^Ответ\s*:\s*/i, '').trim()]
                  : [],
              })
            }
          />
        ) : null}

        {block.type === 'fill_gaps' ? (
          <div className="ws-task-slot">
            {isEditing ? (
              <FillGapsEditor
                sourceText={getGapsSourceText(block)}
                gapWords={block.gapsAnswers ?? []}
                onChange={patchBlock}
              />
            ) : (
              <FillGapsStudent
                text={gapsStudentText}
                gapWords={showAnswer ? (block.gapsAnswers ?? []) : []}
                showAnswer={showAnswer}
              />
            )}
          </div>
        ) : null}

        {block.type === 'matching' ? (
          <div className="ws-task-slot matching-slot">
            <MatchingView
              block={block}
              editable={editable}
              selected={selected}
              showAnswer={showAnswer}
            />
          </div>
        ) : null}

        {block.type === 'grouping' ? (
          <div className="ws-task-slot group-grid">
            {(block.groups ?? []).map((g) => (
              <div key={g.id} className="group-card">
                <strong>
                  <MathText text={g.title} />
                </strong>
                <ul>
                  {(g.items ?? []).map((item) => (
                    <li key={item}>
                      <MathText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {block.type === 'ordering' ? (
          <ol
            className={`ws-task-slot order-list ${editable && selected ? 'ordered-edit' : 'ordered-student'}`}
          >
            {getOrderDisplayItems(block, editable, selected).map((item) => (
              <li key={item}>
                <MathText text={item} />
              </li>
            ))}
          </ol>
        ) : null}

        {block.type === 'table' ? (
          <div className="ws-task-slot table-slot">
            <table className="ws-table">
              <thead>
                <tr>
                  {headers.slice(0, cols).map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }).map((_, r) => (
                  <tr key={r}>
                    {Array.from({ length: cols }).map((_, c) => (
                      <td key={c}>{cells?.[r]?.[c] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {getTableAnswerBank(block, editable, selected).length > 0 ? (
              <div className="table-answer-bank">
                {getTableAnswerBank(block, editable, selected).map((word) => (
                  <span key={word} className="table-answer-chip">
                    {word}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {effectiveShowAnswer &&
        block.type !== 'matching' &&
        !isAnswerBlock &&
        (block.correctAnswers?.length || block.correctOptionId) ? (
          <div className="ws-task-slot">
            <div className="answer-pill">
              Ответ:{' '}
              <MathText
                text={
                  (isAnswerBlock ? getCorrectAnswerText(block) : block.correctAnswers?.join(', ')) ||
                  block.options?.find((o) => o.id === block.correctOptionId)?.text ||
                  (block.correctOptionIds ?? [])
                    .map((id) => block.options?.find((o) => o.id === id)?.text)
                    .filter(Boolean)
                    .join(', ') ||
                  ''
                }
              />
            </div>
          </div>
        ) : null}
      </article>
    </div>
  )
}

function BlockTools({
  duplicateOnly = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDuplicate,
  onRegenerateBlock,
  onDragStart,
  onDragEnd,
}: {
  duplicateOnly?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  onDuplicate: () => void
  onRegenerateBlock?: () => void
  onDragStart?: (e: DragEvent) => void
  onDragEnd?: () => void
}) {
  return (
    <>
      {!duplicateOnly && onDragStart && onDragEnd ? (
        <span
          className="block-drag-side"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          aria-label="Перетащить"
        >
          <FigmaIcon src={widgetDragHandle} size={20} />
        </span>
      ) : null}
      <div className="block-tools" onClick={(e) => e.stopPropagation()}>
        {!duplicateOnly && onMoveUp ? (
          <button type="button" className="block-tool-btn" onClick={onMoveUp} aria-label="Вверх">
            <FigmaIcon src={widgetArrowUp} size={16} />
          </button>
        ) : null}
        {!duplicateOnly && onMoveDown ? (
          <button type="button" className="block-tool-btn" onClick={onMoveDown} aria-label="Вниз">
            <FigmaIcon src={widgetArrowDown} size={16} />
          </button>
        ) : null}
        {!duplicateOnly && onRegenerateBlock ? (
          <button type="button" className="block-tool-btn" onClick={onRegenerateBlock} aria-label="Перегенерировать">
            <FigmaIcon src={widgetRegenerate} size={16} />
          </button>
        ) : null}
        <button type="button" className="block-tool-btn" onClick={onDuplicate} aria-label="Дублировать">
          <FigmaIcon src={widgetDuplicate} size={16} />
        </button>
        {!duplicateOnly && onRemove ? (
          <button type="button" className="block-tool-btn" onClick={onRemove} aria-label="Удалить">
            <FigmaIcon src={widgetTrash} size={16} />
          </button>
        ) : null}
      </div>
    </>
  )
}
