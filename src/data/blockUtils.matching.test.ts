import { describe, expect, it } from 'vitest'
import {
  isMatchingBijective,
  isValidMatchingBlock,
  looksLikeAmbiguousSetMatching,
  createDefaultGroupingTableFields,
  sanitizeBlock,
  sanitizeBlocks,
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

  it('converts invalid matching block to grouping during sanitize', () => {
    const sanitized = sanitizeBlock(makeSetMatchingBlock())
    expect(sanitized.type).toBe('grouping')
    expect(sanitized.question).toContain('Соотнесите число')
    expect(sanitized.tableHeaders?.length).toBeGreaterThan(1)
    expect(sanitized.tableAnswerBank?.length).toBeGreaterThan(0)
    expect(sanitized.leftItems).toBeUndefined()
  })

  it('removes rejected matching text dumps from worksheets', () => {
    const blocks = sanitizeBlocks([
      {
        id: 'text-1',
        type: 'text',
        page: 0,
        title: 'Мусор',
        issued: false,
        body: 'Сопоставьте дроби с их типом.\n\n• $2/3$\n• $5/2$\n\n• Правильная дробь\n• Неправильная дробь',
      },
      {
        id: 'task-3',
        type: 'grouping',
        page: 0,
        title: 'Задание 3',
        issued: false,
        question: 'Распределите дроби.',
        ...createDefaultGroupingTableFields(),
      },
    ])

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe('grouping')
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
