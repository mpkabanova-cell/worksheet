import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import {
  ANSWER_CELL_SIZE,
  getDisplayAnswerText,
  getEffectiveAnswerLines,
} from '@/data/blockUtils'
import {
  COLORS,
  LAYOUT,
  SHEET_CONTENT_WIDTH_PX,
  TYPO,
  answerCellsColumnCount,
  pxToDxa,
  pxToHalfPoints,
  pxToTwips,
  runFont,
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

const GRID_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.gridLine },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.gridLine },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.gridLine },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.gridLine },
}

function answerLabelRun(): TextRun {
  return new TextRun({
    text: 'Ответ:',
    font: runFont(),
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

function buildCellsTable(rows: number, cols: number, overlayLabel: boolean): Table {
  const cellWidth = pxToDxa(ANSWER_CELL_SIZE)
  const tableRows: TableRow[] = []

  for (let r = 0; r < rows; r += 1) {
    const cells: TableCell[] = []
    for (let c = 0; c < cols; c += 1) {
      const isLabelCell = overlayLabel && r === 0 && c === 0
      cells.push(
        new TableCell({
          width: { size: cellWidth, type: WidthType.DXA },
          margins: {
            top: 20,
            bottom: 20,
            left: isLabelCell ? 40 : 0,
            right: 0,
          },
          borders: GRID_BORDER,
          children: [
            new Paragraph({
              spacing: { line: pxToTwips(ANSWER_CELL_SIZE), lineRule: 'exact' },
              children: isLabelCell
                ? [answerLabelRun()]
                : [new TextRun({ text: ' ', size: 2 })],
            }),
          ],
        }),
      )
    }
    tableRows.push(new TableRow({ children: cells }))
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
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
  const cols = answerCellsColumnCount(SHEET_CONTENT_WIDTH_PX)
  const result: (Paragraph | Table)[] = [buildCellsTable(rows, cols, !showAnswer)]

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
          children: [answerLabelRun(), new TextRun({ text: ' ' }), ...valueRuns],
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
