import { stripSolutionTail } from './contextFilter'
import { getGapsSourceText } from './blockUtils'
import type { TaskType, WorksheetBlock } from './worksheet'
import { blockQuestionIssues } from './taskIndependence'
import { extractCaveConditionFromReference } from './referenceEnrich'

export type ReferenceThemeId = 'cave' | 'logic-towns' | 'delivery'

export interface ReferenceTheme {
  id: ReferenceThemeId
  label: string
  match: RegExp
}

export interface AnchorTask {
  index: number
  type: TaskType
  themes: ReferenceThemeId[]
  excerpt: string
}

const REFERENCE_THEMES: ReferenceTheme[] = [
  {
    id: 'cave',
    label: 'задача про пещеру и время персонажей',
    match: /пещер|бараш|лосяш|совун|ежик|крош|пин/i,
  },
  {
    id: 'logic-towns',
    label: 'логическая задача про Правдинск и Лжеград',
    match: /правдинск|лжеград|прокурор|судья|ограбил/i,
  },
  {
    id: 'delivery',
    label: 'задача про маршруты и время доставки между точками',
    match: /молочный комбинат|доставк|«фабрика качества»|торгов/i,
  },
]

function cleanReferenceText(content: string): string {
  return stripSolutionTail(content.replace(/\[[^\]]+\]/g, ' '))
}

export function detectThemesInText(text: string): ReferenceThemeId[] {
  const value = text.trim()
  if (!value) return []
  return REFERENCE_THEMES.filter((theme) => theme.match.test(value)).map((theme) => theme.id)
}

export function themeLabel(id: ReferenceThemeId): string {
  return REFERENCE_THEMES.find((theme) => theme.id === id)?.label ?? id
}

export function extractLogicTownCondition(content: string): string {
  const cleaned = cleanReferenceText(content)
  const idx = cleaned.search(/Правдинск/i)
  if (idx < 0) return ''

  let chunk = cleaned.slice(Math.max(0, idx - 40))
  const solutionIdx = chunk.search(/\n\s*Решение\s*:/i)
  if (solutionIdx >= 0) chunk = chunk.slice(0, solutionIdx)

  const paragraphs = chunk
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  const relevant = paragraphs.filter((part) => /правдинск|лжеград|прокурор|суд/i.test(part))
  const body = (relevant.length ? relevant.join('\n\n') : chunk).trim()
  return /прокурор|суд/i.test(body) ? body.slice(0, 1200) : ''
}

export function extractDeliveryCondition(content: string): string {
  const cleaned = cleanReferenceText(content)
  const idx = cleaned.search(/Молочный комбинат/i)
  if (idx < 0) return ''

  let chunk = cleaned.slice(idx)
  const solutionIdx = chunk.search(/\n\s*Решение\s*:/i)
  if (solutionIdx >= 0) chunk = chunk.slice(0, solutionIdx)

  const lines = chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && /\d+\s*минут/i.test(line))
  if (lines.length < 3) return ''

  const intro = chunk
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /достав|маршрут|комбинат/i.test(line) && !/\d+\s*минут/i.test(line))

  return [intro, ...lines.slice(0, 12)].filter(Boolean).join('\n').trim()
}

export function extractThemeCondition(content: string, themeId: ReferenceThemeId): string {
  switch (themeId) {
    case 'cave':
      return extractCaveConditionFromReference(content)
    case 'logic-towns':
      return extractLogicTownCondition(content)
    case 'delivery':
      return extractDeliveryCondition(content)
    default:
      return ''
  }
}

function blockBriefText(block: WorksheetBlock): string {
  if (block.type === 'fill_gaps') {
    return block.question || getGapsSourceText(block) || ''
  }
  return block.question || block.body || ''
}

/** Удачные задания листа — опора для тематически близких альтернатив. */
export function collectAnchorTasks(
  blocks: WorksheetBlock[],
  planExpectations: (string | undefined)[] = [],
  options?: { skipBlockIndex?: number },
): AnchorTask[] {
  const anchors: AnchorTask[] = []
  let taskIndex = 0

  for (let i = 0; i < blocks.length; i++) {
    if (options?.skipBlockIndex === i) continue
    const block = blocks[i]
    if (['page_break', 'text', 'answer_field', 'table'].includes(block.type)) continue

    taskIndex += 1
    const expectation = planExpectations[i]
    if (blockQuestionIssues(block, expectation).length) continue

    const excerpt = blockBriefText(block).trim()
    if (excerpt.length < 40) continue

    const themes = detectThemesInText(`${excerpt}\n${expectation || ''}`)
    anchors.push({
      index: taskIndex,
      type: block.type,
      themes,
      excerpt: excerpt.slice(0, 500),
    })
  }

  return anchors
}

export function pickReplacementTheme(
  targetExpectation: string | undefined,
  refContent: string | undefined,
  anchors: AnchorTask[],
): ReferenceThemeId | null {
  const fromExpectation = detectThemesInText(targetExpectation || '')
  if (fromExpectation[0]) return fromExpectation[0]

  const fromAnchors = anchors.flatMap((anchor) => anchor.themes)
  if (fromAnchors[0]) return fromAnchors[0]

  const fromReference = detectThemesInText(refContent || '')
  return fromReference[0] ?? null
}

export function buildAlternativeTaskGuidance(
  anchors: AnchorTask[],
  refContent?: string,
  targetExpectation?: string,
): string | null {
  if (!anchors.length && !refContent?.trim()) return null

  const themeIds = [
    ...new Set([
      ...detectThemesInText(targetExpectation || ''),
      ...anchors.flatMap((anchor) => anchor.themes),
      ...detectThemesInText(refContent || ''),
    ]),
  ]
  const themeLabels = themeIds.map(themeLabel)

  const anchorLines = anchors.slice(0, 4).map(
    (anchor) =>
      `- Задание ${anchor.index} (${anchor.type}): ${anchor.excerpt.slice(0, 180).replace(/\s+/g, ' ')}…`,
  )

  return [
    'Альтернативное задание должно быть сюжетно и по логике близко к уже удачным заданиям листа и reference_file, но оставаться самостоятельным.',
    themeLabels.length
      ? `Допустимые сюжеты: ${themeLabels.join('; ')}. Не придумывай посторонние темы (магазин, поезд, склад), если их нет в reference_file.`
      : 'Бери сюжет и данные только из reference_file.',
    'Новое question — полное условие с числами и правилами; не дроби одну задачу на несколько заданий и не отсылай к другим заданиям листа.',
    anchorLines.length ? 'Удачные задания листа (ориентир по стилю и логике):' : '',
    ...anchorLines,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildFillGapsFallbackBlock(
  block: WorksheetBlock,
  refContent: string,
  targetExpectation?: string,
  anchors: AnchorTask[] = [],
): WorksheetBlock {
  const themeId = pickReplacementTheme(targetExpectation, refContent, anchors)
  const snippet = themeId ? extractThemeCondition(refContent, themeId) : ''

  if (themeId === 'cave' && snippet) {
    const condition = extractCaveConditionFromReference(refContent)
    if (condition) {
      const dataLines: string[] = []
      for (const line of condition.split('\n').map((item) => item.trim()).filter(Boolean)) {
        if (/^\d+\s*[-–—]\s*\d+\s*класс/i.test(line)) continue
        if (/\d+\s*минут/.test(line) || /минуту/.test(line)) {
          dataLines.push(line)
        }
      }

      const gapsAnswers = dataLines
        .map((line) => line.match(/(\d+)/)?.[1] ?? '')
        .filter(Boolean)

      return {
        ...block,
        question: [
          condition,
          '',
          'Заполните пропуски в данных ниже.',
        ].join('\n'),
        gapsText: dataLines.map((line) => line.replace(/\d+/g, '___')).join('\n'),
        gapsAnswers: gapsAnswers.length ? gapsAnswers : ['3', '1', '2', '3', '5'],
      }
    }

    return {
      ...block,
      question: [
        'Бараш, Крош, Совунья, Ежик, Пин и Лосяш отправились в поход к Голубому озеру. К вечеру друзья добрались до Чертовой скалы и вошли в проходную Мышиную пещеру. Проход был такой узкий, что одновременно могли идти не больше двух путешественников, а фонарь был только один. Бараш хотел идти в первой паре. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если',
        '',
        'Заполните пропуски в данных ниже.',
      ].join('\n'),
      gapsText:
        'Совунья пересекла пещеру за ___ минут, Пин затратил ___ минуту, Крош затратил ___ минуты, Ежик вышел из пещеры через ___ минуты, Лосяша не могли дождаться ___ минут.',
      gapsAnswers: ['3', '1', '2', '3', '5'],
    }
  }

  if (themeId === 'logic-towns' && snippet) {
    return {
      ...block,
      question: 'Заполните пропуски в условии логической задачи.',
      gapsText:
        'В городе Правдинске жители всегда говорят ___, а жители города Лжеграда всегда ___. Судья — коренной житель Правдинска и утверждает, что слова прокурора — ___.',
      gapsAnswers: ['правду', 'лгут', 'ложь'],
    }
  }

  if (themeId === 'delivery' && snippet) {
    return {
      ...block,
      question: 'Заполните пропуски в условии задачи про доставку.',
      gapsText:
        'Молочный комбинат — «Продуктовая лавка» — ___ минут, «Мираж» — «Фабрика качества» — ___ минут, «Миндаль» — «Фабрика качества» — ___ минут.',
      gapsAnswers: ['10', '15', '25'],
    }
  }

  return block
}
