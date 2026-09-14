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
  TEXT_CELL_PADDING_PX,
  fitFontScale,
  measureInlineLineWidthPx,
  scaleColumnWidthsToMax,
  scaleColumnWidthsToMin,
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
}

export function buildWidgetBodyRow(
  grid: TaskHeadGrid,
  paragraphs: Paragraph[],
  widgetWidthDxa: number,
): TableRow {
  return new TableRow({
    cantSplit: true,
    children: [
      buildEmptyNumCell(grid.numCellWidthDxa),
      new TableCell({
        columnSpan: grid.maxContentCols,
        width: { size: widgetWidthDxa, type: WidthType.DXA },
        borders: hiddenCellBorders(),
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
  return buildWidgetBodyRow(grid, paragraphs, grid.contentWidthDxa)
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
    tabStops: [],
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
): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        tabStops: [],
        spacing: paragraphLineSpacing(style),
        children:
          runs.length > 0
            ? runs
            : [new TextRun({ text: '', font: runFont(), size: pxToHalfPoints(style.sizePx) })],
      }),
    ],
  })
}

function buildMathCell(widthDxa: number, imageRun: ImageRun): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
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
  numCellWidthDxa: number,
  maxTableWidthDxa: number,
  maxContentWidthPx: number,
  minContentWidthDxa?: number,
): Promise<{ cells: TableCell[]; columnWidthsDxa: number[] }> {
  const lineStyle = await fitInlineLineStyle(cells, style, ctx, maxContentWidthPx)
  const effectiveCells = cells.length > 0 ? cells : [{ kind: 'text' as const, segments: [] }]
  const mathImages = new Map<string, MathImageResult>()
  const tableCells: TableCell[] = []
  let columnWidthsDxa: number[] = []

  for (const cell of effectiveCells) {
    if (cell.kind === 'math') {
      const img = await renderMathToPng(cell.tex, false, lineStyle.sizePx, ctx)
      mathImages.set(cell.tex, img)
    }
  }

  for (const cell of effectiveCells) {
    if (cell.kind === 'math') {
      const img = mathImages.get(cell.tex)!
      columnWidthsDxa.push(pxToDxa(img.width + MATH_CELL_PADDING_PX))
      continue
    }
    columnWidthsDxa.push(pxToDxa(textCellWidthPx(cell.segments, lineStyle.sizePx)))
  }

  columnWidthsDxa = scaleColumnWidthsToMax(
    [numCellWidthDxa, ...columnWidthsDxa],
    maxTableWidthDxa,
    1,
  ).slice(1)

  if (minContentWidthDxa != null) {
    columnWidthsDxa = scaleColumnWidthsToMin(
      [numCellWidthDxa, ...columnWidthsDxa],
      minContentWidthDxa,
      1,
    ).slice(1)
  }

  for (let index = 0; index < effectiveCells.length; index += 1) {
    const cell = effectiveCells[index]
    const widthDxa = columnWidthsDxa[index] ?? pxToDxa(TEXT_CELL_PADDING_PX)

    if (cell.kind === 'math') {
      const img = mathImages.get(cell.tex)!
      const imageRun = await imageRunFromPngSized(img.data, img.width, img.height)
      tableCells.push(buildMathCell(widthDxa, imageRun))
      continue
    }

    const { runs } = await segmentsToRuns(cell.segments, lineStyle, ctx)
    tableCells.push(buildTextCell(runs, lineStyle, widthDxa))
  }

  return { cells: tableCells, columnWidthsDxa }
}

async function buildDisplayContentCell(
  tex: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  contentWidthDxa: number,
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
  const { extraRows, contentWidthCapDxa } = options
  const numStyle = isAnswerBlock ? TYPO.answerTaskNum : TYPO.taskNum
  const qStyle = isAnswerBlock ? TYPO.answerTaskQuestion : TYPO.taskQuestion
  const numColor = isAnswerBlock ? COLORS.textSecondary : COLORS.textDefault
  const showDifficulty = ctx.options.showDifficulty && (isAnswerBlock || !!block.difficulty)

  const numCellWidthDxa = pxToDxa(LAYOUT.taskNumWidth)
  const maxContentWidthPx = MAX_CONTENT_WIDTH_PX
  const maxTableWidthDxa = pxToDxa(SHEET_CONTENT_WIDTH_PX)
  const contentWidthDxa = contentWidthCapDxa ?? pxToDxa(SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth)
  const lines = splitQuestionIntoLines(parseContent(questionText))
  const maxContentCols = maxInlineCellCount(lines)
  const rows: TableRow[] = []
  let firstRowColumnWidths: number[] = [numCellWidthDxa]

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const rowChildren: TableCell[] = []

    if (lineIndex === 0) {
      rowChildren.push(buildNumCell(taskNumber, numStyle, numColor, numCellWidthDxa))
    } else {
      rowChildren.push(buildEmptyNumCell(numCellWidthDxa))
    }

    if (line.kind === 'display') {
      rowChildren.push(await buildDisplayContentCell(line.tex, qStyle, ctx, contentWidthDxa))
      if (lineIndex === 0) {
        firstRowColumnWidths = scaleColumnWidthsToMin(
          [numCellWidthDxa, contentWidthDxa],
          contentWidthCapDxa ?? contentWidthDxa,
          1,
        )
      }
    } else {
      const { cells, columnWidthsDxa } = await buildInlineContentCells(
        line.cells,
        qStyle,
        ctx,
        numCellWidthDxa,
        maxTableWidthDxa,
        maxContentWidthPx,
        lineIndex === 0 ? contentWidthCapDxa : undefined,
      )
      rowChildren.push(...cells)
      if (lineIndex === 0) {
        firstRowColumnWidths = scaleColumnWidthsToMax(
          [numCellWidthDxa, ...columnWidthsDxa],
          maxTableWidthDxa,
          1,
        )
        if (contentWidthCapDxa != null) {
          firstRowColumnWidths = scaleColumnWidthsToMin(firstRowColumnWidths, contentWidthCapDxa, 1)
        }
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
    const contentWidthFromFirstRow =
      contentWidthCapDxa ??
      firstRowColumnWidths.slice(1).reduce((sum, width) => sum + width, 0)

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
    const { cells, columnWidthsDxa } = await buildInlineContentCells(
      [],
      qStyle,
      ctx,
      numCellWidthDxa,
      maxTableWidthDxa,
      maxContentWidthPx,
    )
    firstRowColumnWidths = scaleColumnWidthsToMax(
      [numCellWidthDxa, ...columnWidthsDxa],
      maxTableWidthDxa,
      1,
    )
    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(qStyle),
        children: [buildNumCell(taskNumber, numStyle, numColor, numCellWidthDxa), ...cells],
      }),
    )
  }

  const grid: TaskHeadGrid = {
    maxContentCols,
    numCellWidthDxa,
    contentWidthDxa:
      contentWidthCapDxa ??
      firstRowColumnWidths.slice(1).reduce((sum, width) => sum + width, 0),
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
