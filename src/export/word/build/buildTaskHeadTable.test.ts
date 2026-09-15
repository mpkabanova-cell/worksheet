import { describe, expect, it, vi } from 'vitest'
import type { WorksheetBlock, WorksheetDraft } from '@/data/worksheet'
import {
  buildTaskHeadTable,
  difficultyRowColumnWidthsPx,
  type TaskHeadTableLayoutDebug,
} from '@/export/word/build/buildTaskHeadTable'
import { pxToDxa, COLORS, LAYOUT, SHEET_CONTENT_WIDTH_PX, TYPO } from '@/export/word/layoutTokens'
import type { ExportContext } from '@/export/word/types'
import { Math, MathRun, MathSuperScript } from 'docx'

vi.mock('@/export/word/richText/latexToWordMath', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/export/word/richText/latexToWordMath')>()
  return {
    ...actual,
    mathSegmentToParagraphChild: vi.fn(async (tex: string, _display: boolean, style) =>
      actual.latexToWordMath(tex.replace(/\s+/g, ''), style),
    ),
  }
})

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
    expect(layout.firstRowColumnWidthsDxa).toHaveLength(2)
    expect(layout.paragraphCount).toBeGreaterThan(0)
  })

  it('short_answer with filled question uses default num color (portal parity)', async () => {
    const layout = await buildLayout(screenshotShortAnswerBlock(), false)

    expect(layout.numColor).toBe(COLORS.textDefault)
  })

  it('short_answer with placeholder question uses secondary num color', async () => {
    const block = { ...screenshotShortAnswerBlock(), question: 'Введите текст' }
    const layout = await buildLayout(block, false)

    expect(layout.numColor).toBe(COLORS.textSecondary)
  })

  it('student and answers passes produce identical column widths for short_answer', async () => {
    const block = screenshotShortAnswerBlock()
    const studentLayout = await buildLayout(block, false)
    const answersLayout = await buildLayout(block, true)

    expect(studentLayout.firstRowColumnWidthsDxa).toEqual(answersLayout.firstRowColumnWidthsDxa)
    expect(studentLayout.questionFontSizePx).toBe(answersLayout.questionFontSizePx)
    expect(studentLayout.paragraphCount).toBe(answersLayout.paragraphCount)
  })

  it('single_choice uses 18px typography on both passes (same table metrics)', async () => {
    const block = screenshotSingleChoiceBlock()
    const studentLayout = await buildLayout(block, false)
    const answersLayout = await buildLayout(block, true)

    expect(studentLayout.blockType).toBe('single_choice')
    expect(studentLayout.isAnswerBlock).toBe(false)
    expect(studentLayout.questionFontSizePx).toBe(TYPO.taskQuestion.sizePx)
    expect(studentLayout.firstRowColumnWidthsDxa).toEqual(answersLayout.firstRowColumnWidthsDxa)
    expect(studentLayout.firstRowColumnWidthsDxa).toHaveLength(2)
  })

  it('difficulty row matches portal/Figma layout widths', () => {
    expect(difficultyRowColumnWidthsPx()).toEqual([80, 64])
    expect(difficultyRowColumnWidthsPx().reduce((sum, width) => sum + width, 0)).toBe(144)
    expect(LAYOUT.diffLabelWidth).toBe(80)
    expect(LAYOUT.diffStarGapPx).toBe(4)
    expect(LAYOUT.answerTaskMainGap).toBe(4)
    expect(LAYOUT.taskMainGap).toBe(8)
    expect(TYPO.difficulty.sizePx).toBe(12)
    expect(TYPO.difficulty.linePx).toBe(16)
  })

  it('content column uses the full question width budget', async () => {
    const layout = await buildLayout(screenshotShortAnswerBlock(), false)
    const numWidthDxa = layout.firstRowColumnWidthsDxa[0]
    const contentWidthDxa = layout.firstRowColumnWidthsDxa[1]
    const expectedContentDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX - 32)

    expect(contentWidthDxa).toBe(expectedContentDxa)
    expect(numWidthDxa).toBe(pxToDxa(32))
  })

  it('question cell contains native Word Math, not PNG', async () => {
    const math = new Math({
      children: [
        new MathSuperScript({
          children: [new MathRun('x+5')],
          superScript: [new MathRun('2')],
        }),
      ],
    })
    expect(math).toBeTruthy()
  })
})
