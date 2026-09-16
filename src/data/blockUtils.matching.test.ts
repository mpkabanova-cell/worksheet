import { describe, expect, it } from 'vitest'
import {
  isMatchingBijective,
  isValidMatchingBlock,
  looksLikeAmbiguousSetMatching,
  sanitizeBlock,
} from './blockUtils'
import type { WorksheetBlock } from './worksheet'

function makeSetMatchingBlock(): WorksheetBlock {
  return {
    id: 'task-1',
    type: 'matching',
    page: 0,
    title: 'Задание 1',
    issued: false,
    question: 'Соотнесите число с наименьшим множеством, к которому оно принадлежит.',
    leftItems: [
      { id: 'left_1', text: '-15' },
      { id: 'left_2', text: '0' },
      { id: 'left_3', text: '4' },
    ],
    rightItems: [
      { id: 'right_1', text: 'Рациональные числа' },
      { id: 'right_2', text: 'Натуральные числа' },
      { id: 'right_3', text: 'Целые числа' },
    ],
    matchingPairCount: 3,
    correctAnswers: ['-15 → Целые числа', '4 → Натуральные числа', '0 → Целые числа'],
  }
}

describe('matching validation', () => {
  it('detects ambiguous numeric set matching', () => {
    expect(looksLikeAmbiguousSetMatching(makeSetMatchingBlock())).toBe(true)
  })

  it('rejects non-bijective matching answers', () => {
    expect(isMatchingBijective(makeSetMatchingBlock())).toBe(false)
    expect(isValidMatchingBlock(makeSetMatchingBlock())).toBe(false)
  })

  it('converts invalid matching block to text during sanitize', () => {
    const sanitized = sanitizeBlock(makeSetMatchingBlock())
    expect(sanitized.type).toBe('text')
    expect(sanitized.body).toContain('Соотнесите число')
    expect(sanitized.leftItems).toBeUndefined()
  })

  it('accepts bijective matching answers', () => {
    const block: WorksheetBlock = {
      id: 'task-2',
      type: 'matching',
      page: 0,
      title: 'Задание 2',
      issued: false,
      question: 'Сопоставьте приставку и её значение.',
      leftItems: [
        { id: 'left_1', text: 'мega-' },
        { id: 'left_2', text: 'kilo-' },
      ],
      rightItems: [
        { id: 'right_1', text: '10^3' },
        { id: 'right_2', text: '10^6' },
      ],
      matchingPairCount: 2,
      correctAnswers: ['left_1 → right_2', 'left_2 → right_1'],
    }

    expect(isValidMatchingBlock(block)).toBe(true)
    expect(sanitizeBlock(block).type).toBe('matching')
  })
})
