import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChoiceOptionFormat, MatchPair, WorksheetBlock } from '@/data/worksheet'
import { getMatchingCorrectLinks, getMatchingRightItems, getMatchingRowCount } from '@/data/blockUtils'
import { MathEditableInput } from '@/components/MathEditableInput'
import { MathText } from '@/components/MathText'
import choiceImagePlaceholder from '@/assets/worksheet/choice-image-placeholder.png'

interface MatchingViewProps {
  block: WorksheetBlock
  editable: boolean
  selected: boolean
  showAnswer: boolean
  isEditing?: boolean
  onChangeLeft?: (index: number, patch: Partial<MatchPair>) => void
  onChangeRight?: (index: number, patch: Partial<MatchPair>) => void
}

interface MatchLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

const EMPTY_LINES: MatchLine[] = []

function linesEqual(a: MatchLine[], b: MatchLine[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (line, index) =>
      line.x1 === b[index]?.x1 &&
      line.y1 === b[index]?.y1 &&
      line.x2 === b[index]?.x2 &&
      line.y2 === b[index]?.y2,
  )
}

function isImageFormat(format: ChoiceOptionFormat): boolean {
  return format === 'image' || format === 'text_image'
}

function MatchTextBox({
  text,
  isEditing,
  highlighted,
  onChange,
}: {
  text: string
  isEditing: boolean
  highlighted: boolean
  onChange?: (value: string) => void
}) {
  const isEmpty = !text.trim()

  return (
    <div
      className={`match-answer-box match-item--text ${isEmpty && !isEditing ? 'placeholder' : ''} ${
        highlighted ? 'correct-match' : ''
      }`}
    >
      {isEditing ? (
        <MathEditableInput
          className="match-answer-input"
          value={text}
          placeholder="Ответ"
          onChange={(value) => onChange?.(value)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : isEmpty ? (
        'Ответ'
      ) : (
        <MathText text={text} />
      )}
    </div>
  )
}

function MatchImageBox({
  item,
  isEditing,
  highlighted,
  onChange,
}: {
  item: MatchPair
  isEditing: boolean
  highlighted: boolean
  onChange?: (patch: Partial<MatchPair>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onChange?.({
        imageData: String(reader.result),
        imageFileName: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className={`match-image-box match-item--image ${highlighted ? 'correct-match' : ''} ${
        isEditing ? 'match-image-box--edit' : ''
      }`}
    >
      {item.imageData ? (
        <img src={item.imageData} alt="" className="match-image-box__img" />
      ) : (
        <img src={choiceImagePlaceholder} alt="" className="match-image-box__placeholder" />
      )}
      {isEditing ? (
        <>
          <button
            type="button"
            className="match-image-box__upload-btn"
            onClick={(e) => {
              e.stopPropagation()
              fileRef.current?.click()
            }}
          >
            Добавить картинку
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </>
      ) : null}
    </div>
  )
}

function MatchItemCell({
  format,
  item,
  isEditing,
  highlighted,
  onChange,
}: {
  format: ChoiceOptionFormat
  item: MatchPair
  isEditing: boolean
  highlighted: boolean
  onChange?: (patch: Partial<MatchPair>) => void
}) {
  if (isImageFormat(format)) {
    return (
      <MatchImageBox
        item={item}
        isEditing={isEditing}
        highlighted={highlighted}
        onChange={onChange}
      />
    )
  }

  return (
    <MatchTextBox
      text={item.text}
      isEditing={isEditing}
      highlighted={highlighted}
      onChange={(text) => onChange?.({ text })}
    />
  )
}

export function MatchingView({
  block,
  editable,
  selected,
  showAnswer,
  isEditing = false,
  onChangeLeft,
  onChangeRight,
}: MatchingViewProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const leftDotRefs = useRef<Array<HTMLSpanElement | null>>([])
  const rightDotRefs = useRef<Array<HTMLSpanElement | null>>([])
  const [lines, setLines] = useState<MatchLine[]>(EMPTY_LINES)

  const leftFormat = block.matchingLeftFormat ?? 'text'
  const rightFormat = block.matchingRightFormat ?? 'text'
  const rowHasImage = isImageFormat(leftFormat) || isImageFormat(rightFormat)

  const left = block.leftItems ?? []
  const right = useMemo(
    () => getMatchingRightItems(block, editable, selected),
    [block, editable, selected],
  )
  const links = useMemo(
    () => getMatchingCorrectLinks(block, right),
    [block, right],
  )

  const rowCount = getMatchingRowCount(block)

  const highlightedLeft = useMemo(
    () => new Set(showAnswer ? links.map((link) => link.leftIndex) : []),
    [links, showAnswer],
  )
  const highlightedRight = useMemo(
    () => new Set(showAnswer ? links.map((link) => link.rightIndex) : []),
    [links, showAnswer],
  )

  useLayoutEffect(() => {
    if (!showAnswer || !boardRef.current) {
      setLines((prev) => (prev.length === 0 ? prev : EMPTY_LINES))
      return
    }

    const measure = () => {
      const board = boardRef.current?.getBoundingClientRect()
      if (!board) return

      const next = links
        .map(({ leftIndex, rightIndex }) => {
          const leftDot = leftDotRefs.current[leftIndex]?.getBoundingClientRect()
          const rightDot = rightDotRefs.current[rightIndex]?.getBoundingClientRect()
          if (!leftDot || !rightDot) return null

          return {
            x1: leftDot.left + leftDot.width / 2 - board.left,
            y1: leftDot.top + leftDot.height / 2 - board.top,
            x2: rightDot.left + rightDot.width / 2 - board.left,
            y2: rightDot.top + rightDot.height / 2 - board.top,
          }
        })
        .filter((line): line is MatchLine => line !== null)

      setLines((prev) => (linesEqual(prev, next) ? prev : next))
    }

    measure()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer && boardRef.current) observer.observe(boardRef.current)

    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [links, showAnswer, rowCount, leftFormat, rightFormat])

  const emptyItem = (id: string): MatchPair => ({ id, text: '' })

  return (
    <div className="matching-board" ref={boardRef}>
      {showAnswer && lines.length > 0 ? (
        <svg className="matching-lines" aria-hidden>
          {lines.map((line, index) => (
            <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
          ))}
        </svg>
      ) : null}

      <div className="matching-rows">
        {Array.from({ length: rowCount }).map((_, index) => {
          const leftItem = left[index] ?? emptyItem(`left-${index}`)
          const rightItem = right[index] ?? emptyItem(`right-${index}`)

          return (
            <div
              key={leftItem.id ?? rightItem.id ?? index}
              className={`matching-row ${rowHasImage ? 'matching-row--has-image' : ''}`}
            >
              <div className="matching-side matching-side-left">
                <MatchItemCell
                  format={leftFormat}
                  item={leftItem}
                  isEditing={isEditing}
                  highlighted={highlightedLeft.has(index)}
                  onChange={
                    isEditing && onChangeLeft
                      ? (patch) => onChangeLeft(index, patch)
                      : undefined
                  }
                />
                <span
                  className={`match-dot ${highlightedLeft.has(index) ? 'correct-match' : ''}`}
                  ref={(node) => {
                    leftDotRefs.current[index] = node
                  }}
                  aria-hidden
                />
              </div>

              <div className="matching-side matching-side-right">
                <span
                  className={`match-dot ${highlightedRight.has(index) ? 'correct-match' : ''}`}
                  ref={(node) => {
                    rightDotRefs.current[index] = node
                  }}
                  aria-hidden
                />
                <MatchItemCell
                  format={rightFormat}
                  item={rightItem}
                  isEditing={isEditing}
                  highlighted={highlightedRight.has(index)}
                  onChange={
                    isEditing && onChangeRight
                      ? (patch) => onChangeRight(index, patch)
                      : undefined
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
