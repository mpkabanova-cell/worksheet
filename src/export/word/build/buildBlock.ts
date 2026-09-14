import type { WorksheetBlock } from '@/data/worksheet'
import {
  getBlockAnswerStyle,
  getChoiceDisplayOptions,
  getGapsDisplayAnswers,
  getGapsSourceText,
  getGapsStudentText,
  getOrderDisplayItems,
  getTableAnswerBank,
  isChoiceBlock,
  isOptionCorrect,
  isQuestionPlaceholder,
  questionPlaceholderForBlock,
  qrCodeUrl,
} from '@/data/blockUtils'
import { getBlockQuestion } from '@/data/taskContent'
import {
  getChoiceCheckboxMarkerPng,
  getChoiceRadioMarkerPng,
} from '@/export/word/assets/uiAssets'
import { buildAnswerArea } from '@/export/word/build/buildAnswerArea'
import { buildTaskHeadTable } from '@/export/word/build/buildTaskHeadTable'
import { rasterizeMatching } from '@/export/word/rasterize/renderMatchingDom'
import {
  COLORS,
  LAYOUT,
  TYPO,
  pxToHalfPoints,
  pxToTwips,
  runFont,
} from '@/export/word/layoutTokens'
import { fetchImageBytes } from '@/export/word/imageUtils'
import { parseContent } from '@/export/word/richText/parseRichText'
import {
  imageRunFromPng,
  imageRunFromPngSized,
  parseGapsContent,
  plainParagraph,
  richParagraphs,
  segmentsToRuns,
  spacerParagraph,
} from '@/export/word/richText/toDocxContent'
import type { ExportContext } from '@/export/word/types'
import {
  BorderStyle,
  ImageRun,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

type DocxBlock = Paragraph | Table

const HIDDEN_BORDER = { style: BorderStyle.NONE, size: 0, color: COLORS.white } as const

function hiddenCellBorders() {
  return {
    top: HIDDEN_BORDER,
    bottom: HIDDEN_BORDER,
    left: HIDDEN_BORDER,
    right: HIDDEN_BORDER,
  }
}

/** Keep task condition and interactive body on the same page. */
function wrapTaskBlock(head: Table, body: DocxBlock[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: hiddenCellBorders(),
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: hiddenCellBorders(),
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [head, ...body],
          }),
        ],
      }),
    ],
  })
}

async function choiceMarkerRun(
  block: WorksheetBlock,
  ctx: ExportContext,
): Promise<ImageRun> {
  const isSingle = block.type === 'single_choice'
  const png = isSingle
    ? await getChoiceRadioMarkerPng(ctx, LAYOUT.choiceMarkerSize)
    : await getChoiceCheckboxMarkerPng(ctx, LAYOUT.choiceMarkerSize)
  return imageRunFromPng(png, LAYOUT.choiceMarkerSize)
}

async function buildChoiceOptions(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DocxBlock[]> {
  const format = block.choiceOptionFormat ?? 'text'
  const options = getChoiceDisplayOptions(block, false, false)
  const result: DocxBlock[] = []

  if (format === 'image' || format === 'text_image') {
    const cells: TableCell[] = []
    for (const opt of options) {
      const correct = isOptionCorrect(block, opt.id) && showAnswer
      const imageSource = opt.imageData ?? ''
      const imageBytes = imageSource ? await fetchImageBytes(imageSource, ctx) : null
      const children: Paragraph[] = []

      if (imageBytes) {
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: imageBytes[0] === 0xff && imageBytes[1] === 0xd8 ? 'jpg' : 'png',
                data: imageBytes,
                transformation: {
                  width: 120,
                  height: 120,
                },
              }),
            ],
          }),
        )
      }

      if (format === 'text_image' || format === 'image') {
        const caption = format === 'text_image' ? opt.text || 'Ответ' : ''
        if (caption) {
          const { runs } = await segmentsToRuns(parseContent(caption), TYPO.option, ctx)
          children.push(
            new Paragraph({
              children: [await choiceMarkerRun(block, ctx), new TextRun({ text: ' ' }), ...runs],
            }),
          )
        }
      }

      cells.push(
        new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: correct ? COLORS.borderPositive : COLORS.borderSecondary },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: correct ? COLORS.borderPositive : COLORS.borderSecondary },
            left: { style: BorderStyle.SINGLE, size: 1, color: correct ? COLORS.borderPositive : COLORS.borderSecondary },
            right: { style: BorderStyle.SINGLE, size: 1, color: correct ? COLORS.borderPositive : COLORS.borderSecondary },
          },
          children: children.length > 0
            ? children
            : [new Paragraph({ children: [await choiceMarkerRun(block, ctx)] })],
        }),
      )
    }

    result.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: cells })],
      }),
    )
    return result
  }

  for (const opt of options) {
    const { runs } = await segmentsToRuns(parseContent(opt.text || 'Ответ'), TYPO.option, ctx)
    result.push(
      new Paragraph({
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
        spacing: { after: pxToTwips(8) },
        children: [await choiceMarkerRun(block, ctx), new TextRun({ text: ' ' }), ...runs],
      }),
    )
  }
  return result
}

async function buildFillGaps(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DocxBlock[]> {
  const text = showAnswer ? getGapsSourceText(block) : getGapsStudentText(block)
  const result: DocxBlock[] = []

  if (!text.trim()) {
    result.push(
      plainParagraph('Текст с пропусками', { ...TYPO.plainBody, secondary: true }, {
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      }),
    )
    return result
  }

  const paras = await richParagraphs(
    text,
    { ...TYPO.gapsText, color: COLORS.textDefault },
    ctx,
    { indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) } },
    parseGapsContent,
  )
  result.push(...paras)

  const words = !showAnswer && block.gapsShuffleAnswers
    ? getGapsDisplayAnswers(block, false, false)
    : (block.gapsAnswers ?? [])

  if (!showAnswer && words.length > 0) {
    const bankRuns: (TextRun | ImageRun)[] = [
      new TextRun({
        text: 'Пропущенные слова:',
        font: runFont(),
        size: pxToHalfPoints(TYPO.gapsBank.sizePx),
        color: COLORS.textSecondary,
      }),
    ]

    for (let i = 0; i < words.length; i += 1) {
      bankRuns.push(
        new TextRun({
          text: i === 0 ? ' ' : ', ',
          font: runFont(),
          size: pxToHalfPoints(TYPO.gapsBank.sizePx),
        }),
      )
      bankRuns.push(
        ...(await segmentsToRuns(
          parseContent(words[i]),
          { ...TYPO.gapsBank, color: COLORS.textDefault },
          ctx,
        )).runs,
      )
    }

    result.push(
      new Paragraph({
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
        spacing: { before: pxToTwips(8), after: pxToTwips(4) },
        children: bankRuns,
      }),
    )
  }

  return result
}

async function buildMatching(block: WorksheetBlock, showAnswer: boolean, ctx: ExportContext): Promise<DocxBlock[]> {
  const image = await rasterizeMatching(block, showAnswer, ctx)

  return [
    new Paragraph({
      indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      spacing: { before: pxToTwips(LAYOUT.slotPaddingTop), after: pxToTwips(4) },
      children: [imageRunFromPngSized(image.data, image.width, image.height)],
    }),
  ]
}

async function buildOrdering(block: WorksheetBlock, ctx: ExportContext): Promise<DocxBlock[]> {
  const items = getOrderDisplayItems(block, false, false)
  const result: DocxBlock[] = []

  for (let i = 0; i < items.length; i += 1) {
    const text = items[i]?.trim() || 'Текст'
    const { runs } = await segmentsToRuns(parseContent(text), TYPO.option, ctx)
    result.push(
      new Paragraph({
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
        spacing: { after: pxToTwips(8) },
        children: [
          new TextRun({
            text: `${i + 1}. `,
            font: runFont(),
            size: pxToHalfPoints(TYPO.option.sizePx),
            color: COLORS.textSecondary,
          }),
          ...runs,
        ],
      }),
    )
  }
  return result
}

async function buildGrouping(block: WorksheetBlock, ctx: ExportContext): Promise<DocxBlock[]> {
  const groups = block.groups ?? []
  const cells: TableCell[] = []

  for (const group of groups) {
    const { runs: titleRuns } = await segmentsToRuns(
      parseContent(group.title || 'Название группы'),
      { ...TYPO.option, bold: true },
      ctx,
    )
    const itemParas: Paragraph[] = []
    for (const item of group.items ?? []) {
      const { runs } = await segmentsToRuns(parseContent(item.trim() || 'Элемент'), TYPO.option, ctx)
      itemParas.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', font: runFont(), size: pxToHalfPoints(TYPO.option.sizePx) }),
            ...runs,
          ],
        }),
      )
    }
    cells.push(
      new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
          left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
          right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderSecondary },
        },
        children: [
          new Paragraph({ children: titleRuns }),
          ...itemParas,
        ],
      }),
    )
  }

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: cells })],
    }),
  ]
}

async function buildTableBlock(block: WorksheetBlock, ctx: ExportContext): Promise<DocxBlock[]> {
  const rows = block.tableRows ?? 3
  const cols = block.tableCols ?? 3
  const cells = block.tableCells ?? []
  const headers = block.tableHeaders ?? []
  const tableRows: TableRow[] = []

  tableRows.push(
    new TableRow({
      children: Array.from({ length: cols }).map((_, colIndex) =>
        new TableCell({
          shading: { fill: COLORS.bgTertiary },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: headers[colIndex] || 'Название группы',
                  font: runFont(),
                  size: pxToHalfPoints(TYPO.option.sizePx),
                  bold: true,
                }),
              ],
            }),
          ],
        }),
      ),
    }),
  )

  for (let r = 0; r < rows; r += 1) {
    const rowCells: TableCell[] = []
    for (let c = 0; c < cols; c += 1) {
      const value = cells[r]?.[c] ?? ''
      const runs = value
        ? (await segmentsToRuns(parseContent(value), TYPO.option, ctx)).runs
        : [new TextRun({ text: ' ' })]
      rowCells.push(
        new TableCell({
          children: [new Paragraph({ children: runs })],
        }),
      )
    }
    tableRows.push(new TableRow({ children: rowCells }))
  }

  const result: DocxBlock[] = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }),
  ]

  const bank = getTableAnswerBank(block, false, false)
  if (bank.length > 0) {
    result.push(
      plainParagraph(bank.join('   '), TYPO.option, {
        spacing: { before: pxToTwips(8) },
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      }),
    )
  }

  return result
}

async function buildMediaBlock(block: WorksheetBlock, ctx: ExportContext): Promise<DocxBlock[]> {
  const url = block.mediaUrl ?? ''
  const displayUrl = block.mediaFileData ?? url
  const label = block.mediaFileName ?? url
  const result: DocxBlock[] = [
    plainParagraph('Открой QR–код и …', TYPO.mediaTitle),
  ]

  if (label) {
    result.push(plainParagraph(label, { ...TYPO.plainBody, secondary: true }))
  }

  if (url) {
    const qrBytes = await fetchImageBytes(qrCodeUrl(url, LAYOUT.qrSize), ctx)
    if (qrBytes) {
      result.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: qrBytes,
              transformation: {
                width: LAYOUT.qrSize,
                height: LAYOUT.qrSize,
              },
            }),
          ],
        }),
      )
    }
  } else if (displayUrl && block.mediaFileData) {
    result.push(plainParagraph(block.mediaFileName ?? 'Медиафайл', TYPO.plainBody))
  }

  return result
}

export async function buildBlockContent(
  block: WorksheetBlock,
  taskNumber: number | null,
  ctx: ExportContext,
  showAnswerOverride?: boolean,
): Promise<DocxBlock[]> {
  const showAnswer = showAnswerOverride ?? ctx.options.showAnswers

  if (block.type === 'page_break') {
    return [new Paragraph({ children: [new PageBreak()] })]
  }

  const result: DocxBlock[] = []

  if (block.type === 'text') {
    const bodyParas = await richParagraphs(block.body ?? '', { ...TYPO.plainBody, secondary: true }, ctx)
    result.push(...bodyParas)
    result.push(spacerParagraph(LAYOUT.taskGap))
    return result
  }

  if (block.type === 'answer_field') {
    result.push(...(await buildMediaBlock(block, ctx)))
    result.push(spacerParagraph(LAYOUT.taskGap))
    return result
  }

  const question = getBlockQuestion(block)
  const questionText = block.question?.trim() ?? question.trim()
  const showsPlaceholder = isQuestionPlaceholder(questionText)
  const displayQuestion = showsPlaceholder ? questionPlaceholderForBlock(block) : (block.question ?? question)
  const isAnswerBlock = block.type === 'short_answer' || block.type === 'extended_answer'

  const head = await buildTaskHeadTable(taskNumber, displayQuestion, isAnswerBlock, block, ctx)
  const bodyParts: DocxBlock[] = []

  if (isChoiceBlock(block)) {
    bodyParts.push(...(await buildChoiceOptions(block, showAnswer, ctx)))
  }

  if (isAnswerBlock) {
    const style = getBlockAnswerStyle(block, ctx.subject)
    bodyParts.push(...(await buildAnswerArea(block, style, ctx.subject, showAnswer, ctx)))
  }

  if (block.type === 'fill_gaps') {
    bodyParts.push(...(await buildFillGaps(block, showAnswer, ctx)))
  }

  if (block.type === 'matching') {
    bodyParts.push(...(await buildMatching(block, showAnswer, ctx)))
  }

  if (block.type === 'ordering') {
    bodyParts.push(...(await buildOrdering(block, ctx)))
  }

  if (block.type === 'grouping') {
    bodyParts.push(...(await buildGrouping(block, ctx)))
  }

  if (block.type === 'table') {
    bodyParts.push(...(await buildTableBlock(block, ctx)))
  }

  result.push(wrapTaskBlock(head, bodyParts))
  result.push(spacerParagraph(LAYOUT.taskGap))
  return result
}
