import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import {
  ANSWER_CELL_SIZE,
  getDisplayAnswerText,
  getEffectiveAnswerLines,
} from '@/data/blockUtils'
import {
  COLORS,
  LAYOUT,
  TYPO,
  pxToDxa,
  pxToHalfPoints,
  pxToTwips,
} from '@/export/word/layoutTokens'
import { parseContent } from '@/export/word/richText/parseRichText'
import { segmentsToRuns } from '@/export/word/richText/toDocxContent'
import type { ExportContext } from '@/export/word/types'
import {
  BorderStyle,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

function answerLabelRun(): TextRun {
  return new TextRun({
    text: 'Ответ:',
    font: 'Onest',
    size: pxToHalfPoints(TYPO.answerLabel.sizePx),
    color: COLORS.textSecondary,
  })
}

function ruledLineParagraph(children: (TextRun | ImageRun)[] = []): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: COLORS.borderSecondary,
        space: 1,
        style: BorderStyle.SINGLE,
        size: 1,
      },
    },
    spacing: {
      after: pxToTwips(LAYOUT.answerLineGap),
      line: pxToTwips(LAYOUT.answerLineHeight),
      lineRule: 'exact',
    },
    indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
    children: children.length > 0 ? children : [new TextRun({ text: ' ' })],
  })
}

async function buildLinesAnswer(
  block: WorksheetBlock,
  subject: string,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  const lines = getEffectiveAnswerLines(block, subject, showAnswer)
  const answerText = getDisplayAnswerText(block)
  const result: Paragraph[] = []

  if (showAnswer && answerText) {
    const valueRuns = await segmentsToRuns(
      parseContent(answerText),
      { ...TYPO.answerValue, color: COLORS.textPositive },
      ctx,
    )
    result.push(
      ruledLineParagraph([
        answerLabelRun(),
        new TextRun({ text: ' ' }),
        ...valueRuns,
      ]),
    )
    for (let i = 1; i < lines; i += 1) {
      result.push(ruledLineParagraph())
    }
    return result
  }

  result.push(
    new Paragraph({
      indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      spacing: { after: pxToTwips(2) },
      children: [answerLabelRun()],
    }),
  )
  for (let i = 0; i < lines; i += 1) {
    result.push(ruledLineParagraph())
  }
  return result
}

async function buildBlockAnswer(
  block: WorksheetBlock,
  subject: string,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  const lines = getEffectiveAnswerLines(block, subject, showAnswer)
  const answerText = getDisplayAnswerText(block)
  const minHeight = Math.max(lines + 1, 3) * LAYOUT.answerLineHeight

  const border = {
    top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
    left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
    right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
  }

  if (showAnswer && answerText) {
    const valueRuns = await segmentsToRuns(
      parseContent(answerText),
      { ...TYPO.answerValue, color: COLORS.textPositive },
      ctx,
    )
    return [
      new Paragraph({
        border,
        spacing: { before: pxToTwips(8), after: pxToTwips(8), line: pxToTwips(minHeight) },
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
        children: [answerLabelRun(), new TextRun({ text: ' ' }), ...valueRuns],
      }),
    ]
  }

  return [
    new Paragraph({
      border,
      spacing: { before: pxToTwips(8), after: pxToTwips(8), line: pxToTwips(minHeight) },
      indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      children: [answerLabelRun()],
    }),
  ]
}

function buildCellsTable(rows: number, cols: number): Table {
  const cellWidth = pxToDxa(ANSWER_CELL_SIZE)
  const tableRows: TableRow[] = []

  for (let r = 0; r < rows; r += 1) {
    const cells: TableCell[] = []
    for (let c = 0; c < cols; c += 1) {
      cells.push(
        new TableCell({
          width: { size: cellWidth, type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
            left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
          },
          children: [new Paragraph({ children: [new TextRun({ text: ' ' })] })],
        }),
      )
    }
    tableRows.push(new TableRow({ children: cells }))
  }

  return new Table({
    width: { size: cellWidth * cols, type: WidthType.DXA },
    indent: { size: pxToTwips(LAYOUT.slotPaddingLeft), type: WidthType.DXA },
    rows: tableRows,
  })
}

async function buildCellsAnswer(
  block: WorksheetBlock,
  subject: string,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<(Paragraph | Table)[]> {
  const rows = getEffectiveAnswerLines(block, subject, showAnswer)
  const cols = Math.max(12, Math.floor(480 / ANSWER_CELL_SIZE))
  const result: (Paragraph | Table)[] = [
    new Paragraph({
      indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      spacing: { after: pxToTwips(4) },
      children: [answerLabelRun()],
    }),
    buildCellsTable(rows, cols),
  ]

  if (showAnswer) {
    const answerText = getDisplayAnswerText(block)
    if (answerText) {
      const valueRuns = await segmentsToRuns(
        parseContent(answerText),
        { ...TYPO.answerValue, color: COLORS.textPositive },
        ctx,
      )
      result.push(
        new Paragraph({
          indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
          spacing: { before: pxToTwips(8) },
          children: valueRuns,
        }),
      )
    }
  }

  return result
}

export async function buildAnswerArea(
  block: WorksheetBlock,
  style: AnswerAreaStyle,
  subject: string,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<(Paragraph | Table)[]> {
  if (style === 'block') {
    return buildBlockAnswer(block, subject, showAnswer, ctx)
  }
  if (style === 'cells' || style === 'axes' || style === 'number_line' || style === 'ray') {
    return buildCellsAnswer(block, subject, showAnswer, ctx)
  }
  return buildLinesAnswer(block, subject, showAnswer, ctx)
}
