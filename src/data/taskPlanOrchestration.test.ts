import { describe, expect, it } from 'vitest'
import { createPlan } from './worksheet'
import {
  fillMissingPlanDescriptions,
  invalidateDescriptions,
  planNeedsPlanner,
  planRowToSpec,
  resizePlanToTaskCount,
  saveGenerationBaseline,
  type GenerationBaseline,
} from './taskPlanOrchestration'

describe('resizePlanToTaskCount', () => {
  it('trims rows from the end without changing surviving rows', () => {
    const plan = createPlan(4)
    plan[0] = { ...plan[0], type: 'single_choice', description: 'A', userDescription: 'u0' }
    plan[2] = { ...plan[2], type: 'fill_gaps', description: 'C', userDescription: 'u2' }

    const resized = resizePlanToTaskCount(plan, 2)

    expect(resized).toHaveLength(2)
    expect(resized[0].description).toBe('A')
    expect(resized[1].description).toBeNull()
    expect(resized[1].userDescription).toBe('')
  })

  it('appends empty null rows when count increases', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], description: 'Keep me', userDescription: 'x' }

    const resized = resizePlanToTaskCount(plan, 4)

    expect(resized).toHaveLength(4)
    expect(resized[0].description).toBe('Keep me')
    expect(resized[2].description).toBeNull()
    expect(resized[3].description).toBeNull()
  })
})

describe('invalidateDescriptions', () => {
  const globals = {
    subject: 'Математика',
    grade: '6',
    topic: 'Дроби',
    difficulty: 'differentiated' as const,
    additional_wishes: null,
    source_content: null,
  }

  function baselineFromPlan(plan: ReturnType<typeof createPlan>): GenerationBaseline {
    return {
      ...globals,
      task_plan: plan.map(planRowToSpec),
    }
  }

  it('nulls all descriptions when a global field changes', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], type: 'input', description: 'd0', userDescription: 'u0' }
    plan[1] = { ...plan[1], type: 'single_choice', description: 'd1', userDescription: 'u1' }

    const invalidated = invalidateDescriptions(plan, baselineFromPlan(plan), {
      ...globals,
      topic: 'Умножение дробей',
    })

    expect(invalidated.every((row) => row.description === null)).toBe(true)
    expect(invalidated[0].userDescription).toBe('u0')
    expect(invalidated[0].type).toBe('input')
  })

  it('nulls description only for changed row type or user_description', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], type: 'input', description: 'd0', userDescription: 'u0' }
    plan[1] = { ...plan[1], type: 'single_choice', description: 'd1', userDescription: 'u1' }

    const baseline = baselineFromPlan(plan)
    const edited = [
      { ...plan[0], userDescription: 'changed' },
      { ...plan[1] },
    ]

    const invalidated = invalidateDescriptions(edited, baseline, globals)

    expect(invalidated[0].description).toBeNull()
    expect(invalidated[1].description).toBe('d1')
  })

  it('nulls description for new rows without baseline pair', () => {
    const plan = createPlan(1)
    plan[0] = { ...plan[0], type: 'input', description: 'd0', userDescription: 'u0' }
    const baseline = baselineFromPlan(plan)

    const extended = resizePlanToTaskCount(plan, 2)
    const invalidated = invalidateDescriptions(extended, baseline, globals)

    expect(invalidated[0].description).toBe('d0')
    expect(invalidated[1].description).toBeNull()
  })

  it('does not invalidate when only task_count grows via resize', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], type: 'input', description: 'd0', userDescription: 'u0' }
    plan[1] = { ...plan[1], type: 'single_choice', description: 'd1', userDescription: 'u1' }

    const baseline = saveGenerationBaseline(
      {
        id: 'ws-1',
        subject: globals.subject,
        grade: globals.grade,
        topic: globals.topic,
        taskCount: 2,
        additionalWishes: '',
        title: '',
        intro: '',
        difficulty: 'differentiated',
        showDifficulty: true,
        showAnswers: false,
        showIntro: true,
        taskPlan: plan,
        blocks: [],
        pages: 1,
        print: { answersSeparate: false, copies: 1, orientation: 'portrait' },
      },
      plan,
    )

    const resized = resizePlanToTaskCount(plan, 3)
    const invalidated = invalidateDescriptions(resized, baseline, globals)

    expect(invalidated[0].description).toBe('d0')
    expect(invalidated[1].description).toBe('d1')
    expect(invalidated[2].description).toBeNull()
  })
})

describe('fillMissingPlanDescriptions', () => {
  it('keeps user mechanics and fills description when empty', () => {
    const plan = createPlan(3)
    plan[0].type = 'input'
    plan[1].type = 'single_choice'
    plan[2].type = 'fill_gaps'
    plan.forEach((row) => {
      row.userDescription = ''
      row.description = null
    })

    const draft = {
      subject: 'Русский язык',
      grade: '5',
      topic: 'Падежи',
      taskCount: 3,
      taskPlan: plan,
    } as import('./worksheet').WorksheetDraft

    const filled = fillMissingPlanDescriptions(plan, draft)
    expect(filled[0].type).toBe('input')
    expect(filled[1].type).toBe('single_choice')
    expect(filled[2].type).toBe('fill_gaps')
    expect(filled.every((row) => row.description?.trim())).toBe(true)
    expect(filled[1].description).toContain('Один вариант ответа')
  })
})

describe('planNeedsPlanner', () => {
  it('is false when every row has description', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], description: 'a' }
    plan[1] = { ...plan[1], description: 'b' }
    expect(planNeedsPlanner(plan)).toBe(false)
  })

  it('is true when any description is null or empty', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], description: 'a' }
    expect(planNeedsPlanner(plan)).toBe(true)
  })
})
