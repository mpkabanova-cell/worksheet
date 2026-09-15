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
import { getTaskQuestionWidthPx } from '@/export/word/layoutSpec'
import { parseContent, type ContentSegment } from '@/export/word/richText/parseRichText'
import { renderMathToPng } from '@/export/word/richText/mathToImage'
import {
  fitFontScale,
  measureInlineLineWidthPx,
  wrapInlineCells,
} from '@/export/word/richText/measureTextWidth'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'
import {
  imageRunFromPng,
  imageRunFromPngSized,
  segmentsToRuns,
} from '@/export/word/richText/toDocxContent'
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

const CELL_MARGIN_TWIPS = 0
const NUM_CELL_MARGIN_RIGHT_TWIPS = 0
const DIFFICULTY_CELL_MARGIN_TWIPS = 40
const MIN_QUESTION_FONT_PX = 12
const HIDDEN_BORDER = { style: BorderStyle.NONE, size: 0, color: COLORS.white } as const

function pxToDxaCeil(px: number): number {
  return Math.ceil(px * 15)
}

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

function rowHeight(style: TextStyleSpec, extraPx = 6) {
  return {
    value: pxToTwips(style.linePx + extraPx),
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
  maxContentWidthPx: number,
): Promise<TextStyleSpec> {
  let sizePx = baseStyle.sizePx
  let linePx = baseStyle.linePx

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const mathWidths = await collectMathWidthsPx(cells, sizePx, ctx)
    const totalWidth = measureInlineLineWidthPx(cells, sizePx, mathWidths)
    const { sizePx: nextSize, linePx: nextLine, fits } = fitFontScale(
      totalWidth,
      maxContentWidthPx,
      sizePx,
      linePx,
      MIN_QUESTION_FONT_PX,
    )

    if (fits || nextSize === sizePx) {
      return { ...baseStyle, sizePx, linePx }
    }

    sizePx = nextSize
    linePx = nextLine
  }

  return { ...baseStyle, sizePx, linePx }
}

async function expandQuestionLinesWithWrap(
  lines: QuestionLine[],
  style: TextStyleSpec,
  ctx: ExportContext,
  maxContentWidthPx: number,
): Promise<QuestionLine[]> {
  const expanded: QuestionLine[] = []

  for (const line of lines) {
    if (line.kind !== 'inline') {
      expanded.push(line)
      continue
    }

    const lineStyle = await fitInlineLineStyle(line.cells, style, ctx, maxContentWidthPx)
    const mathWidths = await collectMathWidthsPx(line.cells, lineStyle.sizePx, ctx)
    const fittedWidth = measureInlineLineWidthPx(line.cells, lineStyle.sizePx, mathWidths)
    const wrappedCells =
      fittedWidth <= maxContentWidthPx
        ? [line.cells]
        : wrapInlineCells(line.cells, maxContentWidthPx, lineStyle.sizePx, mathWidths)

    for (const cells of wrappedCells) {
      expanded.push({ kind: 'inline', cells })
    }
  }

  return expanded.length > 0 ? expanded : lines
}

export type TaskHeadGrid = {
  maxContentCols: number
  numCellWidthDxa: number
  contentWidthDxa: number
}

export type TaskHeadExtraRows = (grid: TaskHeadGrid) => TableRow[] | Promise<TableRow[]>

export type TaskHeadTableOptions = {
  extraRows?: TaskHeadExtraRows
  /** Cap content area width (e.g. to raster widget width). */
  contentWidthCapDxa?: number
  /** Pad question row with empty column up to contentWidthCapDxa (matching widgets only). */
  padQuestionRowToCap?: boolean
}

export type WidgetBodyRowOptions = {
  /** Left inset inside the widget cell (choice slot padding on platform). */
  cellMarginLeftPx?: number
  /** Uniform inset on all sides (matching widget). */
  cellMarginPx?: number
}

export function buildWidgetBodyRow(
  grid: TaskHeadGrid,
  paragraphs: Paragraph[],
  options: WidgetBodyRowOptions = {},
): TableRow {
  const cellMarginLeftPx = options.cellMarginLeftPx ?? options.cellMarginPx ?? 0
  const cellMarginPx = options.cellMarginPx ?? 0

  return new TableRow({
    cantSplit: true,
    children: [
      buildEmptyNumCell(grid.numCellWidthDxa),
      new TableCell({
        columnSpan: grid.maxContentCols,
        width: { size: grid.contentWidthDxa, type: WidthType.DXA },
        borders: hiddenCellBorders(),
        margins: {
          top: pxToTwips(cellMarginPx),
          bottom: pxToTwips(cellMarginPx),
          left: pxToTwips(cellMarginLeftPx || cellMarginPx),
          right: pxToTwips(cellMarginPx),
        },
        verticalAlign: VerticalAlignTable.TOP,
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun({ text: '' })] })],
      }),
    ],
  })
}

/** @deprecated Use buildWidgetBodyRow when widget width is known. */
export function buildBodyContentRow(
  grid: TaskHeadGrid,
  paragraphs: Paragraph[],
): TableRow {
  return buildWidgetBodyRow(grid, paragraphs)
}

async function buildDifficultyParagraph(
  block: WorksheetBlock,
  ctx: ExportContext,
  keepNext = false,
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
    tabStops: [],
    keepNext,
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
  keepNext = false,
): TableCell {
  return new TableCell({
    width: { size: numCellWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: {
      top: CELL_MARGIN_TWIPS,
      bottom: CELL_MARGIN_TWIPS,
      left: 0,
      right: NUM_CELL_MARGIN_RIGHT_TWIPS,
    },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        alignment: 'center',
        keepNext,
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

function buildEmptyNumCell(numCellWidthDxa: number, keepNext = false): TableCell {
  return new TableCell({
    width: { size: numCellWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: {
      top: CELL_MARGIN_TWIPS,
      bottom: CELL_MARGIN_TWIPS,
      left: 0,
      right: NUM_CELL_MARGIN_RIGHT_TWIPS,
    },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        keepNext,
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
        tabStops: [],
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

function buildPaddingCell(widthDxa: number, style: TextStyleSpec, keepNext = false): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        tabStops: [],
        keepNext,
        spacing: paragraphLineSpacing(style),
        children: [new TextRun({ text: '', font: runFont(), size: pxToHalfPoints(style.sizePx) })],
      }),
    ],
  })
}

function inlineCellsToSegments(cells: InlineCell[]): ContentSegment[] {
  const segments: ContentSegment[] = []

  for (const cell of cells) {
    if (cell.kind === 'math') {
      segments.push({ kind: 'math', value: cell.tex, display: false })
      continue
    }
    segments.push(...cell.segments)
  }

  return segments
}

async function buildInlineContentCells(
  cells: InlineCell[],
  style: TextStyleSpec,
  ctx: ExportContext,
  maxContentWidthPx: number,
  keepNext = false,
): Promise<{ cells: TableCell[]; columnWidthsDxa: number[] }> {
  const effectiveCells = cells.length > 0 ? cells : [{ kind: 'text' as const, segments: [] }]
  const lineStyle = await fitInlineLineStyle(effectiveCells, style, ctx, maxContentWidthPx)
  const mathWidths = await collectMathWidthsPx(effectiveCells, lineStyle.sizePx, ctx)
  const contentWidthPx = measureInlineLineWidthPx(effectiveCells, lineStyle.sizePx, mathWidths)
  const contentWidthDxa = pxToDxaCeil(contentWidthPx)
  const segments = inlineCellsToSegments(effectiveCells)
  const { runs } = await segmentsToRuns(segments, lineStyle, ctx)

  return {
    cells: [buildTextCell(runs, lineStyle, contentWidthDxa, keepNext)],
    columnWidthsDxa: [contentWidthDxa],
  }
}

async function buildDisplayContentCell(
  tex: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  contentWidthDxa: number,
  keepNext = false,
): Promise<TableCell> {
  const img = await renderMathToPng(tex, true, style.sizePx, ctx)

  return new TableCell({
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        alignment: 'center',
        keepNext,
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
  options: TaskHeadTableOptions = {},
): Promise<Table> {
  const { extraRows, contentWidthCapDxa, padQuestionRowToCap = false } = options
  const numStyle = isAnswerBlock ? TYPO.answerTaskNum : TYPO.taskNum
  const qStyle = isAnswerBlock ? TYPO.answerTaskQuestion : TYPO.taskQuestion
  const numColor = isAnswerBlock ? COLORS.textSecondary : COLORS.textDefault
  const showDifficulty = ctx.options.showDifficulty && (isAnswerBlock || !!block.difficulty)

  const numCellWidthDxa = pxToDxa(LAYOUT.taskNumWidth)
  const maxContentWidthPx = getTaskQuestionWidthPx(contentWidthCapDxa)
  const contentWidthDxa = contentWidthCapDxa ?? pxToDxa(SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth)
  const lines = await expandQuestionLinesWithWrap(
    splitQuestionIntoLines(parseContent(questionText)),
    qStyle,
    ctx,
    maxContentWidthPx,
  )
  let maxContentCols = 1
  const rows: TableRow[] = []
  let firstRowColumnWidths: number[] = [numCellWidthDxa]
  let paddingColDxa = 0
  const hasExtraRows = extraRows != null

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const rowChildren: TableCell[] = []
    const rowKeepNext = hasExtraRows || lineIndex < lines.length - 1 || showDifficulty

    if (lineIndex === 0) {
      rowChildren.push(buildNumCell(taskNumber, numStyle, numColor, numCellWidthDxa, rowKeepNext))
    } else {
      rowChildren.push(buildEmptyNumCell(numCellWidthDxa, rowKeepNext))
    }

    if (line.kind === 'display') {
      rowChildren.push(await buildDisplayContentCell(line.tex, qStyle, ctx, contentWidthDxa, rowKeepNext))
      if (lineIndex === 0) {
        firstRowColumnWidths = [numCellWidthDxa, contentWidthDxa]
      }
    } else {
      const { cells, columnWidthsDxa } = await buildInlineContentCells(
        line.cells,
        qStyle,
        ctx,
        maxContentWidthPx,
        rowKeepNext,
      )
      rowChildren.push(...cells)
      if (lineIndex === 0) {
        firstRowColumnWidths = [numCellWidthDxa, ...columnWidthsDxa]
        if (contentWidthCapDxa != null && padQuestionRowToCap) {
          const contentSum = columnWidthsDxa.reduce((sum, width) => sum + width, 0)
          if (contentSum < contentWidthCapDxa) {
            paddingColDxa = contentWidthCapDxa - contentSum
            rowChildren.push(buildPaddingCell(paddingColDxa, qStyle, rowKeepNext))
            firstRowColumnWidths.push(paddingColDxa)
            maxContentCols = 2
          }
        }
      } else if (paddingColDxa > 0) {
        rowChildren.push(buildPaddingCell(paddingColDxa, qStyle, rowKeepNext))
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
    const contentWidthFromFirstRow = firstRowColumnWidths.slice(1).reduce((sum, width) => sum + width, 0)

    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(TYPO.difficulty, 8),
        children: [
          buildEmptyNumCell(numCellWidthDxa, hasExtraRows),
          new TableCell({
            columnSpan: maxContentCols,
            width: {
              size: Math.max(contentWidthFromFirstRow, pxToDxa(120)),
              type: WidthType.DXA,
            },
            borders: hiddenCellBorders(),
            margins: {
              top: DIFFICULTY_CELL_MARGIN_TWIPS,
              bottom: DIFFICULTY_CELL_MARGIN_TWIPS,
              left: 0,
              right: 0,
            },
            verticalAlign: VerticalAlignTable.CENTER,
            children: [await buildDifficultyParagraph(block, ctx, hasExtraRows)],
          }),
        ],
      }),
    )
  }

  if (rows.length === 0) {
    const { cells, columnWidthsDxa } = await buildInlineContentCells([], qStyle, ctx, maxContentWidthPx)
    firstRowColumnWidths = [numCellWidthDxa, ...columnWidthsDxa]
    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(qStyle),
        children: [buildNumCell(taskNumber, numStyle, numColor, numCellWidthDxa), ...cells],
      }),
    )
  }

  const contentSumFromFirstRow = firstRowColumnWidths.slice(1).reduce((sum, width) => sum + width, 0)
  const grid: TaskHeadGrid = {
    maxContentCols,
    numCellWidthDxa,
    contentWidthDxa: Math.max(contentSumFromFirstRow, contentWidthCapDxa ?? 0),
  }

  if (extraRows) {
    const appended = await extraRows(grid)
    rows.push(...appended)
  }

  const tableWidthDxa = firstRowColumnWidths.reduce((sum, width) => sum + width, 0)

  return new Table({
    width: { size: tableWidthDxa, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: firstRowColumnWidths,
    borders: hiddenCellBorders(),
    rows,
  })
}
