import { describe, expect, it } from 'vitest'
import {
  enrichBlockFromReference,
  enrichCaveQuestion,
  extractCaveConditionFromReference,
  extractCaveNarrativeFromReference,
  extractMatchingInstruction,
  looksLikeReferenceDump,
  planExpectsStoryContext,
  trimReferenceDumpFromQuestion,
} from './referenceEnrich'
import type { WorksheetBlock } from './worksheet'

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

7-8 классы

В городе Правдинске жители всегда говорят правду. Кто ограбил магазин?

Менеджер молочного комбината начинает работать в 8.00 утра. Как ему объехать все торговые точки?

Молочный комбинат – «Продуктовая лавка» - 10 минут
`

const DUMP_QUESTION = `${'5-6 классы\n\n'.repeat(1)}Бараш, Крош... пещеру...\n\n7-8 классы\n\nВ городе Правдинске...`.padEnd(1600, ' x')

describe('referenceEnrich', () => {
  it('detects cave-related plan expectations', () => {
    expect(planExpectsStoryContext('Определить время прохождения пещеры')).toBe(true)
    expect(planExpectsStoryContext('Объяснить логическую задачу про Правдинск')).toBe(false)
  })

  it('extracts cave condition without solution and without next grade block', () => {
    const text = extractCaveConditionFromReference(CAVE_REFERENCE)
    expect(text).toContain('Совунья пересекла пещеру за 3 минуты')
    expect(text).toContain('Лосяша не могли дождаться 5 минут')
    expect(text).not.toContain('Решение')
    expect(text).not.toContain('18 минут')
    expect(text).not.toContain('7-8 классы')
    expect(text).not.toContain('Правдинск')
    expect(text).not.toContain('Молочный комбинат')
  })

  it('extracts cave narrative without time lines', () => {
    const narrative = extractCaveNarrativeFromReference(CAVE_REFERENCE)
    expect(narrative).toContain('отправились в поход')
    expect(narrative).not.toContain('3 минуты')
  })

  it('prepends cave narrative to fill_gaps question', () => {
    const block: WorksheetBlock = {
      id: 'g1',
      type: 'fill_gaps',
      page: 0,
      title: 'Задание 4',
      question: 'Заполните пропуски в условии задачи про пещеру.',
      gapsText:
        'Совунья пересекла пещеру за ___ минут, Пин затратил ___ минуту, Крош затратил ___ минуты.',
      gapsAnswers: ['3', '1', '2'],
    }
    const enriched = enrichBlockFromReference(block, CAVE_REFERENCE, 'Заполнить пропуски в задаче про пещеру')
    expect(enriched.question).toContain('отправились в поход')
    expect(enriched.question).toContain('3 минут')
    expect(enriched.question).toContain('Заполните пропуски')
    expect(enriched.question).not.toContain('Задача на выбор персонажа')
  })

  it('prepends cave data to bare question', () => {
    const question = enrichCaveQuestion(
      'Кто из персонажей затратил наибольшее время на прохождение пещеры?',
      CAVE_REFERENCE,
    )
    expect(question).toContain('Совунья пересекла пещеру за 3 минуты')
    expect(question).toContain('наибольшее время')
    expect(question).not.toContain('7-8 классы')
  })

  it('detects reference dumps in question', () => {
    expect(looksLikeReferenceDump(DUMP_QUESTION)).toBe(true)
  })

  it('trims matching question to instruction line', () => {
    const dump = `${DUMP_QUESTION}\n\nСопоставьте персонажей с временем прохождения пещеры.`
    expect(extractMatchingInstruction(dump)).toContain('Сопоставьте персонажей')
    expect(trimReferenceDumpFromQuestion(dump, 'matching').length).toBeLessThan(500)
  })

  it('does not prepend full reference to matching with populated columns', () => {
    const block: WorksheetBlock = {
      id: 'm1',
      type: 'matching',
      page: 0,
      title: 'Задание 5',
      issued: false,
      question: DUMP_QUESTION + '\nСопоставьте персонажей с временем прохождения пещеры.',
      leftItems: [
        { id: 'l1', text: 'Совунья' },
        { id: 'l2', text: 'Пин' },
      ],
      rightItems: [
        { id: 'r1', text: '3 минуты' },
        { id: 'r2', text: '1 минута' },
      ],
      matchingPairCount: 2,
      correctAnswers: ['l1 → r1', 'l2 → r2'],
    }

    const enriched = enrichBlockFromReference(block, CAVE_REFERENCE, 'Сопоставить персонажей с временем')
    expect(enriched.question).toContain('Сопоставьте персонажей')
    expect(enriched.question).not.toContain('7-8 классы')
    expect(enriched.question!.length).toBeLessThan(500)
  })

  it('enriches extended_answer description with full cave condition from reference', () => {
    const block: WorksheetBlock = {
      id: 'e1',
      type: 'extended_answer',
      page: 0,
      title: 'Задание 1',
      issued: false,
      question:
        'Решение задачи на логику и оптимизацию времени прохождения пещеры с учетом ограничений и индивидуальных скоростей персонажей, с записью полного хода решения и итогового ответа.',
      answerLines: 8,
    }

    const enriched = enrichBlockFromReference(
      block,
      CAVE_REFERENCE,
      'Определить минимальное суммарное время прохождения пещеры',
    )
    expect(enriched.question).toContain('Бараш')
    expect(enriched.question).toContain('3 минут')
    expect(enriched.question).not.toContain('Решение задачи на логику')
  })
})
