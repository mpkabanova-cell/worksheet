import { describe, expect, it, vi } from 'vitest'
import type { WorksheetBlock, WorksheetDraft } from '@/data/worksheet'
import {
  buildTaskHeadTable,
  type TaskHeadTableLayoutDebug,
} from '@/export/word/build/buildTaskHeadTable'
import { pxToDxa, SHEET_CONTENT_WIDTH_PX, TYPO } from '@/export/word/layoutTokens'
import { TASK_QUESTION_WIDTH_PX } from '@/export/word/layoutSpec'
import {
  measureTextWidthPx,
  textCellWidthPx,
} from '@/export/word/richText/measureTextWidth'
import type { ExportContext } from '@/export/word/types'

vi.mock('@/export/word/richText/mathToImage', () => ({
  renderMathToPng: vi.fn(async (_tex: string, _display: boolean, _fontSizePx: number) => ({
    data: new Uint8Array([137, 80, 78, 71]),
    width: 52,
    height: 22,
  })),
}))

vi.mock('@/export/word/assets/uiAssets', () => ({
  getStarFilledPng: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
  getStarEmptyPng: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
}))

const SCREENSHOT_QUESTION = 'Представьте выражение $(x + 5)^2$ в виде многочлена.'

function makeContext(draft: WorksheetDraft): ExportContext {
  return {
    draft,
    options: {
      showAnswers: false,
      showDifficulty: true,
      answersSeparate: true,
      orientation: 'portrait',
    },
    subject: draft.subject,
    mathCache: new Map(),
    imageCache: new Map(),
    domImageCache: new Map(),
  }
}

function screenshotShortAnswerBlock(): WorksheetBlock {
  return {
    id: 'task-screenshot',
    type: 'short_answer',
    page: 0,
    title: '',
    issued: false,
    question: SCREENSHOT_QUESTION,
    difficulty: 1,
    answerLines: 4,
  }
}

function screenshotSingleChoiceBlock(): WorksheetBlock {
  return {
    id: 'task-choice',
    type: 'single_choice',
    page: 0,
    title: '',
    issued: false,
    question: SCREENSHOT_QUESTION,
    difficulty: 1,
    options: [
      { id: 'o1', text: '$x^2 + 10x + 25$' },
      { id: 'o2', text: '$x^2 + 25$' },
      { id: 'o3', text: '$2x + 10$' },
    ],
    correctOptionIds: ['o1'],
    choiceOptionFormat: 'text',
  }
}

async function buildLayout(
  block: WorksheetBlock,
  showAnswerPass: boolean,
): Promise<TaskHeadTableLayoutDebug> {
  let layout: TaskHeadTableLayoutDebug | undefined
  const draft: WorksheetDraft = {
    id: 'ws-test',
    subject: 'Алгебра',
    grade: '7',
    taskCount: 1,
    topic: 'применение формул сокращенного умножения',
    wishes: '',
    title: 'применение формул сокращенного умножения',
    intro: 'Формулы сокращённого умножения позволяют упрощать вычисления.',
    difficulty: 'basic',
    showDifficulty: true,
    showAnswers: showAnswerPass,
    addIntro: true,
    createdManually: false,
    plan: [],
    blocks: [block],
    pages: 1,
    print: { answersSeparate: true, copies: 1, orientation: 'portrait' },
  }

  await buildTaskHeadTable(1, block.question ?? '', block.type === 'short_answer', block, makeContext(draft), {
    showAnswerPass,
    onLayout: (metrics) => {
      layout = metrics
    },
  })

  if (!layout) throw new Error('onLayout was not called')
  return layout
}

describe('task head table diagnostics (screenshot worksheet)', () => {
  it('screenshot task is short_answer — uses 16px answer typography, no choice extraRows', async () => {
    const layout = await buildLayout(screenshotShortAnswerBlock(), false)

    expect(layout.blockType).toBe('short_answer')
    expect(layout.isAnswerBlock).toBe(true)
    expect(layout.questionFontSizePx).toBe(TYPO.answerTaskQuestion.sizePx)
    expect(layout.inlineCellCount).toBe(3)
  })

  it('student and answers passes produce identical column widths for short_answer', async () => {
    const block = screenshotShortAnswerBlock()
    const studentLayout = await buildLayout(block, false)
    const answersLayout = await buildLayout(block, true)

    expect(studentLayout.firstRowColumnWidthsDxa).toEqual(answersLayout.firstRowColumnWidthsDxa)
    expect(studentLayout.questionFontSizePx).toBe(answersLayout.questionFontSizePx)
    expect(studentLayout.inlineCellCount).toBe(answersLayout.inlineCellCount)
  })

  it('single_choice uses 18px typography on both passes (same table metrics)', async () => {
    const block = screenshotSingleChoiceBlock()
    const studentLayout = await buildLayout(block, false)
    const answersLayout = await buildLayout(block, true)

    expect(studentLayout.blockType).toBe('single_choice')
    expect(studentLayout.isAnswerBlock).toBe(false)
    expect(studentLayout.questionFontSizePx).toBe(TYPO.taskQuestion.sizePx)
    expect(studentLayout.firstRowColumnWidthsDxa).toEqual(answersLayout.firstRowColumnWidthsDxa)
  })

  it('content columns fill the question width budget (prevents narrow-cell Word wrap)', async () => {
    const layout = await buildLayout(screenshotShortAnswerBlock(), false)
    const numWidthDxa = layout.firstRowColumnWidthsDxa[0]
    const contentSumDxa = layout.firstRowColumnWidthsDxa.slice(1).reduce((sum, width) => sum + width, 0)
    const expectedContentDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX - 32)

    expect(contentSumDxa).toBe(expectedContentDxa)
    expect(numWidthDxa).toBe(pxToDxa(32))
  })

  it('text cells are at least as wide as measured Cyrillic strings', () => {
    const fontSizePx = TYPO.answerTaskQuestion.sizePx
    const segments = [
      { kind: 'text' as const, value: 'Представьте выражение ' },
      { kind: 'text' as const, value: ' в виде многочлена.' },
    ]

    for (const segment of segments) {
      const measuredPx = measureTextWidthPx(segment.value, fontSizePx)
      const cellPx = textCellWidthPx([segment], fontSizePx)
      expect(cellPx).toBeGreaterThanOrEqual(Math.ceil(measuredPx))
    }

    expect(TASK_QUESTION_WIDTH_PX).toBeGreaterThan(600)
  })
})
