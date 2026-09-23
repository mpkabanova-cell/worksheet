import { describe, expect, it } from 'vitest'
import { filledCreateDraft, migrateWorksheetDraft } from './worksheet'
import {
  agent1UserPayload,
  agent2UserPayload,
  gradeForAgent,
  taskPlanForAgent,
} from './worksheetSpecPayload'

const AGENT1_KEYS = [
  'additional_wishes',
  'difficulty',
  'grade',
  'source_content',
  'subject',
  'task_count',
  'task_plan',
  'topic',
] as const

const AGENT2_EXTRA_KEYS = ['generated_json_schema', 'generated_json_template', 'show_intro'] as const

describe('worksheetSpecPayload', () => {
  const draft = filledCreateDraft()
  draft.additionalWishes = 'Только задачи из файла'
  draft.showIntro = false
  draft.taskPlan[0].type = 'input'
  draft.taskPlan[0].userDescription = 'Текстовая задача'
  draft.taskPlan[0].description = 'Описание для генератора'
  draft.taskPlan[0].difficulty = 'basic'

  it('gradeForAgent returns integer grade for agent JSON', () => {
    expect(gradeForAgent({ ...draft, grade: '7' })).toBe(7)
    expect(gradeForAgent({ ...draft, grade: 'Другое' })).toBeNull()
  })

  it('agent1UserPayload matches PDF field names', () => {
    const payload = agent1UserPayload(draft)
    expect(Object.keys(payload).sort()).toEqual([...AGENT1_KEYS].sort())
    expect(typeof payload.grade).toBe('number')
    expect(payload.grade).toBe(6)
    expect(payload.task_count).toBe(5)
    expect(payload.difficulty).toBe('differentiated')
    expect(payload.additional_wishes).toBe('Только задачи из файла')
    expect(payload).not.toHaveProperty('plan_difficulty')
    expect(payload).not.toHaveProperty('show_intro')
    expect(payload).not.toHaveProperty('teacher_wishes')
    expect(payload).not.toHaveProperty('reference_file')
  })

  it('taskPlanForAgent serializes full spec rows', () => {
    const rows = taskPlanForAgent(draft)
    expect(rows[0]).toEqual({
      type: 'input',
      user_description: 'Текстовая задача',
      description: 'Описание для генератора',
      difficulty: 'basic',
    })
  })

  it('agent2UserPayload includes full task_plan and generator extras', () => {
    const payload = agent2UserPayload(draft)
    const keys = Object.keys(payload).sort()
    expect(keys).toEqual([...AGENT1_KEYS, ...AGENT2_EXTRA_KEYS].sort())
    expect(payload.show_intro).toBe(false)
    expect(payload.task_plan[0].user_description).toBe('Текстовая задача')
    expect(payload.generated_json_template).toBeDefined()
    expect(payload.generated_json_schema).toBeDefined()
    expect(payload).not.toHaveProperty('plan_difficulty')
  })

  it('migrateWorksheetDraft maps legacy localStorage field names', () => {
    const migrated = migrateWorksheetDraft({
      id: 'legacy-1',
      subject: 'Математика',
      grade: '5',
      topic: 'Дроби',
      taskCount: 1,
      wishes: 'Старые пожелания',
      addIntro: false,
      plan: [
        {
          id: 'p1',
          taskType: 'short_answer',
          userExpectation: 'Пример на сложение',
          planDifficulty: 'medium',
          description: 'Сложить два числа',
        },
      ],
      generationBaseline: {
        subject: 'Математика',
        grade: '5',
        topic: 'Дроби',
        plan_difficulty: 'basic',
        additional_wishes: null,
        source_content: null,
        task_plan: [],
      },
    })

    expect(migrated.additionalWishes).toBe('Старые пожелания')
    expect(migrated.showIntro).toBe(false)
    expect(migrated.taskPlan).toHaveLength(1)
    expect(migrated.taskPlan[0].type).toBe('input')
    expect(migrated.taskPlan[0].userDescription).toBe('Пример на сложение')
    expect(migrated.taskPlan[0].difficulty).toBe('medium')
    expect(migrated.generationBaseline?.difficulty).toBe('basic')
  })
})
