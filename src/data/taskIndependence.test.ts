import { describe, expect, it } from 'vitest'
import type { AiTaskPayload } from './ai'
import { validatePlanIndependence, validateTaskIndependence } from './taskIndependence'

describe('validatePlanIndependence', () => {
  it('flags repeated cave story in plan', () => {
    const issues = validatePlanIndependence([
      { expectation: 'Записать время прохождения пещеры для каждого персонажа' },
      { expectation: 'Упорядочить персонажей по времени прохождения пещеры' },
      { expectation: 'Выбрать правило прохождения пещеры' },
    ])
    expect(issues.length).toBeGreaterThan(0)
  })
})

describe('validateTaskIndependence', () => {
  it('flags short questions without data', () => {
    const tasks: AiTaskPayload[] = [
      {
        type: 'short_answer',
        question: 'Запишите время прохождения пещеры для каждого персонажа.',
      },
      {
        type: 'ordering',
        question: 'Упорядочьте персонажей по времени прохождения пещеры.',
        order_items: ['A', 'B'],
      },
    ]
    const issues = validateTaskIndependence(tasks)
    expect(issues.some((i) => i.includes('короткое') || i.includes('данные'))).toBe(true)
  })

  it('flags fill_gaps without gaps_text', () => {
    const issues = validateTaskIndependence([
      {
        type: 'fill_gaps',
        question: 'Заполните пропуски в описании стратегии.',
      },
    ])
    expect(issues.some((i) => i.includes('gaps_text'))).toBe(true)
  })

  it('accepts self-contained word problem', () => {
    const issues = validateTaskIndependence([
      {
        type: 'short_answer',
        question:
          'В магазине 3 кг яблок стоят 450 руб. Сколько рублей стоят 5 кг яблок при той же цене за килограмм?',
      },
    ])
    expect(issues).toEqual([])
  })
})
