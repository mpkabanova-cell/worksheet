import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { filledCreateDraft, createPlan } from './worksheet'
import { generatePlanAI } from './ai'

vi.mock('./aiClient', () => ({
  chatJson: vi.fn(),
  AiError: class AiError extends Error {},
  isAiUnavailable: () => false,
}))

import { chatJson } from './aiClient'

describe('generatePlanAI task_count safety net', () => {
  beforeEach(() => {
    vi.mocked(chatJson).mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('pads plan to task_count when model returns fewer tasks (legacy tasks format)', async () => {
    vi.mocked(chatJson).mockResolvedValue({
      tasks: [{ type: 'short_answer', expectation: 'Решить пример' }],
    })

    const draft = { ...filledCreateDraft(), taskCount: 3, plan: [] }

    const plan = await generatePlanAI(draft)
    expect(plan).toHaveLength(3)
    expect(plan[0].userExpectation).toBe('Решить пример')
    expect(plan[1].userExpectation.length).toBeGreaterThan(0)
    expect(plan[2].userExpectation.length).toBeGreaterThan(0)
  })

  it('parses task_plan with description and difficulty', async () => {
    vi.mocked(chatJson).mockResolvedValue({
      task_plan: [
        {
          type: 'input',
          user_description: 'Текстовая задача на проценты',
          description: 'Простая текстовая задача на нахождение процента от числа с кратким ответом',
          difficulty: 'basic',
        },
        {
          type: 'table',
          user_description: 'Классификация',
          description: 'Распределение примеров по типам движения',
          difficulty: 'medium',
        },
      ],
    })

    const draft = { ...filledCreateDraft(), taskCount: 2, plan: createPlan(2) }

    const plan = await generatePlanAI(draft)
    expect(plan).toHaveLength(2)
    expect(plan[0].taskType).toBe('short_answer')
    expect(plan[0].description).toContain('процента')
    expect(plan[0].planDifficulty).toBe('basic')
    expect(plan[1].taskType).toBe('grouping')
    expect(plan[1].planDifficulty).toBe('medium')
  })
})
