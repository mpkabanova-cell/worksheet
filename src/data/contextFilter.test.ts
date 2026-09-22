import { describe, expect, it } from 'vitest'
import {
  inferBlockFromWishes,
  listContextBlockTitles,
  prepareReferenceContent,
  stripIrrelevantSections,
  annotateExtractRelevance,
} from './contextFilter'

const CAVE_SAMPLE = `5-6 классы

Бараш, Крош, Совунья отправились в поход. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если

Совунья пересекла пещеру за 3 минуты,
Пин затратил 1 минуту?

Решение:

[картинка пингвина]

18 минут.

1 минута = 2 минуты

7-8 классы

Другая задача про магазин. Сколько стоят 2 кг яблок?`

describe('contextFilter', () => {
  it('removes solution sections and tails', () => {
    const filtered = stripIrrelevantSections(CAVE_SAMPLE)
    expect(filtered).toContain('Совунья пересекла пещеру за 3 минуты')
    expect(filtered).not.toContain('Решение:')
    expect(filtered).not.toContain('18 минут')
    expect(filtered).not.toContain('[картинка пингвина]')
    expect(filtered).toContain('Другая задача про магазин')
  })

  it('selects block by title and strips its solution', () => {
    const filtered = prepareReferenceContent(CAVE_SAMPLE, { block: '5-6 классы' })
    expect(filtered).toContain('преодоления пещеры')
    expect(filtered).not.toContain('Решение:')
    expect(filtered).not.toContain('7-8 классы')
    expect(filtered).not.toContain('магазин')
  })

  it('lists block titles without solution sections', () => {
    const titles = listContextBlockTitles(CAVE_SAMPLE)
    expect(titles).toContain('5-6 классы')
    expect(titles).toContain('7-8 классы')
    expect(titles.some((t) => /решение/i.test(t))).toBe(false)
    expect(titles.some((t) => /минут\s*=/.test(t))).toBe(false)
  })

  it('infers block from additional_wishes text', () => {
    expect(inferBlockFromWishes('Использовать блок 7-8 классы', CAVE_SAMPLE)).toBe('7-8 классы')
    const filtered = prepareReferenceContent(CAVE_SAMPLE, {
      wishes: 'Задания только из раздела 5-6 классы',
    })
    expect(filtered).toContain('преодоления пещеры')
    expect(filtered).not.toContain('7-8 классы')
  })

  it('annotates relevant and irrelevant lines', () => {
    const annotated = annotateExtractRelevance(CAVE_SAMPLE)
    expect(annotated).toContain('ctx-relevant')
    expect(annotated).toContain('ctx-irrelevant')
    expect(annotated).toContain('Совунья пересекла пещеру')
    expect(annotated).toContain('18 минут')
    expect(annotated).toContain('ctx-irrelevant">Решение:')
  })
})
