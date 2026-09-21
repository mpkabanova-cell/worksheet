import { describe, expect, it } from 'vitest'
import { stripMarkdownImages, truncateContextText, CONTEXT_FILE_TEXT_MAX } from '../../server/markdownClean.js'

describe('stripMarkdownImages', () => {
  it('removes markdown and html images', () => {
    const input = 'Текст\n\n![alt](http://x/y.png)\n\n<img src="z">\n\nЕщё'
    expect(stripMarkdownImages(input)).toBe('Текст\n\nЕщё')
  })

  it('collapses extra blank lines', () => {
    expect(stripMarkdownImages('a\n\n\n\nb')).toBe('a\n\nb')
  })
})

describe('truncateContextText', () => {
  it('returns full text when under limit', () => {
    expect(truncateContextText('hello')).toEqual({ text: 'hello', truncated: false })
  })

  it('truncates long text', () => {
    const long = 'x'.repeat(CONTEXT_FILE_TEXT_MAX + 10)
    const result = truncateContextText(long)
    expect(result.text.length).toBe(CONTEXT_FILE_TEXT_MAX)
    expect(result.truncated).toBe(true)
  })
})
