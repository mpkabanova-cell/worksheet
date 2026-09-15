import { describe, expect, it } from 'vitest'
import {
  measureInlineLineWidthPx,
  textCellWidthPx,
  wrapInlineCells,
  type InlineWidthCell,
} from '@/export/word/richText/measureTextWidth'

const FONT_SIZE = 18
const EMPTY_MATH = new Map<string, number>()

function textCell(value: string): InlineWidthCell {
  return { kind: 'text', segments: [{ kind: 'text', value }] }
}

describe('wrapInlineCells', () => {
  it('keeps a short line intact', () => {
    const cells = [textCell('Короткий текст')]
    const wrapped = wrapInlineCells(cells, 500, FONT_SIZE, EMPTY_MATH)

    expect(wrapped).toHaveLength(1)
    expect(wrapped[0]).toEqual(cells)
  })

  it('breaks an overflowing line at word boundaries', () => {
    const longText =
      'Запишите формулу квадрата суммы двух выражений и проверьте результат вычисления'
    const cells = [textCell(longText)]
    const lineWidth = measureInlineLineWidthPx(cells, FONT_SIZE, EMPTY_MATH)
    const maxWidth = Math.floor(lineWidth * 0.55)

    const wrapped = wrapInlineCells(cells, maxWidth, FONT_SIZE, EMPTY_MATH)

    expect(wrapped.length).toBeGreaterThan(1)
    for (const line of wrapped) {
      const width = measureInlineLineWidthPx(line, FONT_SIZE, EMPTY_MATH)
      expect(width).toBeLessThanOrEqual(maxWidth + textCellWidthPx([{ kind: 'text', value: ' ' }], FONT_SIZE))
    }
  })

  it('never splits inline math atoms', () => {
    const cells: InlineWidthCell[] = [
      textCell('Выражение '),
      { kind: 'math', tex: 'a+b' },
      textCell(' и ещё немного текста для переноса на следующую строку документа'),
    ]
    const lineWidth = measureInlineLineWidthPx(cells, FONT_SIZE, EMPTY_MATH)
    const mathWidths = new Map<string, number>([['a+b', 24]])
    const wrapped = wrapInlineCells(cells, Math.floor(lineWidth * 0.6), FONT_SIZE, mathWidths)

    expect(wrapped.some((line) => line.some((cell) => cell.kind === 'math'))).toBe(true)
  })
})
