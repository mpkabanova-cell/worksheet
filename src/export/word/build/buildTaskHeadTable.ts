import type { WorksheetBlock } from '@/data/worksheet'
import {
  getStarEmptyPng,
  getStarFilledPng,
} from '@/export/word/assets/uiAssets'
import {
  COLORS,
  LAYOUT,
  SHEET_CONTENT_WIDTH_PX,
  TYPO,
  lineSpacingPx,
  pxToDxa,
  pxToHalfPoints,
  pxToTwips,
  runFont,
} from '@/export/word/layoutTokens'
import { parseContent, type ContentSegment } from '@/export/word/richText/parseRichText'
import { renderMathToPng } from '@/export/word/richText/mathToImage'
import {
  imageRunFromPng,
  imageRunFromPngSized,
  segmentsToRuns,
} from '@/export/word/richText/toDocxContent'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'
import {
  BorderStyle,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'

type InlineCell =
  | { kind: 'text'; segments: ContentSegment[] }
  | { kind: 'math'; tex: string }

type QuestionLine =
  | { kind: 'inline'; cells: InlineCell[] }
  | { kind: 'display'; tex: string }

const HIDDEN_BORDER = { style: BorderStyle.NONE, size: 0, color: COLORS.white } as const

function hiddenCellBorders() {
  return {
    top: HIDDEN_BORDER,
    bottom: HIDDEN_BORDER,
    left: HIDDEN_BORDER,
    right: HIDDEN_BORDER,
  }
}

function splitLineIntoCells(segments: ContentSegment[]): InlineCell[] {
  const cells: InlineCell[] = []
  let textBuffer: ContentSegment[] = []

  function flushText(): void {
    if (textBuffer.length === 0) return
    cells.push({ kind: 'text', segments: [...textBuffer] })
    textBuffer = []
  }

  for (const segment of segments) {
    if (segment.kind === 'math' && !segment.display) {
      const tex = segment.value.trim()
      if (!tex || /^[=,\.;:\-]+$/.test(tex)) {
        if (segment.value) {
          textBuffer.push({ kind: 'text', value: segment.value })
        }
        continue
      }
      flushText()
      cells.push({ kind: 'math', tex: segment.value })
      continue
    }

    if (segment.kind === 'text') {
      textBuffer.push(segment)
    }
  }

  flushText()
  return cells
}

function splitQuestionIntoLines(segments: ContentSegment[]): QuestionLine[] {
  const lines: QuestionLine[] = []
  let currentLine: ContentSegment[] = []

  function flushLine(): void {
    if (currentLine.length === 0) return
    lines.push({ kind: 'inline', cells: splitLineIntoCells(currentLine) })
    currentLine = []
  }

  for (const segment of segments) {
    if (segment.kind === 'math' && segment.display) {
      flushLine()
      lines.push({ kind: 'display', tex: segment.value })
      continue
    }

    if (segment.kind === 'break') {
      flushLine()
      continue
    }

    currentLine.push(segment)
  }

  flushLine()
  return lines.length > 0 ? lines : [{ kind: 'inline', cells: [] }]
}

function maxInlineColumnCount(lines: QuestionLine[]): number {
  const counts = lines
    .filter((line): line is Extract<QuestionLine, { kind: 'inline' }> => line.kind === 'inline')
    .map((line) => Math.max(1, line.cells.length))
  return Math.max(1, ...counts)
}

async function buildDifficultyParagraph(
  block: WorksheetBlock,
  ctx: ExportContext,
): Promise<Paragraph> {
  const starRuns: ImageRun[] = []
  for (let n = 1; n <= 3; n += 1) {
    const png =
      n <= (block.difficulty ?? 0)
        ? await getStarFilledPng(ctx, 16)
        : await getStarEmptyPng(ctx, 16)
    starRuns.push(await imageRunFromPng(png, 16))
  }

  const children: (TextRun | ImageRun)[] = [
    new TextRun({
      text: 'Сложность:',
      font: runFont(),
      size: pxToHalfPoints(TYPO.difficulty.sizePx),
      color: COLORS.textSecondary,
    }),
    new TextRun({ text: ' ' }),
  ]

  starRuns.forEach((star, index) => {
    if (index > 0) children.push(new TextRun({ text: ' ' }))
    children.push(star)
  })

  return new Paragraph({
    spacing: { before: pxToTwips(4), after: pxToTwips(4) },
    children,
  })
}

async function buildTextCell(
  segments: ContentSegment[],
  style: TextStyleSpec,
  ctx: ExportContext,
  columnSpan = 1,
): Promise<TableCell> {
  const { runs } = await segmentsToRuns(segments, style, ctx)
  return new TableCell({
    columnSpan: columnSpan > 1 ? columnSpan : undefined,
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: {
          before: 0,
          after: 0,
          line: lineSpacingPx(style.linePx, style.sizePx),
          lineRule: 'atLeast',
        },
        children:
          runs.length > 0
            ? runs
            : [new TextRun({ text: '', font: runFont(), size: pxToHalfPoints(style.sizePx) })],
      }),
    ],
  })
}

async function buildMathCell(
  tex: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  columnSpan = 1,
): Promise<TableCell> {
  const img = await renderMathToPng(tex, false, style.sizePx, ctx)
  const cellWidth = pxToDxa(img.width + 4)

  return new TableCell({
    columnSpan: columnSpan > 1 ? columnSpan : undefined,
    width: { size: cellWidth, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: 'center',
        spacing: { before: 0, after: 0 },
        children: [await imageRunFromPngSized(img.data, img.width, img.height)],
      }),
    ],
  })
}

async function buildDisplayMathCell(
  tex: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  columnSpan: number,
  contentWidthDxa: number,
): Promise<TableCell> {
  const img = await renderMathToPng(tex, true, style.sizePx, ctx)

  return new TableCell({
    columnSpan,
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: 'center',
        spacing: {
          before: pxToTwips(6),
          after: pxToTwips(6),
          line: lineSpacingPx(style.linePx, style.sizePx),
          lineRule: 'atLeast',
        },
        children: [await imageRunFromPngSized(img.data, img.width, img.height)],
      }),
    ],
  })
}

async function buildInlineRow(
  cells: InlineCell[],
  maxCols: number,
  style: TextStyleSpec,
  ctx: ExportContext,
): Promise<TableRow> {
  const effectiveCells = cells.length > 0 ? cells : [{ kind: 'text' as const, segments: [] }]
  const tableCells: TableCell[] = []
  let usedCols = 0

  for (let index = 0; index < effectiveCells.length; index += 1) {
    const cell = effectiveCells[index]
    const isLast = index === effectiveCells.length - 1
    const columnSpan = isLast ? Math.max(1, maxCols - usedCols) : 1
    usedCols += columnSpan

    if (cell.kind === 'math') {
      tableCells.push(await buildMathCell(cell.tex, style, ctx, columnSpan))
    } else {
      tableCells.push(await buildTextCell(cell.segments, style, ctx, columnSpan))
    }
  }

  return new TableRow({ cantSplit: true, children: tableCells })
}

async function buildQuestionContentTable(
  questionText: string,
  style: TextStyleSpec,
  showDifficulty: boolean,
  block: WorksheetBlock,
  ctx: ExportContext,
): Promise<Table> {
  const segments = parseContent(questionText)
  const lines = splitQuestionIntoLines(segments)
  const maxCols = maxInlineColumnCount(lines)
  const contentWidthDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth)
  const rows: TableRow[] = []

  for (const line of lines) {
    if (line.kind === 'display') {
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [await buildDisplayMathCell(line.tex, style, ctx, maxCols, contentWidthDxa)],
        }),
      )
      continue
    }

    rows.push(await buildInlineRow(line.cells, maxCols, style, ctx))
  }

  if (showDifficulty) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: maxCols,
            width: { size: contentWidthDxa, type: WidthType.DXA },
            borders: hiddenCellBorders(),
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
            children: [await buildDifficultyParagraph(block, ctx)],
          }),
        ],
      }),
    )
  }

  if (rows.length === 0) {
    rows.push(await buildInlineRow([], maxCols, style, ctx))
  }

  return new Table({
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    rows,
  })
}

export async function buildTaskHeadTable(
  taskNumber: number | null,
  questionText: string,
  isAnswerBlock: boolean,
  block: WorksheetBlock,
  ctx: ExportContext,
): Promise<Table> {
  const numStyle = isAnswerBlock ? TYPO.answerTaskNum : TYPO.taskNum
  const qStyle = isAnswerBlock ? TYPO.answerTaskQuestion : TYPO.taskQuestion
  const numColor = isAnswerBlock ? COLORS.textSecondary : COLORS.textDefault
  const showDifficulty = ctx.options.showDifficulty && (isAnswerBlock || !!block.difficulty)

  const numCellWidth = pxToDxa(LAYOUT.taskNumWidth)
  const contentWidthDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth)

  const segments = parseContent(questionText)
  const lines = splitQuestionIntoLines(segments)
  let nestedRowCount = lines.length
  if (showDifficulty) nestedRowCount += 1
  if (nestedRowCount === 0) nestedRowCount = 1

  const contentTable = await buildQuestionContentTable(
    questionText,
    qStyle,
    showDifficulty,
    block,
    ctx,
  )

  const numCell = new TableCell({
    rowSpan: nestedRowCount,
    width: { size: numCellWidth, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: 'center',
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: taskNumber != null ? `${taskNumber}.` : '',
            font: runFont(),
            size: pxToHalfPoints(numStyle.sizePx),
            color: numColor,
          }),
        ],
      }),
    ],
  })

  const contentCell = new TableCell({
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [contentTable],
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [numCellWidth, contentWidthDxa],
    rows: [new TableRow({ cantSplit: true, children: [numCell, contentCell] })],
  })
}
