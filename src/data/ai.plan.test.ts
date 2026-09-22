import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { filledCreateDraft, createPlan } from './worksheet'
import { generatePlanAI, generatePlanAIWithMeta } from './ai'
import { prepareReferenceContent } from './contextFilter'

const CAVE_SAMPLE = `5-6 классы

Бараш, Крош, Совунья отправились в поход. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если

Совунья пересекла пещеру за 3 минуты,
Пин затратил 1 минуту?

7-8 классы

Другая задача про магазин. Сколько стоят 2 кг яблок?`

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

  it('does not replace AI plan with grade-block template after validation failures', async () => {
    const badPlan = {
      task_plan: Array.from({ length: 5 }, (_, i) => ({
        type: 'input',
        user_description: `Шаг ${i + 1} про пещеру`,
        description: [
          'Записать время прохождения пещеры для каждого персонажа',
          'Упорядочить персонажей по времени прохождения пещеры',
          'Выбрать стратегию прохождения пещеры',
          'Заполнить пропуски в условии про пещеру',
          'Объяснить оптимальное время прохождения пещеры',
        ][i],
        difficulty: 'basic',
      })),
    }

    const goodPlan = {
      task_plan: [
        {
          type: 'input',
          user_description: 'Пещера Смешариков',
          description: 'Определить минимальное суммарное время прохождения пещеры при ограничениях на пары',
          difficulty: 'basic',
        },
        {
          type: 'single_choice',
          user_description: 'Яблоки в магазине',
          description: 'Выбрать верный ответ в задаче про стоимость яблок',
          difficulty: 'basic',
        },
        {
          type: 'fill_gaps',
          user_description: 'Маршрут доставки',
          description: 'Восстановить пропуски в условии про маршрут доставки молока',
          difficulty: 'medium',
        },
        {
          type: 'ordering',
          user_description: 'Логика городов',
          description: 'Упорядочить утверждения в задаче про Правдинск и Лжеград',
          difficulty: 'medium',
        },
        {
          type: 'input',
          user_description: 'Сравнение времени',
          description: 'Сравнить время проезда между торговыми точками на карте',
          difficulty: 'advanced',
        },
      ],
    }

    vi.mocked(chatJson)
      .mockResolvedValueOnce(badPlan)
      .mockResolvedValueOnce(badPlan)
      .mockResolvedValueOnce(badPlan)
      .mockResolvedValueOnce(goodPlan)

    const draft = {
      ...filledCreateDraft(),
      taskCount: 5,
      grade: '6',
      plan: createPlan(5),
      contextFileName: 'Задачи пробы.docx',
      contextFileText: CAVE_SAMPLE,
    }

    const { plan, meta } = await generatePlanAIWithMeta(draft)
    expect(plan).toHaveLength(5)
    expect(plan.some((item) => /5-6 классы|7-8 классы/i.test(item.userExpectation))).toBe(false)
    expect(plan.some((item) => /Составить задание по материалу/i.test(item.userExpectation))).toBe(
      false,
    )
    expect(meta.source).toBe('ai')
    expect(plan[0].description).toContain('пещер')
  })

  it('uses fragment-based fallback when model returns empty plan', async () => {
    vi.mocked(chatJson).mockResolvedValue({ task_plan: [] })

    const draft = {
      ...filledCreateDraft(),
      taskCount: 2,
      grade: '6',
      plan: createPlan(2),
      contextFileName: 'Задачи пробы.docx',
      contextFileText: CAVE_SAMPLE,
    }

    const { plan, meta } = await generatePlanAIWithMeta(draft)
    expect(meta.source).toBe('fallback_fragment')
    expect(plan).toHaveLength(2)
    expect(plan[0].userExpectation.length).toBeGreaterThan(10)
    expect(plan[0].userExpectation).not.toContain('5-6 классы')
    expect(prepareReferenceContent(CAVE_SAMPLE, { grade: '6' })).toContain('пещер')
  })
})
