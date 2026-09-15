import { describe, expect, it } from 'vitest'
import {
  gapWordOccursOutsideMath,
  hasForbiddenGapsInFormulas,
  hasGapMarkersInMath,
  migrateGapsTextToSource,
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

describe('hasForbiddenGapsInFormulas', () => {
  it('detects gap markers in math-like plain text', () => {
    const source = '(a+b)^2 = a^2 + ___ + b^2'
    expect(hasForbiddenGapsInFormulas(source)).toBe(true)
  })

  it('detects gap answers inside math-like plain text', () => {
    const source = '(a+b)^2 = a^2 + 2ab + b^2'
    expect(hasForbiddenGapsInFormulas(source, ['2ab'])).toBe(true)
  })

  it('allows plain-text gaps', () => {
    const source = 'Определение: ___ — это основа.'
    expect(hasForbiddenGapsInFormulas(source, ['основа'])).toBe(false)
  })
})

describe('gapWordOccursOutsideMath', () => {
  it('ignores words that appear only in math-like plain text', () => {
    const source = '$(a+b)^2 = a^2 + 2ab + b^2$ и слово ___'
    expect(gapWordOccursOutsideMath(source, '2ab')).toBe(false)
    expect(gapWordOccursOutsideMath(source, 'слово')).toBe(true)
  })
})

describe('migrateGapsTextToSource', () => {
  it('does not substitute answers into \\text{___}', () => {
    const migrated = migrateGapsTextToSource(
      '1. (a-b)^2 = a^2 - \\text{___} + b^2',
      ['2ab'],
    )
    expect(migrated).not.toContain('\\text{2ab}')
  })
})
