import { describe, expect, it } from 'vitest'
import { createPlan, filledCreateDraft } from './worksheet'
import {
  countWorksheetTaskBlocks,
  ensureWorksheetTaskBlocks,
  repairWorksheetBlocksForDelivery,
  templateToBlocks,
} from './ai'
import { blockingSelfSufficiencyIssues, validateTaskSelfSufficiency } from './taskIndependence'
import type { WorksheetBlock } from './worksheet'

function collectIssues(blocks: WorksheetBlock[], planBriefs: string[]): string[] {
  const tasks = blocks.map((block) => ({
    type: block.type,
    question: block.question,
    gaps_text: block.type === 'fill_gaps' ? block.gapsSourceText ?? block.gapsText : undefined,
    gaps_answers: block.gapsAnswers,
  }))
  return validateTaskSelfSufficiency(tasks, planBriefs)
}

describe('ensureWorksheetTaskBlocks', () => {
  it('restores fill_gaps block degraded to text', () => {
    const draft = { ...filledCreateDraft(), taskCount: 2 }
    const plan = createPlan(2)
    plan[1] = {
      ...plan[1],
      type: 'fill_gaps',
      userDescription: 'Задача на проценты',
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
      plan.map((item) => item.description || item.userDescription),
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

  it('parses filled worksheet template into blocks', () => {
    const draft = { ...filledCreateDraft(), taskCount: 1 }
    const plan = createPlan(1)
    plan[0] = {
      ...plan[0],
      type: 'input',
      description: 'Краткий числовой ответ',
    }

    const blocks = templateToBlocks(
      {
        title: 'Тест',
        intro: '',
        tasks: [
          {
            type: 'input',
            instruction: '',
            question: 'Сколько будет 2+2?',
            correct_answers: ['4'],
            difficulty: 1,
          },
        ],
      },
      plan,
      draft,
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('short_answer')
    expect(blocks[0].question).toContain('2+2')
    expect(blocks[0].correctAnswers).toEqual(['4'])
  })
})

describe('repairWorksheetBlocksForDelivery', () => {
  it('replaces author plan description in question', () => {
    const draft = { ...filledCreateDraft(), taskCount: 1 }
    const plan = createPlan(1)
    plan[0] = {
      ...plan[0],
      type: 'input',
      description: 'Сравнить две обыкновенные дроби и выбрать большую',
      userDescription: 'Дроби',
    }
    const brief = plan[0].description ?? ''
    const blocks: WorksheetBlock[] = [
      {
        id: 'task-1',
        type: 'single_choice',
        page: 0,
        title: 'Задание 1',
        instruction: '',
        question:
          'Задача на выбор персонажа, который затратил наибольшее время, исходя из предоставленных данных.',
        options: [
          { id: 'a', text: '1/2' },
          { id: 'b', text: '1/3' },
        ],
      },
    ]

    const repaired = repairWorksheetBlocksForDelivery(blocks, plan, draft, null, [brief])
    expect(repaired[0].question).not.toMatch(/Задача на выбор/)
    expect(repaired[0].question!.length).toBeGreaterThan(10)
  })

  it('reduces blocking issues for generic fill_gaps without ref file', () => {
    const draft = { ...filledCreateDraft(), taskCount: 1, topic: 'Дроби' }
    const plan = createPlan(1)
    plan[0] = { ...plan[0], type: 'fill_gaps', userDescription: 'Пропуски', description: 'Текст с пропусками' }
    const brief = 'Заполните пропуски в правиле сложения дробей'
    const blocks: WorksheetBlock[] = [
      {
        id: 'task-1',
        type: 'fill_gaps',
        page: 0,
        title: 'Задание 1',
        instruction: '',
        question: 'Заполните пропуски.',
        gapsText:
          'По теме «Дроби» важно помнить: ___ — это основа, а ___ помогает проверить результат.',
        gapsAnswers: ['правило', 'пример'],
      },
    ]

    const before = blockingSelfSufficiencyIssues(collectIssues(blocks, [brief]))
    const repaired = repairWorksheetBlocksForDelivery(blocks, plan, draft, null, [brief])
    const after = blockingSelfSufficiencyIssues(collectIssues(repaired, [brief]))
    expect(before.length).toBeGreaterThan(0)
    expect(after.length).toBeLessThan(before.length)
  })
})
