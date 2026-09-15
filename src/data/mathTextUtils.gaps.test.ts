import { describe, expect, it } from 'vitest'
import {
  hasGapMarkersInMath,
  sanitizeGapsSourceText,
  stripGapMarkersFromMathTex,
} from '@/data/mathTextUtils'

describe('sanitizeGapsSourceText', () => {
  it('removes \\text{___} from inline math', () => {
    const source = '1. $(a-b)^2 = a^2 - \\text{___} + b^2$'
    expect(sanitizeGapsSourceText(source)).toBe('1. $(a-b)^2 = a^2 - + b^2$')
    expect(hasGapMarkersInMath(sanitizeGapsSourceText(source))).toBe(false)
  })

  it('removes gap markers from math-like plain text without $ delimiters', () => {
    const source = '1. (a-b)^2 = a^2 - \\text{___} + b^2'
    expect(sanitizeGapsSourceText(source)).not.toContain('\\text{___}')
  })

  it('keeps plain-text gaps outside formulas', () => {
    const source = 'Определение: ___ — это основа.'
    expect(sanitizeGapsSourceText(source)).toBe(source)
  })

  it('strips underscores inside math tex helper', () => {
    expect(stripGapMarkersFromMathTex('a^2 - ___ + b^2')).toBe('a^2 - + b^2')
  })
})
