import { describe, expect, it } from 'vitest'
import { createPlan } from './worksheet'
import { buildWorksheetJsonSchema, buildWorksheetJsonTemplate, templateTaskToAiPayload } from './worksheetJsonTemplate'

describe('buildWorksheetJsonTemplate', () => {
  it('builds empty skeletons for each spec mechanic', () => {
    const plan = createPlan(7)
    plan[0] = { ...plan[0], taskType: 'short_answer' }
    plan[1] = { ...plan[1], taskType: 'single_choice' }
    plan[2] = { ...plan[2], taskType: 'multiple_choice' }
    plan[3] = { ...plan[3], taskType: 'matching' }
    plan[4] = { ...plan[4], taskType: 'grouping' }
    plan[5] = { ...plan[5], taskType: 'ordering' }
    plan[6] = { ...plan[6], taskType: 'fill_gaps' }

    const template = buildWorksheetJsonTemplate(plan, true)

    expect(template.tasks).toHaveLength(7)
    expect(template.tasks[0].type).toBe('input')
    expect(template.tasks[1].options).toHaveLength(4)
    expect(template.tasks[3].left_items).toEqual([])
    expect(template.tasks[4].groups).toHaveLength(2)
    expect(template.tasks[6].gaps_text).toBe('')
  })
})

describe('buildWorksheetJsonSchema', () => {
  it('requires title and tasks with per-row constraints', () => {
    const plan = createPlan(2)
    plan[0] = { ...plan[0], taskType: 'single_choice' }
    plan[1] = { ...plan[1], taskType: 'fill_gaps' }

    const schema = buildWorksheetJsonSchema(plan, false) as {
      required: string[]
      properties: { tasks: { minItems: number; maxItems: number } }
    }

    expect(schema.required).toEqual(['title', 'tasks'])
    expect(schema.properties.tasks.minItems).toBe(2)
    expect(schema.properties.tasks.maxItems).toBe(2)
  })
})

describe('templateTaskToAiPayload', () => {
  it('maps spec input to short_answer internal type', () => {
    const plan = createPlan(1)
    plan[0] = {
      ...plan[0],
      taskType: 'short_answer',
      description: 'Краткий числовой ответ',
    }

    const payload = templateTaskToAiPayload(
      { type: 'input', question: 'Сколько будет 2+2?', correct_answers: ['4'] },
      plan[0],
    )

    expect(payload.type).toBe('short_answer')
    expect(payload.correct_answers).toEqual(['4'])
  })
})
