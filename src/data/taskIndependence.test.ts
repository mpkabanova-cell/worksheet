import { describe, expect, it } from 'vitest'
import type { AiTaskPayload } from './ai'
import {
  blockingSelfSufficiencyIssues,
  validatePlanIndependence,
  validateTaskIndependence,
  validateTaskSelfSufficiency,
  validateWorksheetPipeline,
  taskSelfSufficiencyIssues,
} from './taskIndependence'

describe('blockingSelfSufficiencyIssues', () => {
  it('treats cross-refs and meta description as blocking', () => {
    const issues = [
      'Задание 1: отсылка к другим заданиям, reference_file или тексту листа',
      'Задание 2: question слишком короткое — нет полного условия с данными',
    ]
    const blocking = blockingSelfSufficiencyIssues(issues)
    expect(blocking).toHaveLength(1)
    expect(blocking[0]).toMatch(/отсылка/)
  })

  it('does not block short-question warnings', () => {
    const issues = ['Задание 1: ordering без полного условия задачи в question']
    expect(blockingSelfSufficiencyIssues(issues)).toEqual([])
  })
})

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

  it('does not require ___ in migrated fill_gaps source when answers are set', () => {
    const issues = taskSelfSufficiencyIssues({
      type: 'fill_gaps',
      question: 'Заполните пропуски в тексте.',
      gaps_text:
        'Чтобы сложить дроби, нужно сложить их числители, а знаменатель оставить без изменения.',
      gaps_answers: ['числители', 'без изменения'],
    })
    expect(issues.some((i) => i.includes('gaps_text с пропусками'))).toBe(false)
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

  it('does not treat several money word problems as one pipeline story', () => {
    const tasks: AiTaskPayload[] = [
      {
        type: 'short_answer',
        question: 'Яблоки стоят 120 руб. за 2 кг. Сколько стоят 5 кг?',
      },
      {
        type: 'short_answer',
        question: 'Булка стоит 45 руб., а батон — 60 руб. На 300 руб. сколько булок можно купить?',
      },
      {
        type: 'single_choice',
        question: 'Какая дробь больше: $\\frac{3}{4}$ или $\\frac{2}{3}$?',
        options: ['$\\frac{3}{4}$', '$\\frac{2}{3}$', 'Равны'],
      },
      {
        type: 'short_answer',
        question: 'Найдите $\\frac{1}{2}$ от 56.',
      },
    ]
    expect(validateWorksheetPipeline(tasks)).toEqual([])
  })

  it('flags fill_gaps with minute blanks but no times in question', () => {
    const issues = validateTaskIndependence([
      {
        type: 'fill_gaps',
        question:
          'Бараш, Крош, Совунья отправились в поход. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если',
        gaps_text:
          'Совунья пересекла пещеру за ___ минут, Пин затратил ___ минуту, Крош затратил ___ минуты.',
      },
    ])
    expect(issues.some((i) => i.includes('минут') || i.includes('самостоятель'))).toBe(true)
  })

  it('flags meta description copied into question', () => {
    const issues = validateTaskIndependence([
      {
        type: 'single_choice',
        question:
          'Задача на выбор персонажа, который затратил наибольшее время на прохождение пещеры, исходя из предоставленных данных.',
        options: ['Бараш', 'Лосяш'],
      },
    ])
    expect(issues.some((i) => i.includes('Задача на выбор') || i.includes('служеб'))).toBe(true)
  })

  it('flags author plan description instead of student question', () => {
    const description =
      'Задача на логику и оптимизацию маршрута, требующая вычисления минимального суммарного времени прохождения пещеры с учетом заданных условий и ограничений. Ожидается подробное решение с обоснованием.'
    const issues = validateTaskIndependence(
      [{ type: 'extended_answer', question: description }],
      [description],
    )
    expect(issues.some((i) => i.includes('описание'))).toBe(true)
  })

  it('flags generic topic fill_gaps template', () => {
    const issues = validateTaskIndependence([
      {
        type: 'fill_gaps',
        question: 'Восстановление пропущенных числовых данных в расчете времени работы менеджера',
        gaps_text:
          'По теме «Решение задач» важно помнить: ___ — это основа, а ___ помогает проверить результат.',
        gaps_answers: ['правило', 'пример'],
      },
    ])
    expect(issues.some((i) => i.includes('шаблон') || i.includes('правило'))).toBe(true)
  })

  it('flags user cave-pipeline worksheet with description questions', () => {
    const tasks: AiTaskPayload[] = [
      {
        type: 'extended_answer',
        question:
          'Решение задачи на логику и оптимизацию времени прохождения пещеры с учетом ограничений и индивидуальных скоростей персонажей, с записью полного хода решения и итогового ответа.',
      },
      {
        type: 'single_choice',
        question:
          'Выбор персонажа с наименьшим индивидуальным временем прохождения пещеры из предложенного списка.',
        options: ['Совунья', 'Пин', 'Крош', 'Ежик'],
      },
      {
        type: 'single_choice',
        question:
          'Выбор персонажа с наибольшим индивидуальным временем прохождения пещеры из предложенного списка.',
        options: ['Бараш', 'Совунья', 'Лосяш', 'Крош'],
      },
      {
        type: 'fill_gaps',
        question: 'Заполните пропуски в данных ниже.',
        gaps_text:
          'Совунья пересекла пещеру за ___ минут, Пин затратил ___ минуту, Крош затратил ___ минуты.',
      },
      {
        type: 'matching',
        question: 'Сопоставьте каждого персонажа с его временем прохождения Мышиной пещеры.',
        left_items: ['Совунья', 'Пин', 'Бараш', 'Крош', 'Ежик', 'Лосяш'],
        right_items: ['1 минута', '5 минут', '3 минуты', '2 минуты', '1 минута', '3 минуты'],
      },
    ]

    const pipelineIssues = validateWorksheetPipeline(tasks)
    expect(pipelineIssues.some((i) => i.includes('этап') || i.includes('пещер'))).toBe(true)

    const selfIssues = validateTaskSelfSufficiency(tasks)
    expect(selfIssues.some((i) => i.includes('описание') || i.includes('min/max'))).toBe(true)
  })
})
