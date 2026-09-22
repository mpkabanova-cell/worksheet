import { describe, expect, it } from 'vitest'
import { stripMarkdownImages, truncateContextText } from '../../server/markdownClean.js'

describe('stripMarkdownImages', () => {
  it('removes markdown and html images', () => {
    const input = 'Текст\n\n![alt](http://x/y.png)\n\n<img src="z">\n\nЕщё'
    expect(stripMarkdownImages(input)).toBe('Текст\n\nЕщё')
  })

  it('collapses extra blank lines', () => {
    expect(stripMarkdownImages('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('preserves square-bracket image descriptions', () => {
    const input = 'Текст\n\n[график функции y=x^2, оси OX и OY]\n\n![alt](x.png)'
    expect(stripMarkdownImages(input)).toBe(
      'Текст\n\n[график функции y=x^2, оси OX и OY]',
    )
  })
})

describe('truncateContextText', () => {
  it('returns full text without truncation', () => {
    const long = 'x'.repeat(20_000)
    expect(truncateContextText('hello')).toEqual({ text: 'hello', truncated: false })
    expect(truncateContextText(long)).toEqual({ text: long, truncated: false })
  })
})
