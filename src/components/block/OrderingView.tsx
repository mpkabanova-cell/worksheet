import { useState, type DragEvent } from 'react'
import { MathEditableInput } from '@/components/MathEditableInput'
import { MathText } from '@/components/MathText'
import { FigmaIcon } from '@/components/ui'
import widgetDragHandle from '@/assets/worksheet/tools/widget-drag-handle.svg'

interface OrderingViewProps {
  items: string[]
  isEditing: boolean
  showNumbers: boolean
  showAnswer?: boolean
  answerNumbers?: number[]
  onChangeItems?: (items: string[]) => void
}

export function OrderingView({
  items,
  isEditing,
  showNumbers,
  showAnswer = false,
  answerNumbers = [],
  onChangeItems,
}: OrderingViewProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChangeItems?.(next)
  }

  const updateItem = (index: number, value: string) => {
    const next = [...items]
    next[index] = value
    onChangeItems?.(next)
  }

  const onRowDragStart = (index: number) => (e: DragEvent) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onRowDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onRowDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    if (dragIndex !== null) reorder(dragIndex, index)
    setDragIndex(null)
  }

  const rowNumber = (index: number): number | null => {
    if (isEditing && showNumbers) return index + 1
    if (showAnswer) return answerNumbers[index] ?? null
    return null
  }

  return (
    <div className={`order-list-stack ${isEditing ? 'order-list-stack--editing' : ''}`}>
      {items.map((item, index) => {
        const isEmpty = !item.trim()
        const number = rowNumber(index)
        return (
          <div
            key={index}
            className={`order-row ${isEmpty ? 'is-empty' : ''} ${dragIndex === index ? 'dragging' : ''}`}
            draggable={isEditing}
            onDragStart={isEditing ? onRowDragStart(index) : undefined}
            onDragOver={isEditing ? onRowDragOver : undefined}
            onDrop={isEditing ? onRowDrop(index) : undefined}
            onDragEnd={isEditing ? () => setDragIndex(null) : undefined}
          >
            <span
              className={`order-row-num ${showAnswer && number != null ? 'order-row-num--answer' : ''}`}
              aria-hidden={number == null}
            >
              {number ?? '\u00a0'}
            </span>
            <div className="order-row-body">
              {isEditing ? (
                <MathEditableInput
                  className="order-row-input"
                  value={item}
                  placeholder="Текст"
                  showToolbar
                  floatingToolbar
                  onChange={(value) => updateItem(index, value)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="order-row-text">
                  {isEmpty ? 'Текст' : <MathText text={item} as="span" />}
                </span>
              )}
              {isEditing ? (
                <span className="order-row-drag" aria-hidden>
                  <FigmaIcon src={widgetDragHandle} size={20} />
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
