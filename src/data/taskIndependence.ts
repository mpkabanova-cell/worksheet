import type { AiTaskPayload } from './ai'
import type { TaskType, WorksheetBlock } from './worksheet'
import { looksLikeBareTaskInstruction, normalizeWs } from './taskContent'
import { planExpectsStoryContext, looksLikeReferenceDump } from './referenceEnrich'

const CROSS_REF_PATTERNS = [
  /предыдущ/i,
  /из задания\s*\d/i,
  /как в задании/i,
  /из условия выше/i,
  /вышеуказан/i,
  /ранее получен/i,
  /используя результат/i,
  /из текста листа/i,
  /reference_file/i,
]

const STORY_MARKERS = [/пещер/i, /персонаж/i, /бараш/i, /лосяш/i, /совун/i]

function taskText(task: AiTaskPayload): string {
  return [task.question, task.gaps_text, task.body].filter(Boolean).join('\n')
}

function countStoryOverlap(texts: string[]): number {
  return texts.filter((text) => STORY_MARKERS.some((re) => re.test(text))).length
}

function countTimeMentions(text: string): number {
  return text.match(/\d+\s*минут/g)?.length ?? 0
}

export function questionMatchesExpectation(question: string, expectation?: string): boolean {
  const q = normalizeWs(question).toLowerCase()
  const e = normalizeWs(expectation || '').toLowerCase()
  if (!e || q.length < 15) return false
  if (q === e) return true
  const qCore = q.replace(
    /^(определите|выберите|сопоставьте|объясните|упорядочьте|запишите|найдите|заполните)\s*,?\s*/i,
    '',
  )
  const eCore = e.replace(
    /^(определить|выбрать|сопоставить|объяснить|упорядочить|записать|найти|заполнить)\s*,?\s*/i,
    '',
  )
  return qCore === eCore || q.includes(eCore) || eCore.includes(q)
}

function choiceOptionsText(task: AiTaskPayload): string {
  return (task.options ?? []).join('\n')
}

function hasCaveData(text: string): boolean {
  return countTimeMentions(text) >= 3
}

function hasCaveStoryContext(text: string): boolean {
  return /пещер/i.test(text) && /бараш|крош|совун|ежик|пин|лосяш|фонар|поход|смешар|путешеств/i.test(text)
}

function needsCaveContext(question: string): boolean {
  return /пещер|персонаж/i.test(question) && /время|минут|быстр|медлен|дольше|меньше/i.test(question)
}

/** Проблемы формулировки одного задания (без номера). */
export function taskQuestionIssues(
  task: AiTaskPayload,
  planExpectation?: string,
): string[] {
  const issues: string[] = []
  const question = (task.question || '').trim()
  const text = taskText(task)
  const type = task.type as TaskType | undefined

  for (const pattern of CROSS_REF_PATTERNS) {
    if (pattern.test(text)) {
      issues.push('отсылка к другим заданиям, reference_file или тексту листа')
      break
    }
  }

  if (planExpectation && questionMatchesExpectation(question, planExpectation)) {
    issues.push('question повторяет description — нужно полное условие задачи')
  }

  if (planExpectation && planExpectsStoryContext(planExpectation)) {
    const combined = `${question}\n${choiceOptionsText(task)}`
    if (!hasCaveData(combined) && question.length < 100) {
      issues.push('question не содержит данных из source_content (персонажи, время, условия)')
    }
  }

  if (looksLikeBareTaskInstruction(question)) {
    issues.push('question — только инструкция, без данных задачи')
  }

  if (/reference_file|source_content|teacher_expectation|description|не копируй/i.test(question)) {
    issues.push('question содержит служебные инструкции вместо условия задачи')
  }

  if (looksLikeReferenceDump(question)) {
    issues.push('question содержит слишком большой фрагмент source_content — нужно краткое условие одной задачи')
  }

  if (type === 'fill_gaps') {
    const gaps = (task.gaps_text || '').trim()
    if (!gaps.includes('___')) {
      issues.push('fill_gaps без gaps_text с пропусками ___')
    }
    const combined = `${question}\n${gaps}`
    const aboutCave =
      /пещер|пропуск/i.test(planExpectation || '') ||
      /пещер/i.test(question) ||
      /пещер/i.test(gaps)
    if (aboutCave && !hasCaveStoryContext(combined)) {
      issues.push('fill_gaps про пещеру без полного сюжета в question или gaps_text')
    }
  } else if (type === 'ordering') {
    if (question.length < 80 || (!/\d/.test(question) && !/«.+»/.test(question))) {
      issues.push('ordering без полного условия задачи в question')
    }
  } else if (type === 'matching') {
    const combined = `${question}\n${(task.left_items ?? []).join('\n')}\n${(task.right_items ?? []).join('\n')}`
    if (looksLikeReferenceDump(question)) {
      issues.push('matching: question не должен содержать весь reference_file — только краткую инструкцию')
    }
    if (needsCaveContext(question) && !hasCaveData(combined)) {
      issues.push('matching про пещеру/персонажей без времени в question или столбцах')
    }
    if (question.length < 40 && !task.left_items?.length) {
      issues.push('matching без понятного question')
    }
  } else if (type === 'single_choice' || type === 'multiple_choice') {
    const combined = `${question}\n${choiceOptionsText(task)}`
    if (needsCaveContext(question) && !hasCaveData(combined)) {
      issues.push('выбор ответа про пещеру/персонажей без времени в question или options')
    }
    if (question.length < 50 && looksLikeBareTaskInstruction(question)) {
      issues.push('question слишком короткий для выбора ответа')
    }
  } else {
    const hasNumbers = /\d/.test(question)
    const minLen = hasNumbers ? 70 : 120
    if (question.length < minLen) {
      issues.push('question слишком короткое — нет полного условия с данными')
    }
  }

  if (needsCaveContext(question) && !hasCaveData(`${question}\n${choiceOptionsText(task)}`)) {
    issues.push('про пещеру/персонажей, но нет полного набора времён в question')
  }

  if (/кажд(ого|ому) персонаж/i.test(question) && !/\d+\s*минут/i.test(question)) {
    issues.push('просит время персонажей, но не перечисляет данные в question')
  }

  return [...new Set(issues)]
}

export function blockQuestionIssues(
  block: WorksheetBlock,
  planExpectation?: string,
): string[] {
  return taskQuestionIssues(
    {
      type: block.type,
      question: block.question,
      gaps_text: block.gapsText || block.gapsSourceText,
      options: block.options?.map((o) => o.text),
      left_items: block.leftItems?.map((i) => i.text),
      right_items: block.rightItems?.map((i) => i.text),
    },
    planExpectation,
  )
}

export function validatePlanIndependence(
  tasks: { expectation?: string }[],
): string[] {
  const texts = tasks.map((t) => t.expectation?.trim() || '')
  const issues: string[] = []

  const storyHits = countStoryOverlap(texts)
  const pipelineHints = texts.filter((t) =>
    /упорядоч|записать время|записать.*время|стратег|оптимальн|первой пар|пропуск/i.test(t),
  ).length

  if (storyHits >= 3) {
    issues.push(
      'План дробит одну задачу про пещеру/персонажей на несколько пунктов — распредели разные фрагменты source_content',
    )
  }

  if (storyHits >= 2 && texts.length >= 3) {
    issues.push(
      'Несколько пунктов плана повторяют один сюжет (пещера/персонажи) — каждый пункт должен опираться на свой фрагмент файла',
    )
  }

  if (pipelineHints >= 3 || (pipelineHints >= 2 && storyHits >= 2)) {
    issues.push(
      'План выглядит как этапы одной задачи (найти → упорядочить → объяснить), а не независимые задания по разным фрагментам файла',
    )
  }

  return issues
}

export function validateTaskIndependence(
  tasks: AiTaskPayload[],
  planExpectations?: string[],
): string[] {
  const issues: string[] = []
  const allTexts = tasks.map(taskText)

  if (countStoryOverlap(allTexts) >= 3) {
    issues.push(
      'Несколько заданий дробят одну задачу — сделай каждое задание отдельной полной задачей по своему фрагменту source_content',
    )
  }

  tasks.forEach((task, i) => {
    const n = i + 1
    for (const issue of taskQuestionIssues(task, planExpectations?.[i])) {
      issues.push(`Задание ${n}: ${issue}`)
    }
  })

  return [...new Set(issues)]
}

export function repairTaskExpectation(baseDescription: string): string {
  return [
    'Исправь задание: в question — полное условие из source_content (сюжет, все персонажи, числа, ограничения) и только потом вопрос.',
    'Альтернатива должна быть сюжетно близка к anchor_tasks и source_content, но самостоятельной.',
    'Не копируй description и не пиши только «Определите…» / «Выберите…».',
    'Не включай в question служебные фразы про source_content, description или эту инструкцию.',
    baseDescription.trim() ? `Исходная установка (description): ${baseDescription.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function independenceRetryNote(issues: string[]): string {
  return [
    '',
    'КРИТИЧЕСКИЕ нарушения самостоятельности заданий — исправь и верни JSON заново:',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'Каждое question — готовое условие для ученика: сюжет + все данные + вопрос в одном поле.',
    'description — только для автора; в question его нельзя копировать.',
    'Разные задания — разные фрагменты source_content; ответ одного не нужен для другого.',
    'Не дроби одну задачу из source_content на несколько заданий листа.',
  ].join('\n')
}
