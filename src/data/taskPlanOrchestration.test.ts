import { describe, expect, it } from 'vitest'
import { createPlan } from './worksheet'
import {
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
    plan[0] = { ...plan[0], taskType: 'single_choice', description: 'A', userExpectation: 'u0' }
    plan[2] = { ...plan[2], taskType: 'fill_gaps', description: 'C', userExpectation: 'u2' }

    const resized = resizePlanToTaskCount(plan, 2)

    expect(resized).toHaveLength(2)
    expect(resized[0].description).toBe('A')
    expect(resized[1].description).toBeNull()
    expect(resized[1].userExpectation).toBe('')
  })

  it('appends empty null rows when count increases', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], description: 'Keep me', userExpectation: 'x' }

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
    plan_difficulty: 'differentiated' as const,
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
    plan[0] = { ...plan[0], taskType: 'short_answer', description: 'd0', userExpectation: 'u0' }
    plan[1] = { ...plan[1], taskType: 'single_choice', description: 'd1', userExpectation: 'u1' }

    const invalidated = invalidateDescriptions(plan, baselineFromPlan(plan), {
      ...globals,
      topic: 'Умножение дробей',
    })

    expect(invalidated.every((row) => row.description === null)).toBe(true)
    expect(invalidated[0].userExpectation).toBe('u0')
    expect(invalidated[0].taskType).toBe('short_answer')
  })

  it('nulls description only for changed row type or user_description', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], taskType: 'short_answer', description: 'd0', userExpectation: 'u0' }
    plan[1] = { ...plan[1], taskType: 'single_choice', description: 'd1', userExpectation: 'u1' }

    const baseline = baselineFromPlan(plan)
    const edited = [
      { ...plan[0], userExpectation: 'changed' },
      { ...plan[1] },
    ]

    const invalidated = invalidateDescriptions(edited, baseline, globals)

    expect(invalidated[0].description).toBeNull()
    expect(invalidated[1].description).toBe('d1')
  })

  it('nulls description for new rows without baseline pair', () => {
    const plan = createPlan(1)
    plan[0] = { ...plan[0], taskType: 'short_answer', description: 'd0', userExpectation: 'u0' }
    const baseline = baselineFromPlan(plan)

    const extended = resizePlanToTaskCount(plan, 2)
    const invalidated = invalidateDescriptions(extended, baseline, globals)

    expect(invalidated[0].description).toBe('d0')
    expect(invalidated[1].description).toBeNull()
  })

  it('does not invalidate when only task_count grows via resize', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], taskType: 'short_answer', description: 'd0', userExpectation: 'u0' }
    plan[1] = { ...plan[1], taskType: 'single_choice', description: 'd1', userExpectation: 'u1' }

    const baseline = saveGenerationBaseline(
      {
        id: 'ws-1',
        subject: globals.subject,
        grade: globals.grade,
        topic: globals.topic,
        taskCount: 2,
        wishes: '',
        title: '',
        intro: '',
        difficulty: 'differentiated',
        showDifficulty: true,
        showAnswers: false,
        addIntro: true,
        plan,
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
