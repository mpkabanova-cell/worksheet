import { describe, expect, it } from 'vitest'
import { filledCreateDraft } from './worksheet'
import { promptsForPlan, promptsForSingleTask, promptsForWorksheet } from './aiPrompts'

describe('IMAGE_DESCRIPTION_RULES in prompts', () => {
  const draft = filledCreateDraft()

  it('plan prompt uses planning agent spec without CONTENT_RULES', () => {
    const { system, user } = promptsForPlan(draft)
    expect(system).toContain('НЕ создаёшь конкретные задания')
    expect(system).toContain('task_plan')
    expect(system).not.toContain('[Поле question]')
    expect(user).toContain('task_plan')
    expect(user).toContain('difficulty')
    expect(user).toContain('additional_wishes')
  })

  it('includes image rules in worksheet prompt', () => {
    const { system } = promptsForWorksheet(draft, 'create')
    expect(system).toContain('непригоден')
    expect(system).toContain('не показывай [скобки]')
  })

  it('includes full material rules when additional_wishes request entire document', () => {
    const draft = {
      ...filledCreateDraft(),
      additionalWishes: 'Используй весь материал документа',
    }
    const { system } = promptsForPlan(draft)
    expect(system).toContain('весь материал документа')
    expect(system).toContain('аналогами')
  })

  it('includes standalone task rules in plan prompt', () => {
    const { system } = promptsForPlan(draft)
    expect(system).toContain('План — независимые задания')
    expect(system).toContain('не этап многошагового решения')
  })

  it('worksheet prompt uses task_plan and generated_json_template', () => {
    const { system, user } = promptsForWorksheet(draft, 'create')
    expect(system).toContain('task_plan')
    expect(system).toContain('generated_json_template')
    const parsed = JSON.parse(user)
    expect(parsed.generated_json_template).toBeDefined()
    expect(parsed.generated_json_schema).toBeDefined()
    expect(parsed.task_plan).toBeDefined()
    expect(parsed.source_content).toBeDefined()
    expect(parsed.additional_wishes).toBeDefined()
  })

  it('includes reference material rules in worksheet prompt', () => {
    const { system } = promptsForWorksheet(draft, 'create')
    expect(system).toContain('Опора на reference_file')
    expect(system).toContain('главный источник задач')
  })

  it('includes standalone task rules in worksheet prompt', () => {
    const { system } = promptsForWorksheet(draft, 'create')
    expect(system).toContain('полное условие')
    expect(system).toContain('ответ к заданию 1 не используется')
  })

  it('includes standalone task rules in single task prompt', () => {
    const { system } = promptsForSingleTask(draft, 'short_answer', 'Решить пример')
    expect(system).toContain('Самостоятельность заданий')
  })
})
