import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import { getMatchingCorrectLinks, getMatchingRightItems } from '@/data/blockUtils'
import { MathText } from '@/components/MathText'

interface MatchingViewProps {
  block: WorksheetBlock
  editable: boolean
  selected: boolean
  showAnswer: boolean
}

interface MatchLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function MatchingView({ block, editable, selected, showAnswer }: MatchingViewProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const leftDotRefs = useRef<Array<HTMLSpanElement | null>>([])
  const rightDotRefs = useRef<Array<HTMLSpanElement | null>>([])
  const [lines, setLines] = useState<MatchLine[]>([])

  const left = block.leftItems ?? []
  const right = getMatchingRightItems(block, editable, selected)
  const links = useMemo(
    () => getMatchingCorrectLinks(block, right),
    [block, right],
  )

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
      setLines([])
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

      setLines(next)
    }

    measure()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer && boardRef.current) observer.observe(boardRef.current)

    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [links, showAnswer, left.length, right.length])

  return (
    <div className="matching-board" ref={boardRef}>
      {showAnswer && lines.length > 0 ? (
        <svg className="matching-lines" aria-hidden>
          {lines.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </svg>
      ) : null}

      <div className="matching-col matching-col-left">
        {left.map((item, index) => (
          <div key={item.id} className="matching-item">
            <div
              className={`match-answer-box ${item.text ? '' : 'placeholder'} ${
                highlightedLeft.has(index) ? 'correct-match' : ''
              }`}
            >
              {item.text ? <MathText text={item.text} /> : 'Ответ'}
            </div>
            <span
              className={`match-dot ${highlightedLeft.has(index) ? 'correct-match' : ''}`}
              ref={(node) => {
                leftDotRefs.current[index] = node
              }}
              aria-hidden
            />
          </div>
        ))}
      </div>

      <div className="matching-col matching-col-right">
        {right.map((item, index) => (
          <div key={item.id} className="matching-item">
            <span
              className={`match-dot ${highlightedRight.has(index) ? 'correct-match' : ''}`}
              ref={(node) => {
                rightDotRefs.current[index] = node
              }}
              aria-hidden
            />
            <div
              className={`match-answer-box ${item.text ? '' : 'placeholder'} ${
                highlightedRight.has(index) ? 'correct-match' : ''
              }`}
            >
              {item.text ? <MathText text={item.text} /> : 'Ответ'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
