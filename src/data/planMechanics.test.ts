import { describe, expect, it } from 'vitest'
import {
  fromSpecMechanic,
  normalizeDifficultyMode,
  normalizePlanItemDifficulty,
  planDifficultyToStars,
  planGenerationBrief,
  resolveInputType,
  toSpecMechanic,
} from './planMechanics'
import type { PlanTask } from './worksheet'
import { createPlan } from './worksheet'

describe('planMechanics', () => {
  it('assigns default mechanics to new plan rows', () => {
    const plan = createPlan(5)
    expect(plan.map((p) => p.type)).toEqual([
      'input',
      'single_choice',
      'single_choice',
      'fill_gaps',
      'matching',
    ])
  })

  it('maps internal types to spec mechanics', () => {
    expect(toSpecMechanic('short_answer')).toBe('input')
    expect(toSpecMechanic('extended_answer')).toBe('input')
    expect(toSpecMechanic('grouping')).toBe('table')
    expect(toSpecMechanic('matching')).toBe('matching')
  })

  it('maps spec input to short or extended answer', () => {
    expect(fromSpecMechanic('input', 'Краткий числовой ответ')).toBe('short_answer')
    expect(fromSpecMechanic('input', 'Развёрнутое объяснение с ходом решения')).toBe(
      'extended_answer',
    )
    expect(fromSpecMechanic('table')).toBe('grouping')
  })

  it('resolveInputType detects extended answers', () => {
    expect(resolveInputType('Запись хода решения')).toBe('extended_answer')
    expect(resolveInputType('Краткий ответ')).toBe('short_answer')
  })

  it('migrates starter to medium', () => {
    expect(normalizeDifficultyMode('starter')).toBe('medium')
    expect(normalizeDifficultyMode('basic')).toBe('basic')
  })

  it('converts plan difficulty to stars', () => {
    expect(planDifficultyToStars('basic', 'differentiated', 0, 5)).toBe(1)
    expect(planDifficultyToStars('medium', 'differentiated', 0, 5)).toBe(2)
    expect(planDifficultyToStars('advanced', 'differentiated', 0, 5)).toBe(3)
    expect(planDifficultyToStars(null, 'basic', 0, 5)).toBe(1)
    expect(planDifficultyToStars(null, 'medium', 0, 5)).toBe(2)
  })

  it('planGenerationBrief prefers description', () => {
    const plan: PlanTask = {
      id: '1',
      type: 'input',
      userDescription: 'Решить пример',
      description: 'Текстовая задача на проценты с кратким ответом',
    }
    expect(planGenerationBrief(plan)).toBe('Текстовая задача на проценты с кратким ответом')
  })

  it('normalizes plan item difficulty', () => {
    expect(normalizePlanItemDifficulty('basic')).toBe('basic')
    expect(normalizePlanItemDifficulty('differentiated')).toBeNull()
  })
})
