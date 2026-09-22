import type { AiTaskPayload } from './ai'

const CROSS_REF_PATTERNS = [
  /предыдущ/i,
  /из задания\s*\d/i,
  /как в задании/i,
  /из условия выше/i,
  /вышеуказан/i,
  /ранее получен/i,
  /используя результат/i,
  /из текста листа/i,
]

const STORY_MARKERS = [/пещер/i, /персонаж/i, /бараш/i, /лосяш/i, /совун/i]

function taskText(task: AiTaskPayload): string {
  return [task.question, task.gaps_text, task.body].filter(Boolean).join('\n')
}

function countStoryOverlap(texts: string[]): number {
  return texts.filter((text) => STORY_MARKERS.some((re) => re.test(text))).length
}

export function validatePlanIndependence(
  tasks: { expectation?: string }[],
): string[] {
  const texts = tasks.map((t) => t.expectation?.trim() || '')
  const issues: string[] = []

  const storyHits = countStoryOverlap(texts)
  if (storyHits >= 2) {
    issues.push(
      'План повторяет один сюжет (пещера/персонажи) в нескольких заданиях — нужны разные самостоятельные задачи',
    )
  }

  const pipelineHints = texts.filter((t) =>
    /упорядоч|записать время|записать.*время|стратег|оптимальн|первой пар/i.test(t),
  ).length
  if (pipelineHints >= 2) {
    issues.push(
      'План выглядит как этапы одной задачи (найти → упорядочить → объяснить), а не независимые задания',
    )
  } else if (pipelineHints >= 1 && storyHits >= 1) {
    issues.push(
      'План выглядит как этапы одной задачи (найти → упорядочить → объяснить), а не независимые задания',
    )
  }

  return issues
}

export function validateTaskIndependence(tasks: AiTaskPayload[]): string[] {
  const issues: string[] = []
  const allTexts = tasks.map(taskText)

  if (countStoryOverlap(allTexts) >= 2) {
    issues.push(
      'Несколько заданий про один и тот же сюжет — дробление одной задачи; сделай каждое задание отдельной полной задачей или разными сюжетами',
    )
  }

  tasks.forEach((task, i) => {
    const n = i + 1
    const text = taskText(task)
    const question = (task.question || '').trim()

    for (const pattern of CROSS_REF_PATTERNS) {
      if (pattern.test(text)) {
        issues.push(`Задание ${n}: отсылка к другим заданиям или тексту листа`)
        break
      }
    }

    if (task.type === 'fill_gaps') {
      const gaps = (task.gaps_text || '').trim()
      if (!gaps.includes('___')) {
        issues.push(`Задание ${n}: fill_gaps без gaps_text с пропусками ___`)
      }
    } else if (task.type === 'ordering') {
      if (question.length < 80 || (!/\d/.test(question) && !/«.+»/.test(question))) {
        issues.push(`Задание ${n}: ordering без полного условия задачи в question`)
      }
      if (/пещер/i.test(question) && (question.match(/\d+\s*минут/g)?.length ?? 0) < 3) {
        issues.push(`Задание ${n}: про пещеру без полного набора данных в question`)
      }
    } else {
      const hasNumbers = /\d/.test(question)
      const minLen = hasNumbers ? 70 : 120
      if (question.length < minLen && !['single_choice', 'multiple_choice'].includes(task.type)) {
        issues.push(`Задание ${n}: question слишком короткое — нет полного условия с данными`)
      }
    }

    if (/пещер|персонаж/i.test(question)) {
      const timeMentions = question.match(/\d+\s*минут/g)?.length ?? 0
      if (timeMentions < 3 && /время|минут/i.test(question)) {
        issues.push(`Задание ${n}: про пещеру/персонажей, но в question нет полного набора данных (времена, ограничения)`)
      }
    }

    if (/кажд(ого|ому) персонаж/i.test(question) && !/\d+\s*минут/i.test(question)) {
      issues.push(`Задание ${n}: просит время персонажей, но не перечисляет данные в question`)
    }

    if (/упорядоч/i.test(question) && question.length < 80 && !/«.+»/.test(question)) {
      issues.push(`Задание ${n}: ordering без полного условия задачи в question`)
    }
  })

  return [...new Set(issues)]
}

export function independenceRetryNote(issues: string[]): string {
  return [
    '',
    'КРИТИЧЕСКИЕ нарушения самостоятельности заданий — исправь и верни JSON заново:',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'Каждое задание: полное условие в question (все числа и ограничения).',
    'Разные задания — разные задачи; ответ одного не нужен для другого.',
    'Не дроби одну задачу из reference_file на несколько заданий листа.',
  ].join('\n')
}
