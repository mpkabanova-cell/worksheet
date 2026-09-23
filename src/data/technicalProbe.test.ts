import { describe, expect, it } from 'vitest'
import { buildTechnicalProbeMarkdown } from './technicalProbe'
import { filledCreateDraft } from './worksheet'

describe('buildTechnicalProbeMarkdown', () => {
  it('includes relevance markup and generation sections', () => {
    const draft = {
      ...filledCreateDraft(),
      contextFileName: 'sample.docx',
      contextFileText: `5-6 классы

Совунья пересекла пещеру за 3 минуты.

Решение:

18 минут.`,
      topic: 'решение задач',
      subject: 'Математика',
      grade: '5',
    }

    const plan = draft.taskPlan.slice(0, 2)
    const sheet = {
      ...draft,
      title: 'Решение задач',
      blocks: [
        {
          ...draft.blocks[0],
          type: 'short_answer' as const,
          question: 'Сколько минут?',
          correctAnswers: ['3'],
        },
      ],
    }

    const md = buildTechnicalProbeMarkdown(draft, plan, sheet, {
      fileSizeMb: '1.20',
      planSec: 2.1,
      sheetSec: 5.4,
      planSource: 'ai',
    })

    expect(md).toContain('технический прогон')
    expect(md).toContain('ctx-relevant')
    expect(md).toContain('ctx-irrelevant')
    expect(md).toContain('## Генерация листа')
    expect(md).toContain('План (2.1 с')
    expect(md).toContain('AI plan')
    expect(md).toContain('Рабочий лист (5.4 с)')
  })
})
