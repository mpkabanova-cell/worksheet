import { ensurePlan, generatePlanAI, generateWorksheetAI } from './ai'
import { annotateExtractRelevance, listContextBlockTitles } from './contextFilter'
import { buildContextReference, contextFilterOptions, sourceContentForDraft } from './contextFile'
import { getGapsSourceText } from './blockUtils'
import { labelForType, type WorksheetDraft } from './worksheet'
import { planItemDifficultyLabel } from './planMechanics'

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
    .map((p, i) => {
      const parts = [
        `${i + 1}. ${p.taskType} (${labelForType(p.taskType)})`,
        p.userExpectation ? `user: ${p.userExpectation}` : null,
        p.description ? `desc: ${p.description}` : null,
        p.planDifficulty ? `diff: ${planItemDifficultyLabel(p.planDifficulty)}` : null,
      ].filter(Boolean)
      return parts.join(' — ')
    })
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
  const contextOptions = contextFilterOptions(draft)
  const reference = raw ? buildContextReference(raw, contextOptions) : null
  const filtered = reference?.content ?? ''
  const blockTitles = raw ? listContextBlockTitles(raw) : []
  const selectedBlock = reference?.selectedBlock ?? null
  const blockNote = selectedBlock
    ? `, блок «${selectedBlock}»${draft.wishes.trim() ? ` (пожелания: «${draft.wishes.trim().slice(0, 60)}${draft.wishes.length > 60 ? '…' : ''}»)` : ` (по ${draft.grade} классу)`}`
    : draft.wishes.trim()
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
    '_Пайплайн: `extractContextFile` → `buildContextReference` (`src/data/contextFile.ts`) → `generateWorksheetAI` (`src/data/ai.ts`)._',
    '',
  ]

  if (raw) {
    if (blockTitles.length) {
      sections.push(
        '## Блоки в файле',
        '',
        blockTitles.map((title) => `- ${title}`).join('\n'),
        selectedBlock
          ? `\nВыбран для генерации: **${selectedBlock}**${draft.wishes.trim() ? ' (по пожеланиям)' : draft.grade.trim() ? ` (по ${draft.grade} классу)` : ''}`
          : '\nБлок не выбран — в reference попадёт весь файл.',
        '',
      )
    }

    sections.push(
      '## Полный extract с разметкой релевантности',
      '',
      '_Тот же текст, что в `contextFileText` после OCR — построчно, без обрезки по классу. Для генерации ниже используется отфильтрованный блок._',
      '',
      '<p class="ctx-legend"><span class="ctx-relevant">релевантно</span> · <span class="ctx-irrelevant">нерелевантно</span></p>',
      '',
      '<div class="ctx-annotated">',
      annotateExtractRelevance(raw, { ...contextOptions, fullExtract: true }),
      '</div>',
      '',
      `## Отфильтрованный reference_file (${filtered.length.toLocaleString('ru-RU')} симв.)`,
      '',
    )

    if (reference?.usedFallback && reference.fallbackReason) {
      sections.push(`> ⚠ ${reference.fallbackReason}`, '')
    }

    if (!filtered) {
      sections.push(
        '> ⚠ **reference пуст** — plan/worksheet не получат `source_content`. Проверьте extract и класс/пожелания.',
        '',
      )
    }

    sections.push('```', filtered || '(пусто)', '```', '')
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

  if (filtered) {
    sections.push(
      '**reference_file.content (preview):**',
      '',
      '```',
      filtered.slice(0, 600) + (filtered.length > 600 ? '…' : ''),
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

  const raw = draft.contextFileText?.trim() ?? ''
  const reference = raw ? buildContextReference(raw, contextFilterOptions(draft)) : null

  if (raw && !reference?.content) {
    throw new Error(
      `Текст файла извлечён (${reference?.rawLength ?? raw.length} симв.), но reference для генерации пуст. ${reference?.fallbackReason ?? 'Проверьте OCR и параллель.'}`,
    )
  }

  const workingDraft = {
    ...draft,
    title: draft.topic.trim() || draft.title,
    plan:
      draft.plan.length >= draft.taskCount
        ? draft.plan
        : ensurePlan({ ...draft, taskCount: draft.taskCount }),
  }

  const hasReference = Boolean(sourceContentForDraft(workingDraft))

  onProgress?.({ stage: 'plan', message: 'Генерация плана…' })
  const t0 = Date.now()
  const plan = hasReference
    ? await generatePlanAI(workingDraft)
    : workingDraft.plan
  meta.planSec = (Date.now() - t0) / 1000

  const withPlan = { ...workingDraft, plan, taskCount: plan.length }

  onProgress?.({ stage: 'worksheet', message: 'Генерация рабочего листа…' })
  const t1 = Date.now()
  const sheet = await generateWorksheetAI(withPlan, 'create', {
    skipTaskRepairs: true,
    maxIndependenceRetries: 1,
    skipExtraIndependencePass: true,
  })
  meta.sheetSec = (Date.now() - t1) / 1000

  onProgress?.({ stage: 'done', message: 'Готово' })

  return {
    markdown: buildTechnicalProbeMarkdown(withPlan, sheet.plan, sheet, meta),
    meta,
  }
}
