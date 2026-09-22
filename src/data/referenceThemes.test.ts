import { describe, expect, it } from 'vitest'
import {
  buildAlternativeTaskGuidance,
  collectAnchorTasks,
  detectThemesInText,
  extractDeliveryCondition,
  extractLogicTownCondition,
  pickReplacementTheme,
} from './referenceThemes'
import type { WorksheetBlock } from './worksheet'

const CAVE_BLOCK: WorksheetBlock = {
  id: 't1',
  type: 'short_answer',
  page: 0,
  title: 'Задание 1',
  difficulty: 2,
  instruction: '',
  question:
    'Совунья пересекла пещеру за 3 минуты. Пин затратил 1 минуту. Крош затратил 2 минуты. Ежик вышел из пещеры через 3 минуты. Лосяша не могли дождаться 5 минут. Кто затратил наибольшее время?',
  correctAnswers: ['Лосяш'],
  answerAreaStyle: 'block',
  answerLines: 10,
}

describe('referenceThemes', () => {
  it('detects themes in text', () => {
    expect(detectThemesInText('задача про пещеру и Бараша')).toContain('cave')
    expect(detectThemesInText('Правдинск и Лжеград')).toContain('logic-towns')
    expect(detectThemesInText('Молочный комбинат доставка')).toContain('delivery')
  })

  it('collects valid blocks as anchors', () => {
    const anchors = collectAnchorTasks(
      [CAVE_BLOCK],
      ['Определить время прохождения пещеры'],
    )
    expect(anchors).toHaveLength(1)
    expect(anchors[0].themes).toContain('cave')
  })

  it('builds alternative guidance from anchors', () => {
    const guidance = buildAlternativeTaskGuidance(
      collectAnchorTasks([CAVE_BLOCK], ['Определить время прохождения пещеры']),
      'Бараш и Совунья в пещере',
      'Выбрать персонажей с одинаковым временем',
    )
    expect(guidance).toContain('сюжетно')
    expect(guidance).toContain('пещер')
  })

  it('picks replacement theme from anchors first', () => {
    const theme = pickReplacementTheme(
      'Заполнить пропуски',
      'Молочный комбинат',
      collectAnchorTasks([CAVE_BLOCK], ['пещера']),
    )
    expect(theme).toBe('cave')
  })

  it('extracts logic and delivery snippets', () => {
    const logic = extractLogicTownCondition(
      'В городе Правдинске жители всегда говорят правду. Прокурор: «Если Джон ограбил магазин, то он действовал не один». Судья: «это ложь».\n\nРешение:\nответ',
    )
    expect(logic).toContain('Правдинск')
    expect(logic).not.toContain('Решение')

    const delivery = extractDeliveryCondition(`
Молочный комбинат доставляет продукцию.
Молочный комбинат – «Продуктовая лавка» - 10 минут
«Мираж» - «Фабрика качества» - 15 минут
«Миндаль» - «Фабрика качества» - 25 минут
`)
    expect(delivery).toContain('10 минут')
    expect(delivery).toContain('15 минут')
  })
})
