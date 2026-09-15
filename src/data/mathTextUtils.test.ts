import { describe, expect, it } from 'vitest'
import { normalizeRussianMathTex, preprocessMathText } from '@/data/mathTextUtils'

describe('normalizeRussianMathTex', () => {
  it('converts decimal dot to comma in expressions', () => {
    expect(normalizeRussianMathTex('0.5x+3')).toBe('0,5x+3')
    expect(normalizeRussianMathTex('3.14')).toBe('3,14')
    expect(normalizeRussianMathTex('-2.5 \\cdot 1.2')).toBe('-2,5 \\cdot 1,2')
  })

  it('does not touch LaTeX command dots', () => {
    expect(normalizeRussianMathTex('\\ldots')).toBe('\\ldots')
    expect(normalizeRussianMathTex('\\dots')).toBe('\\dots')
  })

  it('normalizes trig macros to Russian notation', () => {
    expect(normalizeRussianMathTex('\\tan x + \\cot y')).toBe('\\tg x + \\ctg y')
    expect(normalizeRussianMathTex('\\arctan 2')).toBe('\\arctg 2')
  })
})

describe('preprocessMathText', () => {
  it('normalizes decimals inside inline math', () => {
    expect(preprocessMathText('Значение $0.5x+3$ верно.')).toBe('Значение $0,5x+3$ верно.')
  })

  it('normalizes decimals inside display math', () => {
    expect(preprocessMathText('$$0.5x+3$$')).toBe('$$0,5x+3$$')
  })

  it('leaves plain text decimals unchanged', () => {
    expect(preprocessMathText('Число 0.5 в тексте.')).toBe('Число 0.5 в тексте.')
  })
})
