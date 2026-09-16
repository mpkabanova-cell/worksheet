import { useState, type DragEvent } from 'react'
import { MathEditableInput } from '@/components/MathEditableInput'
import { MathText } from '@/components/MathText'
import { FigmaIcon } from '@/components/ui'
import widgetDragHandle from '@/assets/worksheet/tools/widget-drag-handle.svg'

interface OrderingViewProps {
  items: string[]
  isEditing: boolean
  showNumbers: boolean
  onChangeItems?: (items: string[]) => void
}

export function OrderingView({
  items,
  isEditing,
  showNumbers,
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

  return (
    <div className={`order-list-stack ${showNumbers ? 'order-list-stack--numbered' : ''}`}>
      {items.map((item, index) => {
        const isEmpty = !item.trim()
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
            {showNumbers ? <span className="order-row-num">{index + 1}</span> : null}
            <div className="order-row-body">
              {isEditing ? (
                <MathEditableInput
                  className="order-row-input"
                  value={item}
                  placeholder="Текст"
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
