import { describe, expect, it } from 'vitest'
import {
  enrichCaveQuestion,
  extractCaveConditionFromReference,
  planExpectsStoryContext,
} from './referenceEnrich'

const CAVE_REFERENCE = `
5-6 классы

Бараш, Крош, Совунья, Ежик, Пин и Лосяш отправились в поход. Перед ними открылся вход в Мышиную пещеру. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если

Совунья пересекла пещеру за 3 минуты,
Пин затратил 1 минуту,
Бараш ни на шаг не отставал от Пина,
Крош затратил 2 минуты,
Ежик вышел из пещеры через 3 минуты,
Лосяша не могли дождаться 5 минут?

Решение:
18 минут.
`

describe('referenceEnrich', () => {
  it('detects cave-related plan expectations', () => {
    expect(planExpectsStoryContext('Определить время прохождения пещеры')).toBe(true)
    expect(planExpectsStoryContext('Объяснить логическую задачу про Правдинск')).toBe(false)
  })

  it('extracts cave condition without solution', () => {
    const text = extractCaveConditionFromReference(CAVE_REFERENCE)
    expect(text).toContain('Совунья пересекла пещеру за 3 минуты')
    expect(text).toContain('Лосяша не могли дождаться 5 минут')
    expect(text).not.toContain('Решение')
    expect(text).not.toContain('18 минут')
  })

  it('prepends cave data to bare question', () => {
    const question = enrichCaveQuestion(
      'Кто из персонажей затратил наибольшее время на прохождение пещеры?',
      CAVE_REFERENCE,
    )
    expect(question).toContain('Совунья пересекла пещеру за 3 минуты')
    expect(question).toContain('наибольшее время')
  })
})
