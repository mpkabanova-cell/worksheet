import { describe, expect, it } from 'vitest'
import {
  GROUPING_HEADER_PLACEHOLDER,
  TABLE_COLS_DEFAULT,
  TABLE_ROWS_DEFAULT,
  createDefaultGroupingTableFields,
  groupsToTableFields,
  normalizeWorksheetDraft,
  sanitizeBlock,
} from './blockUtils'
import type { WorksheetBlock } from './worksheet'

describe('grouping table normalization', () => {
  it('converts legacy groups into table fields', () => {
    const block: WorksheetBlock = {
      id: 'g1',
      type: 'grouping',
      page: 0,
      title: 'Задание 1',
      issued: false,
      groups: [
        { id: 'a', title: 'Целые', items: ['-1', '0'] },
        { id: 'b', title: 'Натуральные', items: ['4'] },
      ],
    }

    const sanitized = sanitizeBlock(block)
    expect(sanitized.type).toBe('grouping')
    expect(sanitized.tableCols).toBe(2)
    expect(sanitized.tableHeaders).toEqual(['Целые', 'Натуральные'])
    expect(sanitized.tableCells?.[0]).toEqual(['-1', '4'])
    expect(sanitized.tableCells?.[1]).toEqual(['0', ''])
    expect(sanitized.tableAnswerBank).toEqual(['-1', '0', '4'])
    expect(sanitized.groups).toBeUndefined()
  })

  it('migrates table type to grouping with defaults', () => {
    const block: WorksheetBlock = {
      id: 't1',
      type: 'table',
      page: 0,
      title: 'Таблица',
      issued: false,
    }

    const sanitized = sanitizeBlock(block)
    expect(sanitized.type).toBe('grouping')
    expect(sanitized.tableRows).toBe(TABLE_ROWS_DEFAULT)
    expect(sanitized.tableCols).toBe(TABLE_COLS_DEFAULT)
    expect(sanitized.tableHeaders).toEqual([
      GROUPING_HEADER_PLACEHOLDER,
      GROUPING_HEADER_PLACEHOLDER,
      GROUPING_HEADER_PLACEHOLDER,
    ])
  })

  it('creates default grouping table fields', () => {
    const defaults = createDefaultGroupingTableFields()
    expect(defaults.tableRows).toBe(4)
    expect(defaults.tableCols).toBe(3)
    expect(defaults.tableShowAnswerBank).toBe(true)
    expect(defaults.tableShuffleAnswers).toBe(true)
  })

  it('normalizes worksheet drafts with grouping blocks', () => {
    const draft = normalizeWorksheetDraft({
      id: 'ws',
      title: 'Test',
      topic: 'Test',
      subject: 'Математика',
      grade: '7',
      taskCount: 1,
      difficulty: 'basic',
      wishes: '',
      showDifficulty: true,
      showAnswers: false,
      addIntro: false,
      intro: '',
      plan: [],
      blocks: [
        {
          id: 'b1',
          type: 'grouping',
          page: 0,
          title: '1',
          issued: false,
          groups: [{ id: 'g1', title: 'A', items: ['x'] }],
        },
      ],
      pages: 1,
      print: { answersSeparate: true, copies: 1, orientation: 'portrait' },
    })

    expect(draft.blocks[0]?.tableHeaders).toEqual(['A', GROUPING_HEADER_PLACEHOLDER])
  })
})

describe('groupsToTableFields', () => {
  it('builds answer bank from all group items', () => {
    const table = groupsToTableFields([
      { title: 'A', items: ['Слово 1', 'Слово 2'] },
      { title: 'B', items: ['Слово 3'] },
    ])
    expect(table.tableAnswerBank).toEqual(['Слово 1', 'Слово 2', 'Слово 3'])
  })
})
