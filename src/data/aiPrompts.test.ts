import { describe, expect, it } from 'vitest'
import { filledCreateDraft } from './worksheet'
import { promptsForPlan, promptsForSingleTask, promptsForWorksheet } from './aiPrompts'

describe('IMAGE_DESCRIPTION_RULES in prompts', () => {
  const draft = filledCreateDraft()

  it('includes image rules and task_count in plan prompt', () => {
    const { system } = promptsForPlan(draft)
    expect(system).toContain('описания в [квадратных скобках]')
    expect(system).toContain('ровно task_count заданий')
    expect(system).toContain(`Ровно ${draft.taskCount} элементов`)
  })

  it('includes image rules in worksheet prompt', () => {
    const { system } = promptsForWorksheet(draft, 'create')
    expect(system).toContain('непригодную иллюстрацию')
    expect(system).toContain('не показывай [скобки]')
  })

  it('includes standalone task rules in plan prompt', () => {
    const { system } = promptsForPlan(draft)
    expect(system).toContain('План — независимые задания')
    expect(system).toContain('не этап многошагового решения')
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
