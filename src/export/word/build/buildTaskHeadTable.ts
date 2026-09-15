import type { WorksheetBlock } from '@/data/worksheet'
import { isQuestionPlaceholder } from '@/data/blockUtils'
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
  slotBodyTopSpacingPx,
} from '@/export/word/layoutTokens'
import { getTaskQuestionWidthPx } from '@/export/word/layoutSpec'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'
import {
  imageRunFromPng,
  richParagraphs,
} from '@/export/word/richText/toDocxContent'
import {
  BorderStyle,
  HeightRule,
  Paragraph,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type ParagraphChild,
} from 'docx'

const CELL_MARGIN_TWIPS = 0
const NUM_CELL_MARGIN_RIGHT_TWIPS = 0
const HIDDEN_BORDER = { style: BorderStyle.NONE, size: 0, color: COLORS.white } as const

function hiddenCellBorders() {
  return {
    top: HIDDEN_BORDER,
    bottom: HIDDEN_BORDER,
    left: HIDDEN_BORDER,
    right: HIDDEN_BORDER,
  }
}

function questionParagraphSpacing(style: TextStyleSpec) {
  return {
    before: 0,
    after: 0,
    line: pxToTwips(style.linePx),
    lineRule: 'atLeast' as const,
  }
}

function rowHeight(style: TextStyleSpec, extraPx = 0) {
  return {
    value: pxToTwips(style.linePx + extraPx),
    rule: HeightRule.ATLEAST,
  }
}

async function buildQuestionParagraphs(
  questionText: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  keepNext = false,
): Promise<Paragraph[]> {
  const paragraphs = await richParagraphs(questionText, style, ctx, {
    spacing: questionParagraphSpacing(style),
    keepNext,
  })

  return paragraphs.map((paragraph, index) =>
    index === 0
      ? paragraph
      : new Paragraph({
          ...paragraph,
          keepNext,
        }),
  )
}

export type TaskHeadGrid = {
  maxContentCols: number
  numCellWidthDxa: number
  contentWidthDxa: number
}

export type TaskHeadExtraRows = (grid: TaskHeadGrid) => TableRow[] | Promise<TableRow[]>

export type TaskHeadTableLayoutDebug = {
  blockId: string
  blockType: WorksheetBlock['type']
  isAnswerBlock: boolean
  showAnswerPass: boolean
  questionFontSizePx: number
  numColor: string
  maxContentWidthPx: number
  contentWidthDxa: number
  firstRowColumnWidthsDxa: number[]
  lineCount: number
  paragraphCount: number
}

export type TaskHeadTableOptions = {
  extraRows?: TaskHeadExtraRows
  /** Cap content area width (e.g. to raster widget width). */
  contentWidthCapDxa?: number
  /** Pad question row with empty column up to contentWidthCapDxa (matching widgets only). */
  padQuestionRowToCap?: boolean
  /** Test/diagnostic hook: called with layout metrics before returning the table. */
  onLayout?: (layout: TaskHeadTableLayoutDebug) => void
  /** Which export pass is building this table (student vs answers sheet). */
  showAnswerPass?: boolean
}

export type WidgetBodyRowOptions = {
  /** Top inset: .ws-task gap + .ws-task-slot padding-top (20px). */
  cellMarginTopPx?: number
  /** Left inset inside the widget cell (0 — aligns with question column). */
  cellMarginLeftPx?: number
  /** Uniform inset on all sides (matching widget). */
  cellMarginPx?: number
}

export function buildWidgetBodyRow(
  grid: TaskHeadGrid,
  paragraphs: Paragraph[],
  options: WidgetBodyRowOptions = {},
): TableRow {
  const cellMarginTopPx = options.cellMarginTopPx ?? slotBodyTopSpacingPx()
  const cellMarginLeftPx = options.cellMarginLeftPx ?? options.cellMarginPx ?? 0
  const cellMarginRightPx = options.cellMarginPx ?? 0
  const cellMarginBottomPx = options.cellMarginPx ?? 0

  return new TableRow({
    cantSplit: true,
    children: [
      buildEmptyNumCell(grid.numCellWidthDxa),
      new TableCell({
        columnSpan: grid.maxContentCols,
        width: { size: grid.contentWidthDxa, type: WidthType.DXA },
        borders: hiddenCellBorders(),
        margins: {
          top: pxToTwips(cellMarginTopPx),
          bottom: pxToTwips(cellMarginBottomPx),
          left: pxToTwips(cellMarginLeftPx),
          right: pxToTwips(cellMarginRightPx),
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

function difficultyParagraphSpacing() {
  return {
    before: 0,
    after: 0,
    line: pxToTwips(TYPO.difficulty.linePx),
    lineRule: 'atLeast' as const,
  }
}

/** Layout: .ws-task-meta — diff-label 80px + stars strip 60px (4 + 16 + 4 + 16 + 4 + 16). */
export function difficultyRowColumnWidthsPx(): number[] {
  const { diffLabelWidth, diffStarSizePx, diffStarGapPx } = LAYOUT
  const starsWidthPx =
    diffStarGapPx + diffStarSizePx + diffStarGapPx + diffStarSizePx + diffStarGapPx + diffStarSizePx
  return [diffLabelWidth, starsWidthPx]
}

async function buildDifficultyTable(block: WorksheetBlock, ctx: ExportContext): Promise<Table> {
  const columnWidthsPx = difficultyRowColumnWidthsPx()
  const columnWidthsDxa = columnWidthsPx.map(pxToDxa)
  const tableWidthDxa = columnWidthsDxa.reduce((sum, width) => sum + width, 0)
  const { diffStarSizePx, diffStarGapPx } = LAYOUT
  const starPitchPx = diffStarSizePx + diffStarGapPx

  const starChildren: ParagraphChild[] = []
  for (let n = 1; n <= 3; n += 1) {
    if (n > 1) {
      starChildren.push(new TextRun({ text: '\t' }))
    }
    const png =
      n <= (block.difficulty ?? 0)
        ? await getStarFilledPng(ctx, diffStarSizePx)
        : await getStarEmptyPng(ctx, diffStarSizePx)
    starChildren.push(await imageRunFromPng(png, diffStarSizePx))
  }

  return new Table({
    width: { size: tableWidthDxa, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: columnWidthsDxa,
    borders: hiddenCellBorders(),
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: columnWidthsDxa[0], type: WidthType.DXA },
            borders: hiddenCellBorders(),
            margins: {
              top: CELL_MARGIN_TWIPS,
              bottom: CELL_MARGIN_TWIPS,
              left: 0,
              right: 0,
            },
            verticalAlign: VerticalAlignTable.CENTER,
            children: [
              new Paragraph({
                spacing: difficultyParagraphSpacing(),
                children: [
                  new TextRun({
                    text: 'Сложность:',
                    font: runFont(),
                    size: pxToHalfPoints(TYPO.difficulty.sizePx),
                    color: COLORS.textSecondary,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: columnWidthsDxa[1], type: WidthType.DXA },
            borders: hiddenCellBorders(),
            margins: {
              top: CELL_MARGIN_TWIPS,
              bottom: CELL_MARGIN_TWIPS,
              left: pxToTwips(diffStarGapPx),
              right: 0,
            },
            verticalAlign: VerticalAlignTable.CENTER,
            children: [
              new Paragraph({
                spacing: difficultyParagraphSpacing(),
                tabStops: [
                  { type: TabStopType.LEFT, position: pxToTwips(starPitchPx) },
                  { type: TabStopType.LEFT, position: pxToTwips(starPitchPx * 2) },
                ],
                children: starChildren,
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function buildNumCell(
  taskNumber: number | null,
  numStyle: TextStyleSpec,
  numColor: string,
  numCellWidthDxa: number,
  keepNext = false,
  verticalAlign: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] = VerticalAlignTable.CENTER,
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
    verticalAlign,
    children: [
      new Paragraph({
        alignment: 'center',
        keepNext,
        spacing: questionParagraphSpacing(numStyle),
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
        spacing: questionParagraphSpacing(TYPO.taskNum),
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

export async function buildTaskHeadTable(
  taskNumber: number | null,
  questionText: string,
  isAnswerBlock: boolean,
  block: WorksheetBlock,
  ctx: ExportContext,
  options: TaskHeadTableOptions = {},
): Promise<Table> {
  const { extraRows, contentWidthCapDxa, onLayout, showAnswerPass = false } = options
  const numStyle = isAnswerBlock ? TYPO.answerTaskNum : TYPO.taskNum
  const qStyle = isAnswerBlock ? TYPO.answerTaskQuestion : TYPO.taskQuestion
  const numColor =
    isAnswerBlock && isQuestionPlaceholder(questionText)
      ? COLORS.textSecondary
      : COLORS.textDefault
  const showDifficulty = ctx.options.showDifficulty && (isAnswerBlock || !!block.difficulty)
  const difficultyTopGapPx = isAnswerBlock ? LAYOUT.answerTaskMainGap : LAYOUT.taskMainGap

  const numCellWidthDxa = pxToDxa(LAYOUT.taskNumWidth)
  const maxContentWidthPx = getTaskQuestionWidthPx(contentWidthCapDxa)
  const contentWidthDxa = contentWidthCapDxa ?? pxToDxa(SHEET_CONTENT_WIDTH_PX - LAYOUT.taskNumWidth)
  const maxContentCols = 1
  const hasExtraRows = extraRows != null
  const rowKeepNext = hasExtraRows || showDifficulty

  const questionParagraphs = await buildQuestionParagraphs(
    questionText,
    qStyle,
    ctx,
    rowKeepNext,
  )

  const rows: TableRow[] = [
    new TableRow({
      cantSplit: true,
      height: rowHeight(qStyle),
      children: [
        buildNumCell(
          taskNumber,
          numStyle,
          numColor,
          numCellWidthDxa,
          rowKeepNext,
          VerticalAlignTable.TOP,
        ),
        new TableCell({
          columnSpan: maxContentCols,
          width: { size: contentWidthDxa, type: WidthType.DXA },
          borders: hiddenCellBorders(),
          margins: {
            top: CELL_MARGIN_TWIPS,
            bottom: CELL_MARGIN_TWIPS,
            left: 0,
            right: 0,
          },
          verticalAlign: VerticalAlignTable.TOP,
          children:
            questionParagraphs.length > 0
              ? questionParagraphs
              : [new Paragraph({ spacing: questionParagraphSpacing(qStyle), children: [new TextRun({ text: '' })] })],
        }),
      ],
    }),
  ]

  if (showDifficulty) {
    rows.push(
      new TableRow({
        cantSplit: true,
        height: rowHeight(TYPO.difficulty, 0),
        children: [
          buildEmptyNumCell(numCellWidthDxa, hasExtraRows),
          new TableCell({
            columnSpan: maxContentCols,
            width: {
              size: contentWidthDxa,
              type: WidthType.DXA,
            },
            borders: hiddenCellBorders(),
            margins: {
              top: pxToTwips(difficultyTopGapPx),
              bottom: CELL_MARGIN_TWIPS,
              left: 0,
              right: 0,
            },
            verticalAlign: VerticalAlignTable.TOP,
            children: [await buildDifficultyTable(block, ctx)],
          }),
        ],
      }),
    )
  }

  const firstRowColumnWidths = [numCellWidthDxa, contentWidthDxa]
  const grid: TaskHeadGrid = {
    maxContentCols,
    numCellWidthDxa,
    contentWidthDxa,
  }

  if (extraRows) {
    const appended = await extraRows(grid)
    rows.push(...appended)
  }

  const tableWidthDxa = firstRowColumnWidths.reduce((sum, width) => sum + width, 0)

  onLayout?.({
    blockId: block.id,
    blockType: block.type,
    isAnswerBlock,
    showAnswerPass,
    questionFontSizePx: qStyle.sizePx,
    numColor,
    maxContentWidthPx,
    contentWidthDxa,
    firstRowColumnWidthsDxa: firstRowColumnWidths,
    lineCount: questionParagraphs.length,
    paragraphCount: questionParagraphs.length,
  })

  return new Table({
    width: { size: tableWidthDxa, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: firstRowColumnWidths,
    borders: hiddenCellBorders(),
    rows,
  })
}
