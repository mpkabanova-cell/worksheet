import type { AiTaskPayload } from './ai'
import type { TaskType, WorksheetBlock } from './worksheet'
import { looksLikeBareTaskInstruction, normalizeWs, containsMetaTaskDescription, looksLikeAuthorPlanDescription, isGenericTopicFillGaps } from './taskContent'
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

const TOPIC_SIGNATURES: { id: string; patterns: RegExp[] }[] = [
  {
    id: 'cave',
    patterns: [/пещер/i, /бараш/i, /крош/i, /совун/i, /лосяш/i, /пин/i, /наименьш.*время/i],
  },
  {
    id: 'logic_cities',
    patterns: [/правдинск/i, /лжеград/i, /ограблен/i, /суд/i, /прокурор/i],
  },
  {
    id: 'milk_routes',
    patterns: [/молок/i, /комбинат/i, /торгов/i, /разгруз/i, /маршрут/i],
  },
  { id: 'shop', patterns: [/магазин/i, /яблок/i, /стоим/i, /рубл/i] },
]

function taskText(task: AiTaskPayload): string {
  return [task.question, task.gaps_text, task.body].filter(Boolean).join('\n')
}

function countStoryOverlap(texts: string[]): number {
  return texts.filter((text) => STORY_MARKERS.some((re) => re.test(text))).length
}

function dominantTopic(text: string): string | null {
  for (const { id, patterns } of TOPIC_SIGNATURES) {
    if (patterns.some((pattern) => pattern.test(text))) return id
  }
  return null
}

function maxTopicCount(texts: string[]): number {
  const counts = new Map<string, number>()
  for (const text of texts) {
    const topic = dominantTopic(text)
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1)
  }
  return Math.max(0, ...counts.values())
}

function isPipelineStep(text: string): boolean {
  return /упорядоч|записать время|записать.*время|стратег|оптимальн|первой пар|пропуск/i.test(
    text,
  )
}

function isCavePipelineStep(text: string): boolean {
  return (
    /пещер|персонаж/i.test(text) &&
    /упорядоч|записать|стратег|оптимальн|пропуск|минимальн|наименьш|время/i.test(text)
  )
}

function countTimeMentions(text: string): number {
  return text.match(/\d+\s*минут/g)?.length ?? 0
}

function countGapMinuteBlankCount(gaps: string): number {
  const lines = gaps.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.filter((line) => /___/.test(line) && /минут/i.test(line)).length
}

function taskHasSelfContainedCaveData(task: AiTaskPayload): boolean {
  const question = (task.question || '').trim()
  const gaps = (task.gaps_text || '').trim()
  const options = choiceOptionsText(task)
  const questionTimes = countTimeMentions(question)
  const optionTimes = countTimeMentions(options)

  if (questionTimes >= 3) return true
  if (questionTimes + optionTimes >= 3) return true

  if (task.type === 'fill_gaps' && countGapMinuteBlankCount(gaps) > 0) {
    return questionTimes >= countGapMinuteBlankCount(gaps)
  }

  return countTimeMentions(`${question}\n${gaps}\n${options}`) >= 3
}

export function questionMatchesExpectation(question: string, expectation?: string): boolean {
  const q = normalizeWs(question).toLowerCase()
  const e = normalizeWs(expectation || '').toLowerCase()
  if (!e || q.length < 15) return false
  if (q === e) return true
  if (e.length >= 35 && q.includes(e.slice(0, Math.min(80, e.length)).toLowerCase())) return true
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

/** Для fill_gaps: сюжет должен быть в question, а не только имена в gaps_text. */
export function hasCaveNarrativeInQuestion(question: string): boolean {
  const q = question.trim()
  if (!q || !/пещер/i.test(q)) return false
  if (/поход|фонар|наименьшее\s+суммарное|проходной|путешеств|не\s+больше\s+двух|мышин/i.test(q)) {
    return true
  }
  return q.length >= 180 && /бараш|крош|совун|ежик|пин|лосяш/i.test(q)
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

  if (containsMetaTaskDescription(question)) {
    issues.push('question содержит служебную формулировку description (например «Задача на выбор персонажа»)')
  }

  if (looksLikeAuthorPlanDescription(question)) {
    issues.push('question — описание задания для автора, а не условие с данными для ученика')
  }

  if (planExpectation && looksLikeAuthorPlanDescription(planExpectation) && questionMatchesExpectation(question, planExpectation)) {
    issues.push('question скопирован из description плана — нужен текст условия задачи из source_content')
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
    if (isGenericTopicFillGaps(gaps, task.gaps_answers)) {
      issues.push('fill_gaps использует шаблон «правило/пример по теме», а не условие из source_content')
    }
    if (
      planExpectation &&
      /\d|менедж|время|числ|расч[её]т/i.test(planExpectation) &&
      isGenericTopicFillGaps(gaps, task.gaps_answers)
    ) {
      issues.push('fill_gaps не соответствует description — нужны числовые данные из файла, а не общий шаблон')
    }
    const gapMinuteBlanks = countGapMinuteBlankCount(gaps)
    if (gapMinuteBlanks > 0 && countTimeMentions(question) < gapMinuteBlanks) {
      issues.push('fill_gaps: в question нет числовых данных для пропусков с минутами — задание не самостоятельное')
    }
    const aboutCave =
      /пещер|пропуск/i.test(planExpectation || '') ||
      /пещер/i.test(question) ||
      /пещер/i.test(gaps)
    if (aboutCave && !hasCaveNarrativeInQuestion(question)) {
      issues.push('fill_gaps про пещеру без полного сюжета в question')
    }
    if (aboutCave && !taskHasSelfContainedCaveData(task)) {
      issues.push('fill_gaps про пещеру без полного набора времён в question — нельзя опираться на другие задания')
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
    if (needsCaveContext(question) && !taskHasSelfContainedCaveData(task)) {
      issues.push('выбор ответа про пещеру без полного набора времён — задание не самостоятельное')
    }
    if (question.length < 50 && looksLikeBareTaskInstruction(question)) {
      issues.push('question слишком короткий для выбора ответа')
    }
  } else if (type === 'grouping') {
    if (containsMetaTaskDescription(question)) {
      issues.push('grouping: question содержит description вместо условия для ученика')
    }
    if (needsCaveContext(question) && !taskHasSelfContainedCaveData(task)) {
      issues.push('grouping про пещеру без полного набора времён — задание не самостоятельное')
    }
    if (question.length < 80 && looksLikeBareTaskInstruction(question)) {
      issues.push('grouping без полного условия задачи в question')
    }
  } else {
    const hasNumbers = /\d/.test(question)
    const minLen = hasNumbers ? 70 : 120
    if (looksLikeAuthorPlanDescription(question)) {
      issues.push('question — описание задания, а не условие с данными')
    } else if (question.length < minLen) {
      issues.push('question слишком короткое — нет полного условия с данными')
    }
  }

  if (needsCaveContext(question) && !taskHasSelfContainedCaveData(task)) {
    issues.push('про пещеру/персонажей, но нет полного набора времён в этом задании')
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
  const texts = tasks.map((t) => t.expectation?.trim() || '').filter(Boolean)
  const issues: string[] = []

  const cavePipeline = texts.filter(isCavePipelineStep)
  const pipelineTexts = texts.filter(isPipelineStep)

  if (cavePipeline.length >= 3) {
    issues.push(
      'План дробит одну задачу про пещеру/персонажей на несколько пунктов — распредели разные фрагменты source_content',
    )
  }

  if (
    (maxTopicCount(texts) >= 3 && maxTopicCount(pipelineTexts) >= 2) ||
    (cavePipeline.length >= 2 && texts.length >= 3 && maxTopicCount(cavePipeline) >= 2)
  ) {
    issues.push(
      'Несколько пунктов плана повторяют один сюжет (пещера/персонажи) — каждый пункт должен опираться на свой фрагмент файла',
    )
  }

  if (
    (pipelineTexts.length >= 3 && maxTopicCount(pipelineTexts) >= 3) ||
    (pipelineTexts.length >= 2 && cavePipeline.length >= 2)
  ) {
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

  const caveTasksMissingData = tasks.filter(
    (task) => /пещер/i.test(taskText(task)) && !taskHasSelfContainedCaveData(task),
  )
  if (caveTasksMissingData.length >= 2) {
    issues.push(
      'Несколько заданий про пещеру без полных данных в каждом question — ученик не может решать их независимо',
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
    'Не включай в question служебные фразы: «Задача на выбор персонажа», «исходя из предоставленных данных», «на основе предоставленной информации», source_content, description.',
    'Ученик не видит другие задания листа — все числа и правила должны быть в этом question.',
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

export function planFragmentAssignmentNote(hints: string[], taskCount: number): string {
  const assignment = hints
    .slice(0, taskCount)
    .map((hint, index) => `- Пункт ${index + 1}: ${hint}`)
    .join('\n')

  return [
    '',
    'Распредели пункты плана по разным фрагментам source_content:',
    assignment || '- Используй разные абзацы и задачи из source_content',
    'Не дроби одну задачу на этапы (найти → упорядочить → пропуски).',
  ].join('\n')
}
