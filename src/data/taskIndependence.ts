import type { AiTaskPayload } from './ai'
import { gapsTextHasBlankMarkers } from './mathTextUtils'
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
  { id: 'shop', patterns: [/магазин/i, /яблок/i, /стоим/i] },
]

/** Темы, по которым проверяем «один сюжет на весь лист» (не обычные задачи с рублями). */
const PIPELINE_STORY_TOPIC_IDS = new Set(['cave', 'logic_cities', 'milk_routes'])

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

function maxTopicCountForPipeline(texts: string[]): number {
  const counts = new Map<string, number>()
  for (const text of texts) {
    const topic = dominantTopic(text)
    if (topic && PIPELINE_STORY_TOPIC_IDS.has(topic)) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
  }
  return Math.max(0, ...counts.values())
}

function isPipelineStep(text: string): boolean {
  return /упорядоч|записать время|записать.*время|стратег|оптимальн|первой пар|пропуск|выбор персонажа|наименьш.*индивиду|наибольш.*индивиду|сопостав.*время|восстановлен.*данн|полный ход решения/i.test(
    text,
  )
}

function isCavePipelineStep(text: string): boolean {
  return (
    /пещер|персонаж/i.test(text) &&
    /упорядоч|записать|стратег|оптимальн|пропуск|минимальн|наименьш|наибольш|время|выбор|сопостав|восстановлен/i.test(
      text,
    )
  )
}

const PIPELINE_STAGE_PATTERNS: { id: string; re: RegExp }[] = [
  { id: 'optimize', re: /оптимизац|наименьш.*суммар|минимальн.*суммар|полный ход решения/i },
  { id: 'min_choice', re: /наименьш.*(?:индивиду|время)|минимальн.*индивиду|быстрее всех/i },
  { id: 'max_choice', re: /наибольш.*(?:индивиду|время)|максимальн.*индивиду|дольше всех/i },
  { id: 'fill_data', re: /пропуск|восстановлен.*данн|заполните пропуски в данных/i },
  { id: 'match_times', re: /сопостав.*(?:время|персонаж)/i },
]

function detectPipelineStages(texts: string[]): Set<string> {
  const stages = new Set<string>()
  for (const text of texts) {
    for (const { id, re } of PIPELINE_STAGE_PATTERNS) {
      if (re.test(text)) stages.add(id)
    }
  }
  return stages
}

function isMinMaxChoiceWithoutData(task: AiTaskPayload): boolean {
  const question = (task.question || '').trim()
  if (task.type !== 'single_choice' && task.type !== 'multiple_choice') return false
  if (!/наименьш|наибольш|минимальн|максимальн|быстрее|дольше/i.test(question)) return false
  if (looksLikeAuthorPlanDescription(question)) return true
  const combined = `${question}\n${choiceOptionsText(task)}`
  return countTimeMentions(combined) < 2 && !/\d+\s*минут/i.test(question)
}

function matchingHasDuplicateRightItems(task: AiTaskPayload): boolean {
  if (task.type !== 'matching') return false
  const rights = (task.right_items ?? []).map((item) => normalizeWs(item).toLowerCase()).filter(Boolean)
  return rights.length > 1 && new Set(rights).size < rights.length
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

  if (
    planExpectation &&
    questionMatchesExpectation(question, planExpectation) &&
    question.length < 90 &&
    !/\d/.test(question)
  ) {
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
    const answers = (task.gaps_answers ?? []).map((a) => a.trim()).filter(Boolean)
    const hasBlanks = gapsTextHasBlankMarkers(gaps)
    const substantiveText = gaps.length >= 12
    if (!hasBlanks && answers.length === 0) {
      issues.push('fill_gaps без gaps_text с пропусками ___')
    } else if (!hasBlanks && answers.length > 0 && !substantiveText) {
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
      const opts = choiceOptionsText(task)
      const hasDataInTask = /\d/.test(combined) || /\$|\\frac/.test(combined) || opts.trim().length >= 30
      if (!hasDataInTask) {
        issues.push('question слишком короткий для выбора ответа')
      }
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
    const hasMath = /\$|\\frac/.test(question)
    const minLen = hasNumbers || hasMath ? 45 : 90
    if (looksLikeAuthorPlanDescription(question)) {
      issues.push('question — описание задания, а не условие с данными')
    } else if (question.length < minLen && looksLikeBareTaskInstruction(question)) {
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

/** Проверяет, хватает ли данных внутри одного задания для ответа. */
export function taskSelfSufficiencyIssues(
  task: AiTaskPayload,
  planExpectation?: string,
): string[] {
  const issues: string[] = [...taskQuestionIssues(task, planExpectation)]
  const question = (task.question || '').trim()
  const type = task.type as TaskType | undefined

  if (isMinMaxChoiceWithoutData(task)) {
    issues.push(
      'выбор min/max без перечисления времён в question — ученик не может решить задание изолированно',
    )
  }

  if (type === 'matching' && matchingHasDuplicateRightItems(task)) {
    issues.push('matching: дубли в правом столбце без полного условия — задание неоднозначно')
  }

  if (
    (type === 'extended_answer' || type === 'short_answer') &&
    (looksLikeAuthorPlanDescription(question) ||
      (/пещер|оптимизац/i.test(question) && !hasCaveNarrativeInQuestion(question) && countTimeMentions(question) < 2))
  ) {
    issues.push('question не содержит полного условия задачи — нужны сюжет, ограничения и данные')
  }

  if (type === 'fill_gaps') {
    const gaps = (task.gaps_text || '').trim()
    const combined = `${question}\n${gaps}`
    if (/пещер|персонаж/i.test(combined) && !hasCaveNarrativeInQuestion(question) && !gapsTextHasBlankMarkers(gaps)) {
      issues.push('fill_gaps: данные без пропусков и без сюжета в question — не самодостаточное задание')
    }
  }

  return [...new Set(issues)]
}

/** Самодостаточность всех заданий листа. */
export function validateTaskSelfSufficiency(
  tasks: AiTaskPayload[],
  planExpectations?: string[],
): string[] {
  const issues: string[] = []
  tasks.forEach((task, i) => {
    for (const issue of taskSelfSufficiencyIssues(task, planExpectations?.[i])) {
      issues.push(`Задание ${i + 1}: ${issue}`)
    }
  })
  return [...new Set(issues)]
}

/** Запрет pipeline: одна задача из файла разбита на этапы листа. */
export function validateWorksheetPipeline(
  tasks: AiTaskPayload[],
  planExpectations?: string[],
): string[] {
  const issues: string[] = []
  const texts = tasks.map((task, i) => `${taskText(task)}\n${planExpectations?.[i] || ''}`.trim())

  const caveTexts = texts.filter((text) => dominantTopic(text) === 'cave')
  if (caveTexts.length >= 3) {
    const stages = detectPipelineStages(caveTexts)
    if (stages.size >= 3) {
      issues.push(
        'Лист дробит одну задачу про пещеру на этапы (оптимизация / min-max / пропуски / сопоставление) — каждое задание должно быть полной задачей',
      )
    }
  }

  if (maxTopicCountForPipeline(texts) >= 3 && texts.length >= 4) {
    issues.push(
      'Несколько заданий повторяют один сюжет — распредели разные фрагменты source_content, не более одной задачи про пещеру без явного пожелания',
    )
  }

  const pipelineTexts = texts.filter(isPipelineStep)
  const pipelineStoryTexts = pipelineTexts.filter((text) => {
    const topic = dominantTopic(text)
    return topic != null && PIPELINE_STORY_TOPIC_IDS.has(topic)
  })
  if (pipelineStoryTexts.length >= 3 && maxTopicCountForPipeline(pipelineStoryTexts) >= 3) {
    issues.push(
      'Лист выглядит как этапы одной задачи (найти → выбрать → заполнить → сопоставить), а не независимые задания',
    )
  }

  return issues
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
    (maxTopicCountForPipeline(texts) >= 3 && maxTopicCountForPipeline(pipelineTexts) >= 2) ||
    (cavePipeline.length >= 2 && texts.length >= 3 && maxTopicCountForPipeline(cavePipeline) >= 2)
  ) {
    issues.push(
      'Несколько пунктов плана повторяют один сюжет (пещера/персонажи) — каждый пункт должен опираться на свой фрагмент файла',
    )
  }

  if (
    (pipelineTexts.length >= 3 && maxTopicCountForPipeline(pipelineTexts) >= 3) ||
    (pipelineTexts.length >= 2 && cavePipeline.length >= 2)
  ) {
    issues.push(
      'План выглядит как этапы одной задачи (найти → упорядочить → объяснить), а не независимые задания по разным фрагментам файла',
    )
  }

  const caveTexts = texts.filter((text) => dominantTopic(text) === 'cave')
  if (caveTexts.length >= 3 && detectPipelineStages(caveTexts).size >= 3) {
    issues.push(
      'План дробит задачу про пещеру на этапы (оптимизация / min-max / пропуски / сопоставление)',
    )
  }

  return issues
}

export function validateTaskIndependence(
  tasks: AiTaskPayload[],
  planExpectations?: string[],
): string[] {
  const issues: string[] = [
    ...validateWorksheetPipeline(tasks, planExpectations),
  ]
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
    for (const issue of taskSelfSufficiencyIssues(task, planExpectations?.[i])) {
      issues.push(`Задание ${n}: ${issue}`)
    }
  })

  return [...new Set(issues)]
}

/** Нарушения, при которых лист нельзя отдавать ученику (остальные — предупреждения). */
export function blockingSelfSufficiencyIssues(issues: string[]): string[] {
  return issues.filter((issue) => {
    if (/отсылка к другим|reference_file|из задания\s*\d|как в задании|из условия выше|из текста листа/i.test(issue)) {
      return true
    }
    if (/дробит одну задачу|этапы одной задачи|выглядит как этапы/i.test(issue)) {
      return true
    }
    if (/служебн|задача на выбор персонажа|question содержит description/i.test(issue)) {
      return true
    }
    if (/fill_gaps без gaps_text|шаблон «правило/i.test(issue)) {
      return true
    }
    if (/question — описание задания для автора|скопирован из description плана/i.test(issue)) {
      return true
    }
    return false
  })
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
