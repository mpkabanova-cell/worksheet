import { describe, expect, it } from 'vitest'
import { getValidGapAnswers, sanitizeGapAnswers } from '@/data/blockUtils'
import type { WorksheetBlock } from '@/data/worksheet'

describe('gap answer sanitization', () => {
  it('drops answers that exist only inside formulas', () => {
    const source = 'Формула $(a-b)^2 = a^2 - 2ab + b^2$ и текст ___ ниже.'
    const answers = ['2ab', 'ниже']

    expect(sanitizeGapAnswers(source, answers)).toEqual(['ниже'])
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
