import { describe, expect, it } from 'vitest'
import {
  getGapsSourceText,
  getValidGapAnswers,
  isValidFillGapsBlock,
  markGapAnswersInText,
  sanitizeBlock,
  sanitizeGapAnswers,
} from '@/data/blockUtils'
import { migrateGapsTextToSource } from '@/data/mathTextUtils'
import type { WorksheetBlock } from '@/data/worksheet'

describe('markGapAnswersInText', () => {
  it('does not double-wrap words already underlined in source', () => {
    const source =
      'используют <u>приблизительное</u> равенство и слово приблизительно.'
    const result = markGapAnswersInText(source, ['приблизительное', 'приблизительно'])

    expect(result).toBe(
      'используют <u>приблизительное</u> равенство и слово <u>приблизительно</u>.',
    )
    expect(result).not.toContain('<u><u>')
  })
})

describe('gap answer sanitization', () => {
  it('drops answers that exist only inside formulas', () => {
    const source = 'Формула $(a-b)^2 = a^2 - 2ab + b^2$ и текст ___ ниже.'
    const answers = ['2ab', 'ниже']

    expect(sanitizeGapAnswers(source, answers)).toEqual(['ниже'])
  })

  it('drops answers that exist only in math-like plain text', () => {
    const source = '$(a+b)^2 = a^2 + 2ab + b^2$ и слово ___'
    const answers = ['2ab', 'слово']

    expect(sanitizeGapAnswers(source, answers)).toEqual(['слово'])
  })

  it('getValidGapAnswers reads block source and filters invalid words', () => {
    const block: WorksheetBlock = {
      id: 'b1',
      type: 'fill_gaps',
      page: 0,
      title: '',
      issued: false,
      gapsSourceText: '$x^2 - 25$ и слово ___',
      gapsAnswers: ['25', 'слово'],
    }

    expect(getValidGapAnswers(block)).toEqual(['слово'])
  })
})

describe('isValidFillGapsBlock', () => {
  it('rejects formula gaps with math-like plain text', () => {
    const block: WorksheetBlock = {
      id: 'b2',
      type: 'fill_gaps',
      page: 0,
      title: '',
      issued: false,
      gapsSourceText: '(a+b)^2 = a^2 + ___ + b^2',
      gapsAnswers: ['2ab'],
    }

    expect(isValidFillGapsBlock(block)).toBe(false)
  })

  it('accepts plain-text gaps', () => {
    const block: WorksheetBlock = {
      id: 'b3',
      type: 'fill_gaps',
      page: 0,
      title: '',
      issued: false,
      gapsSourceText: 'Определение: ___ — это основа.',
      gapsAnswers: ['основа'],
    }

    expect(isValidFillGapsBlock(block)).toBe(true)
  })
})

describe('gapsText migration', () => {
  it('does not turn \\text{___} into \\text{2ab}', () => {
    const gapsText = '1. (a-b)^2 = a^2 - \\text{___} + b^2'
    const migrated = migrateGapsTextToSource(gapsText, ['2ab'])

    expect(migrated).not.toContain('\\text{2ab}')
    expect(migrated).not.toContain('\\text{___}')
  })

  it('replaces ___ only in plain segments during legacy migration', () => {
    const block: WorksheetBlock = {
      id: 'b4',
      type: 'fill_gaps',
      page: 0,
      title: '',
      issued: false,
      gapsText: '$(a+b)^2 = a^2 + \\text{___} + b^2$. Слово: ___',
      gapsAnswers: ['2ab', 'основа'],
    }

    const source = getGapsSourceText(block)
    expect(source).not.toContain('\\text{2ab}')
    expect(source).toContain('основа')
  })

  it('sanitizeBlock converts invalid fill_gaps to text', () => {
    const block: WorksheetBlock = {
      id: 'b5',
      type: 'fill_gaps',
      page: 0,
      title: '',
      issued: false,
      question: 'Заполните пропуски',
      gapsSourceText: '(a+b)^2 = a^2 + ___ + b^2',
      gapsAnswers: ['2ab'],
    }

    const sanitized = sanitizeBlock(block)
    expect(sanitized.type).toBe('text')
    expect(sanitized.gapsAnswers).toBeUndefined()
    expect(sanitized.body).toContain('(a+b)^2')
  })
})
