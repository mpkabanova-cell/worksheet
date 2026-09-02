import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import { getMatchingCorrectLinks, getMatchingRightItems } from '@/data/blockUtils'
import { MathText } from '@/components/MathText'

interface MatchingViewProps {
  block: WorksheetBlock
  editable: boolean
  selected: boolean
  showAnswer: boolean
  isEditing?: boolean
  onChangeLeft?: (index: number, text: string) => void
  onChangeRight?: (index: number, text: string) => void
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

function MatchAnswerBox({
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
      className={`match-answer-box ${isEmpty ? 'placeholder' : ''} ${
        highlighted ? 'correct-match' : ''
      }`}
    >
      {isEditing ? (
        <input
          className="match-answer-input"
          value={text}
          placeholder="Ответ"
          onChange={(e) => onChange?.(e.target.value)}
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

  const left = block.leftItems ?? []
  const right = useMemo(
    () => getMatchingRightItems(block, editable, selected),
    [block, editable, selected],
  )
  const links = useMemo(
    () => getMatchingCorrectLinks(block, right),
    [block, right],
  )

  const rowCount = Math.max(left.length, right.length)

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
  }, [links, showAnswer, rowCount])

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
          const leftItem = left[index]
          const rightItem = right[index]

          return (
            <div key={leftItem?.id ?? rightItem?.id ?? index} className="matching-row">
              <div className="matching-side matching-side-left">
                <MatchAnswerBox
                  text={leftItem?.text ?? ''}
                  isEditing={isEditing}
                  highlighted={highlightedLeft.has(index)}
                  onChange={
                    isEditing && onChangeLeft
                      ? (value) => onChangeLeft(index, value)
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
                <MatchAnswerBox
                  text={rightItem?.text ?? ''}
                  isEditing={isEditing}
                  highlighted={highlightedRight.has(index)}
                  onChange={
                    isEditing && onChangeRight
                      ? (value) => onChangeRight(index, value)
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
