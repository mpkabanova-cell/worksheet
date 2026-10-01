import { describe, expect, it } from 'vitest'
import { preprocessMathText } from '@/data/mathTextUtils'
import { parseContent } from '@/export/word/richText/parseRichText'
import { ommlXmlFromLatex, parseLatex } from '@/export/word/richText/latexToWordMath'
import { TYPO } from '@/export/word/layoutTokens'

describe('polynomial question export', () => {
  const style = TYPO.taskQuestion
  const tex = String.raw`5x^3y^2 - 2x^2y^4 + 7xy^3 - 10`

  it('parses full polynomial as one math object', async () => {
    const node = parseLatex(tex)
    expect(node.kind).toBe('sequence')
    const xml = await ommlXmlFromLatex(tex, style)
    expect(xml).toContain('<m:sSup>')
    expect(xml).not.toContain('wp:inline')
  })

  it('keeps polynomial in one math segment when wrapped in dollars', () => {
    const input = `Запишите степень многочлена $${tex}$.`
    const segments = parseContent(input)
    const mathSegments = segments.filter((s) => s.kind === 'math')
    expect(mathSegments).toHaveLength(1)
    if (mathSegments[0]?.kind === 'math') {
      expect(mathSegments[0].value).toBe(tex)
    }
  })

  it('extracts polynomial from mixed Russian text without dollar delimiters', () => {
    const input = `Запишите степень многочлена ${tex}.`
    expect(preprocessMathText(input)).toBe(`Запишите степень многочлена $${tex}$.`)
    const segments = parseContent(input)
    const mathSegments = segments.filter((s) => s.kind === 'math')
    expect(mathSegments).toHaveLength(1)
    if (mathSegments[0]?.kind === 'math') {
      expect(mathSegments[0].value).toBe(tex)
    }
  })

  it('merges multiple inline math spans into one formula', () => {
    const input = `Запишите степень многочлена $5x^3y^2$ − $2x^2y^4$ + $7xy^3$ − $10$.`
    const segments = parseContent(input)
    const mathSegments = segments.filter((s) => s.kind === 'math')
    expect(mathSegments).toHaveLength(1)
    if (mathSegments[0]?.kind === 'math') {
      expect(mathSegments[0].value.replace(/\s+/g, ' ')).toBe(tex.replace(/\s+/g, ' '))
    }
  })

  it('extracts plain polynomial without dollar delimiters', () => {
    const input = `Запишите степень многочлена ${tex}.`
    const segments = parseContent(input)
    const mathSegments = segments.filter((s) => s.kind === 'math')
    expect(mathSegments).toHaveLength(1)
    if (mathSegments[0]?.kind === 'math') {
      expect(mathSegments[0].value).toBe(tex)
    }
  })

  it('parses markdown bold for portal and PDF', () => {
    const segments = parseContent('Кот спит на **коврике**.')
    const bold = segments.find((s) => s.kind === 'text' && s.bold)
    expect(bold?.kind).toBe('text')
    if (bold?.kind === 'text') {
      expect(bold.value).toBe('коврике')
    }
  })
})
