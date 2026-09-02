import type { DragEvent } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import {
  clampText,
  defaultAnswerStyle,
  getGapsSourceText,
  getGapsStudentText,
  getMatchingRightItems,
  getOrderDisplayItems,
  getTableAnswerBank,
  QUESTION_MAX_LENGTH,
  TEXT_BODY_MAX_LENGTH,
} from '@/data/blockUtils'
import { getBlockQuestion } from '@/data/taskContent'
import { MathText } from '@/components/MathText'
import { FigmaIcon } from '@/components/ui'
import { WysiwygTextarea } from '@/components/WysiwygTextarea'
import { AnswerArea } from '@/components/block/AnswerArea'
import { FillGapsEditor, FillGapsStudent } from '@/components/block/FillGapsBody'
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

export function BlockCard({
  block,
  taskNumber,
  subject,
  editable,
  selected,
  showAnswer,
  showDifficulty,
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
  const isPlainText = block.type === 'text'
  const isEditing = editable && selected && Boolean(onChangeBlock)
  const rows = block.tableRows ?? 3
  const cols = block.tableCols ?? 3
  const cells = block.tableCells
  const headers = block.tableHeaders ?? Array.from({ length: cols }, (_, i) => `Группа ${i + 1}`)
  const gapsSource = getGapsSourceText(block)
  const gapsStudentText = getGapsStudentText(block)
  const answerStyle = block.answerAreaStyle ?? defaultAnswerStyle(subject)

  const stopEditBubble = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }

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
        className={`ws-task ${selected ? 'selected' : ''} ${editable ? 'editable' : ''} ${isPlainText ? 'plain' : ''} ${dragging ? 'dragging' : ''} ${isEditing ? 'editing-inline' : ''}`}
        onClick={editable ? onSelect : undefined}
      >
        {!isPlainText ? (
          <div className="ws-task-head">
            <span className="ws-task-num">{taskNumber}.</span>
            <div className="ws-task-main">
              {isEditing && block.type !== 'fill_gaps' ? (
                <div className="ws-inline-fields" onClick={stopEditBubble}>
                  <WysiwygTextarea
                    className="ws-inline-textarea ws-inline-question"
                    rows={2}
                    maxLength={QUESTION_MAX_LENGTH}
                    value={block.question ?? ''}
                    onChange={(q) =>
                      onChangeBlock?.({ ...block, question: clampText(q, QUESTION_MAX_LENGTH) })
                    }
                  />
                </div>
              ) : block.type !== 'fill_gaps' ? (
                <p className="ws-task-text">
                  <MathText text={question} />
                </p>
              ) : (
                <p className="ws-task-text">
                  <MathText text={question} />
                </p>
              )}
              {showDifficulty && block.difficulty ? (
                <div className="ws-task-meta">
                  <span className="diff-label">Сложность:</span>
                  <Stars value={block.difficulty} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="ws-task-main plain-body">
            {isEditing ? (
              <WysiwygTextarea
                className="ws-inline-textarea ws-inline-body"
                rows={8}
                maxLength={TEXT_BODY_MAX_LENGTH}
                value={block.body ?? ''}
                onChange={(body) => onChangeBlock?.({ ...block, body })}
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
            {(block.options ?? []).map((opt) => {
              const correct =
                block.type === 'single_choice'
                  ? opt.id === block.correctOptionId
                  : (block.correctOptionIds ?? []).includes(opt.id)
              return (
                <label key={opt.id} className={`option ${showAnswer && correct ? 'correct' : ''}`}>
                  <span className="checkbox" />
                  <MathText text={opt.text} />
                </label>
              )
            })}
          </div>
        ) : null}

        {block.type === 'short_answer' || block.type === 'extended_answer' ? (
          <AnswerArea block={block} style={answerStyle} />
        ) : null}

        {block.type === 'fill_gaps' ? (
          <div className="ws-task-slot">
            {isEditing && onChangeBlock ? (
              <>
                <div className="ws-inline-fields" onClick={stopEditBubble}>
                  <WysiwygTextarea
                    className="ws-inline-textarea ws-inline-question"
                    rows={2}
                    maxLength={QUESTION_MAX_LENGTH}
                    value={block.question ?? ''}
                    onChange={(q) =>
                      onChangeBlock({ ...block, question: clampText(q, QUESTION_MAX_LENGTH) })
                    }
                  />
                </div>
                <FillGapsEditor
                  sourceText={gapsSource}
                  gapWords={block.gapsAnswers ?? []}
                  showAnswer={showAnswer}
                  onChange={(patch) => onChangeBlock({ ...block, ...patch })}
                />
              </>
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
            {(() => {
              const left = block.leftItems ?? []
              const right = getMatchingRightItems(block, editable, selected)
              const count = Math.max(left.length, right.length, 0)
              return Array.from({ length: count }, (_, i) => {
                const l = left[i]
                const r = right[i]
                return (
                  <div key={l?.id ?? r?.id ?? i} className="matching-row">
                    <div className="match-col">
                      <div className={`match-answer-box ${l?.text ? '' : 'placeholder'}`}>
                        {l?.text ? <MathText text={l.text} /> : 'Ответ'}
                      </div>
                      <span className="match-dot" aria-hidden />
                    </div>
                    <div className="match-col">
                      <span className="match-dot" aria-hidden />
                      <div className={`match-answer-box ${r?.text ? '' : 'placeholder'}`}>
                        {r?.text ? <MathText text={r.text} /> : 'Ответ'}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
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
                  {g.items.map((item) => (
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
                      <td key={c}>
                        {editable && selected && onChangeBlock ? (
                          <input
                            className="table-cell-fill"
                            value={cells?.[r]?.[c] ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const base =
                                cells ??
                                Array.from({ length: rows }, () =>
                                  Array.from({ length: cols }, () => ''),
                                )
                              const next = base.map((row, ri) =>
                                row.map((cell, ci) => (ri === r && ci === c ? e.target.value : cell)),
                              )
                              onChangeBlock({ ...block, tableCells: next })
                            }}
                          />
                        ) : (
                          cells?.[r]?.[c] ?? ''
                        )}
                      </td>
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

        {showAnswer && (block.correctAnswers?.length || block.correctOptionId) ? (
          <div className="ws-task-slot">
            <div className="answer-pill">
              Ответ:{' '}
              <MathText
                text={
                  block.correctAnswers?.join(', ') ||
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
  onMoveUp,
  onMoveDown,
  onRemove,
  onDuplicate,
  onRegenerateBlock,
  onDragStart,
  onDragEnd,
}: {
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onDuplicate: () => void
  onRegenerateBlock: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}) {
  return (
    <>
      <span
        className="block-drag-side"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        aria-label="Перетащить"
      >
        <FigmaIcon src={widgetDragHandle} size={20} />
      </span>
      <div className="block-tools" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="block-tool-btn" onClick={onMoveUp} aria-label="Вверх">
          <FigmaIcon src={widgetArrowUp} size={16} />
        </button>
        <button type="button" className="block-tool-btn" onClick={onMoveDown} aria-label="Вниз">
          <FigmaIcon src={widgetArrowDown} size={16} />
        </button>
        <button type="button" className="block-tool-btn" onClick={onRegenerateBlock} aria-label="Перегенерировать">
          <FigmaIcon src={widgetRegenerate} size={16} />
        </button>
        <button type="button" className="block-tool-btn" onClick={onDuplicate} aria-label="Дублировать">
          <FigmaIcon src={widgetDuplicate} size={16} />
        </button>
        <button type="button" className="block-tool-btn" onClick={onRemove} aria-label="Удалить">
          <FigmaIcon src={widgetTrash} size={16} />
        </button>
      </div>
    </>
  )
}
