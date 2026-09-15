import { describe, expect, it } from 'vitest'
import {
  expandColumnWidthsToTarget,
  measureInlineLineWidthPx,
  scaleColumnWidthsToMaxWithMin,
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

describe('scaleColumnWidthsToMaxWithMin', () => {
  it('does not shrink text columns below their minimum content width', () => {
    const mins = [100, 200, 80]
    const widths = [100, 250, 80]
    const scaled = scaleColumnWidthsToMaxWithMin(widths, mins, 330)

    expect(scaled[0]).toBe(100)
    expect(scaled[1]).toBe(200)
    expect(scaled[2]).toBe(80)
    expect(scaled.reduce((sum, width) => sum + width, 0)).toBe(380)
  })

  it('shrinks only columns with headroom above minimum', () => {
    const mins = [80, 120, 60]
    const widths = [100, 180, 60]
    const scaled = scaleColumnWidthsToMaxWithMin(widths, mins, 300)

    expect(scaled[0]).toBeGreaterThanOrEqual(80)
    expect(scaled[1]).toBeGreaterThanOrEqual(120)
    expect(scaled[2]).toBe(60)
    expect(scaled.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(300)
  })
})

describe('expandColumnWidthsToTarget', () => {
  it('expands columns to the target total', () => {
    const mins = [100, 60, 40]
    const widths = [100, 60, 40]
    const expanded = expandColumnWidthsToTarget(widths, mins, 300)

    expect(expanded.reduce((sum, width) => sum + width, 0)).toBe(300)
    expect(expanded[0]).toBeGreaterThan(100)
  })
})
