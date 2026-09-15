import { describe, expect, it } from 'vitest'
import {
  latexToWordMath,
  ommlXmlFromLatex,
  parseLatex,
  UnsupportedLatexError,
  wordMathFromNode,
} from '@/export/word/richText/latexToWordMath'

describe('latexToWordMath', () => {
  it('parses (x+5)^2 as superscript with bracketed base', async () => {
    const xml = await ommlXmlFromLatex('(x+5)^2')
    expect(xml).toContain('<m:sSup>')
    expect(xml).toContain('<m:d>')
    expect(xml).toContain('<m:t>x</m:t>')
    expect(xml).toContain('<m:t>+</m:t>')
    expect(xml).toContain('<m:t>5</m:t>')
    expect(xml).toContain('<m:sup>')
    expect(xml).toContain('<m:t>2</m:t>')
    expect(xml).not.toContain('wp:inline')
  })

  it('parses (x-3)^2 similarly', async () => {
    const xml = await ommlXmlFromLatex('(x-3)^2')
    expect(xml).toContain('<m:sSup>')
    expect(xml).toContain('<m:t>x</m:t>')
    expect(xml).toContain('<m:t>-</m:t>')
    expect(xml).toContain('<m:t>3</m:t>')
  })

  it('parses fractions', async () => {
    const xml = await ommlXmlFromLatex('\\frac{x+1}{2}')
    expect(xml).toContain('<m:f>')
    expect(xml).toContain('<m:num>')
    expect(xml).toContain('<m:den>')
  })

  it('parses square roots', async () => {
    const xml = await ommlXmlFromLatex('\\sqrt{x^2+4}')
    expect(xml).toContain('<m:rad>')
    expect(xml).toContain('<m:sSup>')
  })

  it('parses multiple constructs in one expression', async () => {
    const node = parseLatex('x^2')
    expect(node.kind).toBe('sup')

    const xml = await ommlXmlFromLatex('\\frac{x^2}{x+1}')
    expect(xml).toContain('<m:f>')
    expect(xml).toContain('<m:sSup>')
  })

  it('parses fraction with relation in one Math object', async () => {
    const xml = await ommlXmlFromLatex('\\frac{x^2-1}{x-1}=x+1')
    expect(xml).toContain('<m:f>')
    expect(xml).toContain('<m:t>=</m:t>')
    expect(xml).toContain('<m:t>x</m:t>')
    expect(xml).toContain('<m:t>+</m:t>')
    expect(xml).toContain('<m:t>1</m:t>')
  })

  it('throws for unsupported n-ary operators', () => {
    expect(() => parseLatex('\\sum_{i=1}^n')).toThrow(UnsupportedLatexError)
  })

  it('returns a docx Math wrapper', () => {
    const math = latexToWordMath('x^3')
    expect(math).toBeTruthy()
    expect(wordMathFromNode(parseLatex('x^3'))).toBeTruthy()
  })
})
