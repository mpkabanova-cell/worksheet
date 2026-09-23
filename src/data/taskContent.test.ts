import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORDERING_QUESTION,
  DEFAULT_SHORT_ANSWER_QUESTION,
  containsMetaTaskDescription,
  getBlockQuestion,
  looksLikeTheory,
  looksLikeAuthorPlanDescription,
  normalizeAiTask,
  stripLeadingTheoryFromGaps,
  stripMetaTaskDescription,
  stripTheoryFromField,
} from './taskContent'
import type { WorksheetBlock } from './worksheet'

describe('looksLikeTheory', () => {
  it('detects definition-style theory', () => {
    const text =
      'Множество рациональных чисел обозначается буквой Q. Любое целое число можно представить в виде дроби со знаменателем 1.'
    expect(looksLikeTheory(text)).toBe(true)
  })

  it('ignores short option text', () => {
    expect(looksLikeTheory('$\\sqrt{2}$')).toBe(false)
  })
})

describe('stripTheoryFromField', () => {
  it('removes theory paragraph after a short math option', () => {
    const text = `$\\sqrt{2}$

Множество рациональных чисел обозначается буквой Q. Любое целое число можно представить в виде дроби со знаменателем 1.`
    expect(stripTheoryFromField(text)).toBe('$\\sqrt{2}$')
  })

  it('clears purely theoretical text', () => {
    const text =
      'Множество рациональных чисел обозначается буквой Q. Любое целое число можно представить в виде дроби со знаменателем 1.'
    expect(stripTheoryFromField(text)).toBe('')
  })
})

describe('stripLeadingTheoryFromGaps', () => {
  it('removes theory preamble before blanks', () => {
    const text = `Множество рациональных чисел обозначается буквой Q.

Число ___ является целым.`
    expect(stripLeadingTheoryFromGaps(text)).toBe('Число ___ является целым.')
  })
})

describe('stripMetaTaskDescription', () => {
  it('removes plan description lines from question', () => {
    const raw = `Бараш, Крош и Совунья отправились в поход.

Задача на выбор персонажа, который затратил наибольшее время на прохождение пещеры, исходя из предоставленных данных. Требуется выбрать один вариант ответа.`
    expect(stripMetaTaskDescription(raw)).not.toContain('Задача на выбор персонажа')
    expect(stripMetaTaskDescription(raw)).toContain('отправились в поход')
    expect(containsMetaTaskDescription(stripMetaTaskDescription(raw))).toBe(false)
  })
})

describe('looksLikeAuthorPlanDescription', () => {
  it('detects plan-style extended answer description', () => {
    expect(
      looksLikeAuthorPlanDescription(
        'Задача на логику и оптимизацию маршрута, требующая вычисления минимального суммарного времени прохождения пещеры. Ожидается подробное решение с обоснованием.',
      ),
    ).toBe(true)
    expect(
      looksLikeAuthorPlanDescription(
        'Решение задачи на логику и оптимизацию времени прохождения пещеры с учетом ограничений.',
      ),
    ).toBe(true)
    expect(
      looksLikeAuthorPlanDescription(
        'Выбор персонажа с наименьшим индивидуальным временем прохождения пещеры из предложенного списка.',
      ),
    ).toBe(true)
  })

  it('accepts real word problem with numbers', () => {
    expect(
      looksLikeAuthorPlanDescription(
        'Бараш, Крош и Совунья отправились в поход. Совунья пересекла пещеру за 3 минуты, Пин — за 1 минуту. Какое наименьшее суммарное время?',
      ),
    ).toBe(false)
  })
})

describe('normalizeAiTask', () => {
  it('strips theory from choice options during AI normalization', () => {
    const task = normalizeAiTask(
      {
        question: 'Какое число иррационально?',
        options: [
          `$\\sqrt{2}$

Множество рациональных чисел обозначается буквой Q.`,
          '2',
          '0,5',
          '4',
        ],
      },
      'single_choice',
    )

    expect(task.options?.[0]).toBe('$\\sqrt{2}$')
  })

  it('fills empty ordering question from plan expectation', () => {
    const task = normalizeAiTask({ question: '' }, 'ordering', 'Упорядочить шаги решения')
    expect(task.question).toBe('Упорядочьте шаги решения')
  })
})

describe('getBlockQuestion', () => {
  it('returns default when short_answer question is empty', () => {
    const block = {
      type: 'short_answer',
      question: '',
    } as WorksheetBlock
    expect(getBlockQuestion(block)).toBe(DEFAULT_SHORT_ANSWER_QUESTION)
  })

  it('returns default when ordering question is placeholder', () => {
    const block = {
      type: 'ordering',
      question: 'Введите текст',
      orderItems: ['a', 'b'],
    } as WorksheetBlock
    expect(getBlockQuestion(block)).toBe(DEFAULT_ORDERING_QUESTION)
  })

  it('returns default when theory stripped question becomes empty', () => {
    const block = {
      type: 'short_answer',
      question:
        'Множество рациональных чисел обозначается буквой Q. Любое целое число можно представить в виде дроби со знаменателем 1.',
    } as WorksheetBlock
    expect(getBlockQuestion(block)).toBe(DEFAULT_SHORT_ANSWER_QUESTION)
  })
})
