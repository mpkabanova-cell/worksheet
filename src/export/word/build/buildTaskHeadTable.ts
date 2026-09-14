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
import type { MathImageResult } from '@/export/word/types'
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

const MATH_CELL_PADDING_PX = 4
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

function buildNumCell(
  taskNumber: number | null,
  numStyle: TextStyleSpec,
  numColor: string,
  rowSpan: number,
  numCellWidth: number,
): TableCell {
  return new TableCell({
    rowSpan,
    width: { size: numCellWidth, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 100 },
    verticalAlign: VerticalAlignTable.CENTER,
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
}

function buildTextCell(
  runs: (TextRun | ImageRun)[],
  style: TextStyleSpec,
  widthDxa: number,
): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlignTable.CENTER,
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

function buildMathCell(widthDxa: number, imageRun: ImageRun): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: hiddenCellBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [imageRun],
      }),
    ],
  })
}

async function buildInlineContentCells(
  cells: InlineCell[],
  style: TextStyleSpec,
  ctx: ExportContext,
  contentWidthPx: number,
): Promise<TableCell[]> {
  const effectiveCells = cells.length > 0 ? cells : [{ kind: 'text' as const, segments: [] }]
  const mathImages = new Map<string, MathImageResult>()

  let totalMathPx = 0
  for (const cell of effectiveCells) {
    if (cell.kind !== 'math') continue
    const img = await renderMathToPng(cell.tex, false, style.sizePx, ctx)
    mathImages.set(cell.tex, img)
    totalMathPx += img.width + MATH_CELL_PADDING_PX
  }

  const textCellCount = effectiveCells.filter((cell) => cell.kind === 'text').length
  const remainingPx = Math.max(0, contentWidthPx - totalMathPx)
  const textCellWidthPx =
    textCellCount > 0 ? Math.max(1, Math.floor(remainingPx / textCellCount)) : 0

  const tableCells: TableCell[] = []

  for (const cell of effectiveCells) {
    if (cell.kind === 'math') {
      const img = mathImages.get(cell.tex)!
      const widthDxa = pxToDxa(img.width + MATH_CELL_PADDING_PX)
      const imageRun = await imageRunFromPngSized(img.data, img.width, img.height)
      tableCells.push(buildMathCell(widthDxa, imageRun))
      continue
    }

    const { runs } = await segmentsToRuns(cell.segments, style, ctx)
    tableCells.push(buildTextCell(runs, style, pxToDxa(textCellWidthPx)))
  }

  return tableCells
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
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlignTable.CENTER,
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
  const contentWidthPx = SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth
  const contentWidthDxa = pxToDxa(contentWidthPx)

  const lines = splitQuestionIntoLines(parseContent(questionText))
  const totalRows = Math.max(1, lines.length + (showDifficulty ? 1 : 0))
  const rows: TableRow[] = []
  let numCellAttached = false

  for (const line of lines) {
    const rowChildren: TableCell[] = []

    if (!numCellAttached) {
      rowChildren.push(buildNumCell(taskNumber, numStyle, numColor, totalRows, numCellWidth))
      numCellAttached = true
    }

    if (line.kind === 'display') {
      rowChildren.push(await buildDisplayContentCell(line.tex, qStyle, ctx, contentWidthDxa))
    } else {
      rowChildren.push(...(await buildInlineContentCells(line.cells, qStyle, ctx, contentWidthPx)))
    }

    rows.push(new TableRow({ cantSplit: true, children: rowChildren }))
  }

  if (showDifficulty) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: contentWidthDxa, type: WidthType.DXA },
            borders: hiddenCellBorders(),
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlignTable.CENTER,
            children: [await buildDifficultyParagraph(block, ctx)],
          }),
        ],
      }),
    )
  }

  if (rows.length === 0) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          buildNumCell(taskNumber, numStyle, numColor, 1, numCellWidth),
          ...(await buildInlineContentCells([], qStyle, ctx, contentWidthPx)),
        ],
      }),
    )
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: hiddenCellBorders(),
    rows,
  })
}
