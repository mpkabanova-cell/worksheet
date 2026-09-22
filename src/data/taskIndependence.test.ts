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

  it('flags three cave-related plan items', () => {
    const issues = validatePlanIndependence([
      { expectation: 'Определить время прохождения пещеры для Бараша' },
      { expectation: 'Упорядочить персонажей по времени в пещере' },
      { expectation: 'Сопоставить персонажей с временем прохождения пещеры' },
    ])
    expect(issues.some((i) => i.includes('пещер') || i.includes('сюжет'))).toBe(true)
  })

  it('accepts different fragments from the same file', () => {
    const issues = validatePlanIndependence([
      { expectation: 'Определить минимальное суммарное время прохождения пещеры Смешариками' },
      { expectation: 'Выбрать верное утверждение в логической задаче про Правдинск и Лжеград' },
      { expectation: 'Составить оптимальный маршрут доставки молока по торговым точкам' },
      { expectation: 'Решить задачу про стоимость яблок в магазине' },
      { expectation: 'Сравнить время проезда между двумя торговыми точками на карте молокозавода' },
    ])
    expect(issues).toEqual([])
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

  it('flags fill_gaps about cave without story context', () => {
    const issues = validateTaskIndependence(
      [
        {
          type: 'fill_gaps',
          question: 'Заполните пропуски в условии задачи про пещеру.',
          gaps_text: '___ минут, ___ минуту, ___ минуты, ___ минуты, ___ минут',
        },
      ],
      ['Заполнить пропуски в задаче про пещеру'],
    )
    expect(issues.some((i) => i.includes('сюжет'))).toBe(true)
  })

  it('flags fill_gaps with character names only in gaps_text', () => {
    const issues = validateTaskIndependence([
      {
        type: 'fill_gaps',
        question: 'Заполните пропуски в условии задачи про пещеру.',
        gaps_text:
          'Совунья пересекла пещеру за ___ минут, Пин затратил ___ минуту, Крош затратил ___ минуты.',
      },
    ])
    expect(issues.some((i) => i.includes('сюжет'))).toBe(true)
  })

  it('flags reference dump in matching question', () => {
    const dump = '5-6 классы\n\n7-8 классы\n\n'.padEnd(1600, 'a')
    const issues = validateTaskIndependence([
      {
        type: 'matching',
        question: dump,
        left_items: ['Совунья', 'Пин'],
        right_items: ['3 минуты', '1 минута'],
      },
    ])
    expect(issues.some((i) => i.includes('reference_file') || i.includes('source_content'))).toBe(
      true,
    )
  })

  it('flags bare instruction copied from plan expectation', () => {
    const expectation = 'Определить, кто из персонажей проходит пещеру за наименьшее время'
    const tasks: AiTaskPayload[] = [
      {
        type: 'single_choice',
        question: 'Определите, кто из персонажей проходит пещеру за наименьшее время.',
        options: ['Бараш', 'Лосяш', 'Совунья'],
      },
    ]
    const issues = validateTaskIndependence(tasks, [expectation])
    expect(issues.some((i) => i.includes('description') || i.includes('инструкция'))).toBe(
      true,
    )
  })

  it('flags cave choice without time data', () => {
    const issues = validateTaskIndependence([
      {
        type: 'single_choice',
        question: 'Определите, кто проходит пещеру быстрее всех.',
        options: ['Бараш', 'Лосяш', 'Совунья'],
      },
    ])
    expect(issues.some((i) => i.includes('пещер') || i.includes('время'))).toBe(true)
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
