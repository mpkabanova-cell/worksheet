import { describe, expect, it } from 'vitest'
import { createPlan, filledCreateDraft } from './worksheet'
import { countWorksheetTaskBlocks, ensureWorksheetTaskBlocks } from './ai'
import type { WorksheetBlock } from './worksheet'

describe('ensureWorksheetTaskBlocks', () => {
  it('restores fill_gaps block degraded to text', () => {
    const draft = { ...filledCreateDraft(), taskCount: 2 }
    const plan = createPlan(2)
    plan[1] = {
      ...plan[1],
      taskType: 'fill_gaps',
      userExpectation: 'Задача на проценты',
      description: 'Решить текстовую задачу на проценты с пропусками',
    }

    const blocks: WorksheetBlock[] = [
      {
        id: 'task-1',
        type: 'short_answer',
        page: 0,
        title: 'Задание 1',
        instruction: '',
        question: 'Запишите число двести сорок пять цифрами.',
        correctAnswers: ['245'],
      },
      {
        id: 'task-2',
        type: 'text',
        page: 0,
        title: 'Задание 2',
        body: 'Найдите ___ % от 200. Ответ: ___',
      },
    ]

    const result = ensureWorksheetTaskBlocks(
      blocks,
      plan,
      draft,
      null,
      plan.map((item) => item.description || item.userExpectation),
    )

    expect(result).toHaveLength(2)
    expect(result[1].type).toBe('fill_gaps')
    expect(countWorksheetTaskBlocks(result)).toBe(2)
  })

  it('pads missing blocks to match plan length', () => {
    const draft = { ...filledCreateDraft(), taskCount: 3 }
    const plan = createPlan(3)
    const blocks: WorksheetBlock[] = [
      {
        id: 'task-1',
        type: 'short_answer',
        page: 0,
        title: 'Задание 1',
        instruction: '',
        question: 'Запишите число двести сорок пять цифрами.',
        correctAnswers: ['245'],
      },
    ]

    const result = ensureWorksheetTaskBlocks(blocks, plan, draft, null, [])
    expect(result).toHaveLength(3)
    expect(countWorksheetTaskBlocks(result)).toBe(3)
  })
})
