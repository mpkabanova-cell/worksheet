import { describe, expect, it } from 'vitest'
import {
  looksLikeTheory,
  normalizeAiTask,
  stripLeadingTheoryFromGaps,
  stripTheoryFromField,
} from './taskContent'

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
})
