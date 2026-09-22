import { generatePlanAI, generateWorksheetAI } from './ai'
import { annotateExtractRelevance, prepareReferenceContent } from './contextFilter'
import { referenceFilePayload } from './contextFile'
import { getGapsSourceText } from './blockUtils'
import { labelForType, type WorksheetDraft } from './worksheet'

export interface TechnicalProbeProgress {
  stage: 'extract' | 'plan' | 'worksheet' | 'done' | 'error'
  message: string
}

export interface TechnicalProbeMeta {
  fileName?: string
  fileSizeMb?: string
  extractSec?: number
  truncated?: boolean
  planSec?: number
  sheetSec?: number
}

function countBrackets(text: string): number {
  return (text.match(/\[[^\]]+\]/g) ?? []).length
}

function optionLabel(o: { text?: string } | string, i: number): string {
  const text = typeof o === 'string' ? o : o.text ?? ''
  return `${String.fromCharCode(97 + i)}) ${text}`
}

function itemLabel(o: { text?: string } | string): string {
  return typeof o === 'string' ? o : o.text ?? ''
}

export function formatProbePlan(plan: WorksheetDraft['plan']): string {
  return plan
    .map(
      (p, i) =>
        `${i + 1}. ${p.taskType} (${labelForType(p.taskType)}) — ${p.userExpectation || '—'}`,
    )
    .join('\n')
}

export function formatProbeWorksheet(draft: WorksheetDraft): string {
  const lines: string[] = []
  if (draft.title) lines.push(`**${draft.title}**`, '')
  if (draft.intro) lines.push(draft.intro, '')

  let n = 0
  for (const b of draft.blocks) {
    if (['page_break', 'text', 'answer_field', 'table'].includes(b.type)) continue
    n += 1
    lines.push(`### Задание ${n} (${labelForType(b.type)})`)
    if (b.question) lines.push(b.question)
    if (b.options?.length) {
      lines.push(b.options.map(optionLabel).join('\n'))
      if (b.correctOptionId) {
        const idx = b.options.findIndex((o) => o.id === b.correctOptionId)
        if (idx >= 0) lines.push(`Верный: ${String.fromCharCode(97 + idx)}`)
      }
    }
    const gaps = b.gapsText || b.gapsSourceText || getGapsSourceText(b)
    if (gaps) lines.push('', gaps)
    if (b.leftItems?.length && b.rightItems?.length) {
      lines.push(
        'Слева: ' + b.leftItems.map(itemLabel).join('; '),
        'Справа: ' + b.rightItems.map(itemLabel).join('; '),
      )
    }
    if (b.groups?.length) {
      for (const g of b.groups) {
        lines.push(`${g.title}: ${g.items.map(itemLabel).join(', ')}`)
      }
    }
    if (b.orderItems?.length) lines.push('Элементы: ' + b.orderItems.map(itemLabel).join(' → '))
    if (b.correctAnswers?.length) {
      lines.push('Ключ: ' + b.correctAnswers.join('; '))
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function buildTechnicalProbeMarkdown(
  draft: WorksheetDraft,
  plan: WorksheetDraft['plan'],
  sheet: WorksheetDraft,
  meta: TechnicalProbeMeta,
): string {
  const today = new Date().toISOString().slice(0, 10)
  const raw = draft.contextFileText?.trim() ?? ''
  const fileLabel = draft.contextFileName?.trim() || 'без файла'
  const brackets = raw ? countBrackets(raw) : 0
  const filtered = raw ? prepareReferenceContent(raw) : ''
  const blockNote = draft.wishes.trim()
    ? `, пожелания: «${draft.wishes.trim().slice(0, 80)}${draft.wishes.length > 80 ? '…' : ''}»`
    : ''

  const metaParts = [
    meta.fileSizeMb ? `${meta.fileSizeMb} МБ` : null,
    meta.extractSec != null ? `${meta.extractSec} с extract` : null,
    raw ? `${raw.length.toLocaleString('ru-RU')} символов` : 'файл не приложен',
    raw ? `${brackets} [скобок]` : null,
    meta.truncated != null ? `truncated: ${meta.truncated}` : null,
  ].filter(Boolean)

  const sections: string[] = [
    `# ${fileLabel} — технический прогон`,
    '',
    `Прогон ${today}. ${metaParts.join(', ')}.`,
    '',
  ]

  if (raw) {
    sections.push(
      '## Исходный текст с разметкой релевантности',
      '',
      '<p class="ctx-legend"><span class="ctx-relevant">релевантно</span> · <span class="ctx-irrelevant">нерелевантно</span></p>',
      '',
      '<div class="ctx-annotated">',
      annotateExtractRelevance(raw),
      '</div>',
      '',
      `## Отфильтрованный reference_file (${filtered.length.toLocaleString('ru-RU')} симв.)`,
      '',
      '```',
      filtered,
      '```',
      '',
    )
  } else if (draft.contextFileName) {
    sections.push(
      '## Файл',
      '',
      `Файл «${draft.contextFileName}» приложён, но текст не извлечён.`,
      draft.contextFileNote ? draft.contextFileNote : '',
      '',
    )
  }

  sections.push(
    '---',
    '',
    '## Генерация листа',
    '',
    `Вход: ${draft.subject}, ${draft.grade} класс, ${draft.taskCount} заданий, тема «${draft.topic}»${raw ? `, reference_file = extract выше (без решений${blockNote}, ${filtered.length.toLocaleString('ru-RU')} симв.)` : ''}.`,
    '',
  )

  if (draft.wishes.trim()) {
    sections.push(`Пожелания: ${draft.wishes.trim()}`, '')
  }

  const ref = referenceFilePayload(draft)
  if (ref?.content) {
    sections.push(
      '**reference_file.content (preview):**',
      '',
      '```',
      ref.content.slice(0, 600) + (ref.content.length > 600 ? '…' : ''),
      '```',
      '',
    )
  }

  sections.push(
    `План (${meta.planSec?.toFixed(1) ?? '—'} с):`,
    '',
    '```',
    formatProbePlan(plan),
    '```',
    '',
    `Рабочий лист (${meta.sheetSec?.toFixed(1) ?? '—'} с):`,
    '',
    '```',
    formatProbeWorksheet(sheet),
    '```',
    '',
  )

  return sections.join('\n')
}

export async function runTechnicalProbe(
  draft: WorksheetDraft,
  onProgress?: (progress: TechnicalProbeProgress) => void,
  metaOverrides?: Partial<TechnicalProbeMeta>,
): Promise<{ markdown: string; meta: TechnicalProbeMeta }> {
  const meta: TechnicalProbeMeta = {
    fileName: draft.contextFileName,
    truncated: false,
    ...metaOverrides,
  }

  onProgress?.({ stage: 'plan', message: 'Генерация плана…' })
  const t0 = Date.now()
  const plan = await generatePlanAI({ ...draft, plan: draft.plan.length ? draft.plan : [] })
  meta.planSec = (Date.now() - t0) / 1000

  const withPlan = { ...draft, plan, taskCount: plan.length }

  onProgress?.({ stage: 'worksheet', message: 'Генерация рабочего листа…' })
  const t1 = Date.now()
  const sheet = await generateWorksheetAI(withPlan, 'create')
  meta.sheetSec = (Date.now() - t1) / 1000

  onProgress?.({ stage: 'done', message: 'Готово' })

  return {
    markdown: buildTechnicalProbeMarkdown(withPlan, plan, sheet, meta),
    meta,
  }
}
