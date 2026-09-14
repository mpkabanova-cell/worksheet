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
  pxToDxa,
  pxToHalfPoints,
  pxToTwips,
  runFont,
} from '@/export/word/layoutTokens'
import { parseContent, type ContentSegment } from '@/export/word/richText/parseRichText'
import { renderMathToPng } from '@/export/word/richText/mathToImage'
import {
  MATH_CELL_PADDING_PX,
  fitFontScale,
  measureInlineLineWidthPx,
  textCellWidthPx,
} from '@/export/word/richText/measureTextWidth'
import type { MathImageResult } from '@/export/word/types'
import {
  imageRunFromPng,
  imageRunFromPngSized,
  segmentsToRuns,
} from '@/export/word/richText/toDocxContent'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'
import {
  BorderStyle,
  HeightRule,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx'

type InlineCell =
  | { kind: 'text'; segments: ContentSegment[] }
  | { kind: 'math'; tex: string }

type QuestionLine =
  | { kind: 'inline'; cells: InlineCell[] }
  | { kind: 'display'; tex: string }

const CELL_MARGIN_TWIPS = 40
const MIN_QUESTION_FONT_PX = 12
const MAX_CONTENT_WIDTH_PX = SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth
const HIDDEN_BORDER = { style: BorderStyle.NONE, size: 0, color: COLORS.white } as const

function hiddenCellBorders() {
  return {
    top: HIDDEN_BORDER,
    bottom: HIDDEN_BORDER,
    left: HIDDEN_BORDER,
    right: HIDDEN_BORDER,
  }
}

function cellMargins() {
  return {
    top: CELL_MARGIN_TWIPS,
    bottom: CELL_MARGIN_TWIPS,
    left: 0,
    right: 0,
  }
}

function paragraphLineSpacing(style: TextStyleSpec) {
  return {
    before: 0,
    after: 0,
    line: pxToTwips(style.linePx),
    lineRule: 'exact' as const,
  }
}

function rowHeight(style: TextStyleSpec) {
  return {
    value: pxToTwips(style.linePx + 8),
    rule: HeightRule.ATLEAST,
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

function maxInlineCellCount(lines: QuestionLine[]): number {
  const counts = lines
    .filter((line): line is Extract<QuestionLine, { kind: 'inline' }> => line.kind === 'inline')
    .map((line) => Math.max(1, line.cells.length))
  return Math.max(1, ...counts)
}

async function collectMathWidthsPx(
  cells: InlineCell[],
  fontSizePx: number,
  ctx: ExportContext,
): Promise<Map<string, number>> {
  const widths = new Map<string, number>()

  for (const cell of cells) {
    if (cell.kind !== 'math' || widths.has(cell.tex)) continue
    const img = await renderMathToPng(cell.tex, false, fontSizePx, ctx)
    widths.set(cell.tex, img.width)
  }

  return widths
}

async function fitInlineLineStyle(
  cells: InlineCell[],
  baseStyle: TextStyleSpec,
  ctx: ExportContext,
): Promise<TextStyleSpec> {
  const mathWidths = await collectMathWidthsPx(cells, baseStyle.sizePx, ctx)
  const totalWidth = measureInlineLineWidthPx(cells, baseStyle.sizePx, mathWidths)
  const { sizePx, linePx } = fitFontScale(
    totalWidth,
    MAX_CONTENT_WIDTH_PX,
    baseStyle.sizePx,
    baseStyle.linePx,
    MIN_QUESTION_FONT_PX,
  )

  if (sizePx === baseStyle.sizePx) {
    return baseStyle
  }

  return { ...baseStyle, sizePx, linePx }
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
    spacing: {
      before: pxToTwips(4),
      after: pxToTwips(4),
      line: pxToTwips(TYPO.difficulty.linePx),
      lineRule: 'exact',
    },
    children,
  })
}

function buildNumCell(
  taskNumber: number | null,
  numStyle: TextStyleSpec,
  numColor: string,
  numCellWidthDxa: number,
): TableCell {
  return new TableCell({
    width: { size: numCellWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: CELL_MARGIN_TWIPS, bottom: CELL_MARGIN_TWIPS, left: 0, right: 100 },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        alignment: 'center',
        spacing: paragraphLineSpacing(numStyle),
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
}

function buildEmptyNumCell(numCellWidthDxa: number): TableCell {
  return new TableCell({
    width: { size: numCellWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: CELL_MARGIN_TWIPS, bottom: CELL_MARGIN_TWIPS, left: 0, right: 100 },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        spacing: paragraphLineSpacing(TYPO.taskNum),
        children: [
          new TextRun({
            text: '',
            font: runFont(),
            size: pxToHalfPoints(TYPO.taskNum.sizePx),
          }),
        ],
      }),
    ],
  })
}

function buildTextCell(
  runs: (TextRun | ImageRun)[],
  style: TextStyleSpec,
  widthDxa: number,
  keepNext = false,
): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        keepNext,
        spacing: paragraphLineSpacing(style),
        children:
          runs.length > 0
            ? runs
            : [new TextRun({ text: '', font: runFont(), size: pxToHalfPoints(style.sizePx) })],
      }),
    ],
  })
}

function buildMathCell(widthDxa: number, imageRun: ImageRun, keepNext = false): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        keepNext,
        spacing: { before: 0, after: 0, lineRule: 'exact' },
        children: [imageRun],
      }),
    ],
  })
}

async function buildInlineContentCells(
  cells: InlineCell[],
  style: TextStyleSpec,
  ctx: ExportContext,
  keepNextOnLast: boolean,
): Promise<{ cells: TableCell[]; columnWidthsDxa: number[] }> {
  const lineStyle = await fitInlineLineStyle(cells, style, ctx)
  const effectiveCells = cells.length > 0 ? cells : [{ kind: 'text' as const, segments: [] }]
  const mathImages = new Map<string, MathImageResult>()
  const tableCells: TableCell[] = []
  const columnWidthsDxa: number[] = []

  for (const cell of effectiveCells) {
    if (cell.kind === 'math') {
      const img = await renderMathToPng(cell.tex, false, lineStyle.sizePx, ctx)
      mathImages.set(cell.tex, img)
    }
  }

  for (let index = 0; index < effectiveCells.length; index += 1) {
    const cell = effectiveCells[index]
    const isLast = index === effectiveCells.length - 1
    const keepNext = keepNextOnLast && isLast

    if (cell.kind === 'math') {
      const img = mathImages.get(cell.tex)!
      const widthDxa = pxToDxa(img.width + MATH_CELL_PADDING_PX)
      const imageRun = await imageRunFromPngSized(img.data, img.width, img.height)
      tableCells.push(buildMathCell(widthDxa, imageRun, keepNext))
      columnWidthsDxa.push(widthDxa)
      continue
    }

    const widthPx = textCellWidthPx(cell.segments, lineStyle.sizePx)
    const widthDxa = pxToDxa(widthPx)
    const { runs } = await segmentsToRuns(cell.segments, lineStyle, ctx)
    tableCells.push(buildTextCell(runs, lineStyle, widthDxa, keepNext))
    columnWidthsDxa.push(widthDxa)
  }

  return { cells: tableCells, columnWidthsDxa }
}

async function buildDisplayContentCell(
  tex: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  contentWidthDxa: number,
  keepNext: boolean,
): Promise<TableCell> {
  const img = await renderMathToPng(tex, true, style.sizePx, ctx)

  return new TableCell({
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        keepNext,
        alignment: 'center',
        spacing: {
          before: pxToTwips(6),
          after: pxToTwips(6),
          line: pxToTwips(style.linePx),
          lineRule: 'exact',
        },
        children: [await imageRunFromPngSized(img.data, img.width, img.height)],
      }),
    ],
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

  const numCellWidthDxa = pxToDxa(LAYOUT.taskNumWidth)
  const contentWidthDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth)
  const lines = splitQuestionIntoLines(parseContent(questionText))
  const maxContentCols = maxInlineCellCount(lines)
  const rows: TableRow[] = []
  let firstRowColumnWidths: number[] = [numCellWidthDxa]

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const isLastConditionLine = lineIndex === lines.length - 1
    const hasMoreConditionLines = lineIndex < lines.length - 1
    const keepNextOnLastCell = hasMoreConditionLines || (isLastConditionLine && showDifficulty)
    const rowChildren: TableCell[] = []

    if (lineIndex === 0) {
      rowChildren.push(buildNumCell(taskNumber, numStyle, numColor, numCellWidthDxa))
    } else {
      rowChildren.push(buildEmptyNumCell(numCellWidthDxa))
    }

    if (line.kind === 'display') {
      rowChildren.push(
        await buildDisplayContentCell(line.tex, qStyle, ctx, contentWidthDxa, keepNextOnLastCell),
      )
      if (lineIndex === 0) {
        firstRowColumnWidths = [numCellWidthDxa, contentWidthDxa]
      }
    } else {
      const { cells, columnWidthsDxa } = await buildInlineContentCells(
        line.cells,
        qStyle,
        ctx,
        keepNextOnLastCell,
      )
      rowChildren.push(...cells)
      if (lineIndex === 0) {
        firstRowColumnWidths = [numCellWidthDxa, ...columnWidthsDxa]
      }
    }

    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(qStyle),
        children: rowChildren,
      }),
    )
  }

  if (showDifficulty) {
    const contentWidthFromFirstRow = firstRowColumnWidths
      .slice(1)
      .reduce((sum, width) => sum + width, 0)

    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(TYPO.difficulty),
        children: [
          buildEmptyNumCell(numCellWidthDxa),
          new TableCell({
            columnSpan: maxContentCols,
            width: {
              size: Math.max(contentWidthFromFirstRow, pxToDxa(120)),
              type: WidthType.DXA,
            },
            borders: hiddenCellBorders(),
            margins: cellMargins(),
            verticalAlign: VerticalAlignTable.CENTER,
            children: [await buildDifficultyParagraph(block, ctx)],
          }),
        ],
      }),
    )
  }

  if (rows.length === 0) {
    const { cells, columnWidthsDxa } = await buildInlineContentCells([], qStyle, ctx, false)
    firstRowColumnWidths = [numCellWidthDxa, ...columnWidthsDxa]
    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(qStyle),
        children: [buildNumCell(taskNumber, numStyle, numColor, numCellWidthDxa), ...cells],
      }),
    )
  }

  const computedWidthDxa = firstRowColumnWidths.reduce((sum, width) => sum + width, 0)
  const maxTableWidthDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX)
  const tableWidthDxa = Math.min(computedWidthDxa, maxTableWidthDxa)

  return new Table({
    width: { size: tableWidthDxa, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: firstRowColumnWidths,
    borders: hiddenCellBorders(),
    rows,
  })
}
