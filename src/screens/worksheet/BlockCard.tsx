import type { DragEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { BlockPreviewState, WorksheetBlock } from '@/data/worksheet'
import {
  clampText,
  getBlockAnswerStyle,
  getChoiceQuestionMaxLength,
  getGapsSourceText,
  getGapsStudentText,
  getGapsDisplayAnswers,
  getValidGapAnswers,
  getOrderAnswerNumbers,
  getOrderDisplayItems,
  isChoiceBlock,
  isQuestionPlaceholder,
  isValidFillGapsBlock,
  questionPlaceholderForBlock,
  shuffleOrderDisplay,
  TEXT_BODY_MAX_LENGTH,
} from '@/data/blockUtils'
import { getBlockQuestion } from '@/data/taskContent'
import { MathText } from '@/components/MathText'
import { WysiwygTextarea } from '@/components/WysiwygTextarea'
import { FigmaIcon } from '@/components/ui'
import { AnswerArea } from '@/components/block/AnswerArea'
import { ChoiceOptionsView } from '@/components/block/ChoiceOptionsView'
import { FillGapsEditor, FillGapsStudent } from '@/components/block/FillGapsBody'
import { MatchingView } from '@/components/block/MatchingView'
import { MediaBlockView } from '@/components/block/MediaBlockView'
import { OrderingView } from '@/components/block/OrderingView'
import { TableView } from '@/components/block/TableView'
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
}: {
  value?: number
  onChange: (value: 1 | 2 | 3) => void
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
  const prevIsEditingRef = useRef(isEditing)

  useEffect(() => {
    if (
      prevIsEditingRef.current &&
      !isEditing &&
      block.type === 'ordering' &&
      onChangeBlock &&
      block.orderShuffle !== false
    ) {
      const items = block.orderItems ?? []
      if (items.length > 0) {
        onChangeBlock({ ...block, ...shuffleOrderDisplay(items) })
      }
    }
    prevIsEditingRef.current = isEditing
  }, [isEditing, block, onChangeBlock])

  useEffect(() => {
    if (!selected) {
      setEditingQuestion(false)
      return
    }
    if (
      (block.type === 'short_answer' || block.type === 'extended_answer') &&
      editable &&
      !isIssued
    ) {
      setEditingQuestion(true)
    }
  }, [selected, block.id, block.type, editable, isIssued])

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
        <article
          className={`ws-task plain media-task ${selected ? 'selected' : ''} ${editable ? 'editable' : ''}`}
          onClick={editable ? onSelect : undefined}
        >
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
  const questionPlaceholder = questionPlaceholderForBlock(block)
  const showsQuestionPlaceholder = isQuestionPlaceholder(questionText)
  const isPlainText = block.type === 'text'
  const gapsStudentText = getGapsStudentText(block)
  const orderItems = isEditing
    ? (block.orderItems ?? [])
    : getOrderDisplayItems(block, editable, selected)
  const orderAnswerNumbers = getOrderAnswerNumbers(block)
  const answerStyle = getBlockAnswerStyle(block, subject)
  const isAnswerBlock = block.type === 'short_answer' || block.type === 'extended_answer'
  const isChoiceTask = isChoiceBlock(block)
  const supportsPreviewState =
    isAnswerBlock ||
    isChoiceTask ||
    block.type === 'matching' ||
    block.type === 'ordering' ||
    block.type === 'grouping' ||
    block.type === 'fill_gaps'
  const questionMaxLength = getChoiceQuestionMaxLength(block)
  const effectiveShowAnswer = showAnswer || previewState === 'show-answer'
  const visualState: BlockPreviewState =
    previewState && supportsPreviewState
      ? previewState
      : isIssued && supportsPreviewState
        ? 'issued'
        : effectiveShowAnswer && supportsPreviewState
          ? 'show-answer'
          : editable && selected
            ? 'active'
            : 'default'
  const choiceFormat = block.choiceOptionFormat ?? 'text'

  return (
    <div
      className={`ws-task-wrap ${selected ? 'selected' : ''} ${editable ? 'editable' : ''} ${previewState && supportsPreviewState ? 'has-preview-state' : ''} ${isIssued ? 'is-issued' : ''}`}
    >
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
        {isIssued && (isAnswerBlock || isChoiceTask) ? (
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
                    rows={1}
                    value={showsQuestionPlaceholder ? '' : (block.question ?? question)}
                    maxLength={questionMaxLength}
                    placeholder={questionPlaceholder}
                    floatingToolbar
                    mathPreview
                    onChange={(value) =>
                      patchBlock({ question: clampText(value, questionMaxLength) })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : isEditing ? (
                  <p
                    className={`ws-task-text ws-task-text--clickable ${showsQuestionPlaceholder ? 'is-placeholder' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingQuestion(true)
                    }}
                  >
                    {showsQuestionPlaceholder ? (
                      questionPlaceholder
                    ) : (
                      <MathText text={block.question ?? question} as="span" />
                    )}
                  </p>
                ) : (
                  <p className={`ws-task-text ${showsQuestionPlaceholder ? 'is-placeholder' : ''}`}>
                    {showsQuestionPlaceholder ? questionPlaceholder : <MathText text={question} />}
                  </p>
                )}
              </div>
              {isEditing || (showDifficulty && (isAnswerBlock || block.difficulty)) ? (
                <div className="ws-task-meta">
                  <span className="diff-label">Сложность:</span>
                  {isEditing ? (
                    <DifficultyPicker
                      value={block.difficulty}
                      onChange={(n) => patchBlock({ difficulty: n })}
                    />
                  ) : (
                    <Stars value={block.difficulty ?? 0} />
                  )}
                </div>
              ) : null}
            </div>
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
                mathPreview
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

        {isChoiceTask ? (
          <ChoiceOptionsView
            block={block}
            format={choiceFormat}
            isEditing={isEditing}
            editable={editable}
            selected={selected}
            showAnswer={effectiveShowAnswer}
            onChangeBlock={onChangeBlock}
          />
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
                text={effectiveShowAnswer ? getGapsSourceText(block) : gapsStudentText}
                gapWords={getValidGapAnswers(block)}
                showAnswer={effectiveShowAnswer}
                showWordBank={false}
                shuffledWords={getGapsDisplayAnswers(block, editable, selected)}
                invalid={!isValidFillGapsBlock(block)}
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
              showAnswer={effectiveShowAnswer}
              isEditing={isEditing}
              onChangeLeft={(index, patch) =>
                patchBlock({
                  leftItems: (block.leftItems ?? []).map((item, i) =>
                    i === index ? { ...item, ...patch } : item,
                  ),
                })
              }
              onChangeRight={(index, patch) =>
                patchBlock({
                  rightItems: (block.rightItems ?? []).map((item, i) =>
                    i === index ? { ...item, ...patch } : item,
                  ),
                })
              }
            />
          </div>
        ) : null}

        {block.type === 'grouping' ? (
          <div className="ws-task-slot table-slot">
            <TableView
              block={block}
              editable={editable}
              selected={selected}
              isEditing={isEditing}
              showAnswer={effectiveShowAnswer}
              onChange={isEditing ? patchBlock : undefined}
            />
          </div>
        ) : null}

        {block.type === 'ordering' ? (
          <div className="ws-task-slot order-slot">
            <OrderingView
              items={orderItems}
              isEditing={isEditing}
              showNumbers={isEditing}
              showAnswer={effectiveShowAnswer && !isEditing}
              answerNumbers={orderAnswerNumbers}
              onChangeItems={
                isEditing
                  ? (items) =>
                      patchBlock({
                        orderItems: items,
                        orderDisplayItems: undefined,
                        orderDisplayOrder: undefined,
                      })
                  : undefined
              }
            />
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
