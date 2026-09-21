import type { WorksheetBlock } from '@/data/worksheet'
import {
  getBlockAnswerStyle,
  getChoiceDisplayOptions,
  getGapsSourceText,
  getGapsStudentText,
  getValidGapAnswers,
  isValidFillGapsBlock,
  markGapAnswersInText,
  isChoiceBlock,
  isOptionCorrect,
  qrCodeUrl,
} from '@/data/blockUtils'
import { getBlockQuestion } from '@/data/taskContent'
import {
  getChoiceCheckboxCheckedPng,
  getChoiceCheckboxMarkerPng,
  getChoiceRadioCheckedPng,
  getChoiceRadioMarkerPng,
} from '@/export/word/assets/uiAssets'
import { buildAnswerArea } from '@/export/word/build/buildAnswerArea'
import {
  buildTaskHeadTable,
  buildWidgetBodyRow,
  type TaskHeadTableOptions,
} from '@/export/word/build/buildTaskHeadTable'
import { rasterizeMatching } from '@/export/word/rasterize/renderMatchingDom'
import { rasterizeGrouping } from '@/export/word/rasterize/renderGroupingDom'
import { rasterizeOrdering } from '@/export/word/rasterize/renderOrderingDom'
import {
  COLORS,
  LAYOUT,
  TYPO,
  pxToTwips,
  slotBodyTopSpacingPx,
} from '@/export/word/layoutTokens'
import { getGroupingLayoutSpec, getMatchingLayoutSpec, getOrderingLayoutSpec, getTaskBlockLayout } from '@/export/word/layoutSpec'
import { fetchImageBytes } from '@/export/word/imageUtils'
import { parseContent } from '@/export/word/richText/parseRichText'
import {
  imageRunFromPng,
  imageRunFromPngSized,
  parseGapsContent,
  plainParagraph,
  richParagraphs,
  segmentsToParagraphChildren,
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

async function choiceMarkerRun(
  block: WorksheetBlock,
  showAnswer: boolean,
  correct: boolean,
  ctx: ExportContext,
): Promise<ImageRun> {
  const isSingle = block.type === 'single_choice'
  const showCorrect = showAnswer && correct
  const png = isSingle
    ? showCorrect
      ? await getChoiceRadioCheckedPng(ctx, LAYOUT.choiceMarkerSize)
      : await getChoiceRadioMarkerPng(ctx, LAYOUT.choiceMarkerSize)
    : showCorrect
      ? await getChoiceCheckboxCheckedPng(ctx, LAYOUT.choiceMarkerSize)
      : await getChoiceCheckboxMarkerPng(ctx, LAYOUT.choiceMarkerSize)
  return imageRunFromPng(png, LAYOUT.choiceMarkerSize)
}

async function buildChoiceOptionParagraphs(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  let options = getChoiceDisplayOptions(block, false, false)

  if (options.length === 0) {
    console.warn('[export] choice block has no options, using placeholders', block.id)
    options = Array.from({ length: 4 }, (_, index) => ({
      id: `fallback_${index}`,
      text: `Ответ ${index + 1}`,
    }))
  }

  const paragraphs: Paragraph[] = []

  for (let index = 0; index < options.length; index += 1) {
    const opt = options[index]
    const { children } = await segmentsToParagraphChildren(parseContent(opt.text || 'Ответ'), TYPO.option, ctx)
    paragraphs.push(
      new Paragraph({
        spacing: {
          before: 0,
          after: pxToTwips(LAYOUT.slotGap),
          line: pxToTwips(TYPO.option.linePx),
          lineRule: 'exact',
        },
        children: [
          await choiceMarkerRun(block, showAnswer, isOptionCorrect(block, opt.id), ctx),
          new TextRun({ text: ' ' }),
          ...children,
        ],
      }),
    )
  }

  return paragraphs
}

async function buildChoiceOptions(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<DocxBlock[]> {
  const format = block.choiceOptionFormat ?? 'text'
  let options = getChoiceDisplayOptions(block, false, false)
  const result: DocxBlock[] = []

  if (options.length === 0) {
    console.warn('[export] choice block has no options, using placeholders', block.id)
    options = Array.from({ length: 4 }, (_, index) => ({
      id: `fallback_${index}`,
      text: `Ответ ${index + 1}`,
    }))
  }

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
          const { children: captionChildren } = await segmentsToParagraphChildren(parseContent(caption), TYPO.option, ctx)
          children.push(
            new Paragraph({
              children: [
                await choiceMarkerRun(block, showAnswer, isOptionCorrect(block, opt.id), ctx),
                new TextRun({ text: ' ' }),
                ...captionChildren,
              ],
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
            : [new Paragraph({ children: [await choiceMarkerRun(block, showAnswer, isOptionCorrect(block, opt.id), ctx)] })],
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

  for (let index = 0; index < options.length; index += 1) {
    const opt = options[index]
    const { children } = await segmentsToParagraphChildren(parseContent(opt.text || 'Ответ'), TYPO.option, ctx)
    result.push(
      new Paragraph({
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
        spacing: {
          before: index === 0 ? pxToTwips(LAYOUT.slotPaddingTop) : 0,
          after: pxToTwips(8),
        },
        children: [
          await choiceMarkerRun(block, showAnswer, isOptionCorrect(block, opt.id), ctx),
          new TextRun({ text: ' ' }),
          ...children,
        ],
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
  const result: DocxBlock[] = []

  if (!isValidFillGapsBlock(block)) {
    const source = getGapsSourceText(block) || block.gapsSourceText?.trim() || block.gapsText?.trim() || ''
    const text = source.trim() || 'Текст с пропусками'
    const paras = await richParagraphs(
      text,
      { ...TYPO.gapsText, color: COLORS.textDefault },
      ctx,
      {
        indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
        topSpacingPx: slotBodyTopSpacingPx(),
      },
    )
    result.push(...paras)
    return result
  }

  const source = getGapsSourceText(block)
  const gapWords = getValidGapAnswers(block)
  const text = showAnswer ? markGapAnswersInText(source, gapWords) : getGapsStudentText(block)

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
    {
      indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      topSpacingPx: slotBodyTopSpacingPx(),
    },
    showAnswer ? parseContent : parseGapsContent,
  )
  result.push(...paras)

  return result
}

async function buildMatching(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  const { imageWidthPx } = getMatchingLayoutSpec()
  const image = await rasterizeMatching(block, showAnswer, ctx)
  const displayWidth = imageWidthPx
  const displayHeight = Math.max(1, Math.round(image.height * (displayWidth / image.width)))

  return [
    new Paragraph({
      spacing: { before: 0, after: pxToTwips(4) },
      children: [imageRunFromPngSized(image.data, displayWidth, displayHeight)],
    }),
  ]
}

async function buildOrdering(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  const { imageWidthPx } = getOrderingLayoutSpec()
  const image = await rasterizeOrdering(block, showAnswer, ctx)
  const displayWidth = imageWidthPx
  const displayHeight = Math.max(1, Math.round(image.height * (displayWidth / image.width)))

  return [
    new Paragraph({
      spacing: { before: 0, after: pxToTwips(4) },
      children: [imageRunFromPngSized(image.data, displayWidth, displayHeight)],
    }),
  ]
}

async function buildGrouping(
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  const { imageWidthPx } = getGroupingLayoutSpec()
  const image = await rasterizeGrouping(block, showAnswer, ctx)
  const displayWidth = imageWidthPx
  const displayHeight = Math.max(1, Math.round(image.height * (displayWidth / image.width)))

  return [
    new Paragraph({
      spacing: { before: 0, after: pxToTwips(4) },
      children: [imageRunFromPngSized(image.data, displayWidth, displayHeight)],
    }),
  ]
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

  const displayQuestion = getBlockQuestion(block)
  const isAnswerBlock = block.type === 'short_answer' || block.type === 'extended_answer'
  const choiceFormat = block.choiceOptionFormat ?? 'text'
  let headOptions: TaskHeadTableOptions = {}

  if (isChoiceBlock(block) && choiceFormat === 'text') {
    const optionParagraphs = await buildChoiceOptionParagraphs(block, showAnswer, ctx)
    headOptions = {
      extraRows: (grid) => [buildWidgetBodyRow(grid, optionParagraphs)],
    }
  } else if (block.type === 'matching') {
    const layout = getTaskBlockLayout(block)
    const matchingParagraphs = await buildMatching(block, showAnswer, ctx)
    headOptions = {
      contentWidthCapDxa: layout.contentWidthCapDxa,
      padQuestionRowToCap: true,
      extraRows: (grid) => [
        buildWidgetBodyRow(grid, matchingParagraphs, {
          cellMarginTopPx: slotBodyTopSpacingPx(),
        }),
      ],
    }
  } else if (block.type === 'ordering') {
    const layout = getTaskBlockLayout(block)
    const orderingParagraphs = await buildOrdering(block, showAnswer, ctx)
    headOptions = {
      contentWidthCapDxa: layout.contentWidthCapDxa,
      padQuestionRowToCap: true,
      extraRows: (grid) => [
        buildWidgetBodyRow(grid, orderingParagraphs, {
          cellMarginTopPx: slotBodyTopSpacingPx(),
        }),
      ],
    }
  } else if (block.type === 'grouping') {
    const layout = getTaskBlockLayout(block)
    const groupingParagraphs = await buildGrouping(block, showAnswer, ctx)
    headOptions = {
      contentWidthCapDxa: layout.contentWidthCapDxa,
      padQuestionRowToCap: true,
      extraRows: (grid) => [
        buildWidgetBodyRow(grid, groupingParagraphs, {
          cellMarginTopPx: slotBodyTopSpacingPx(),
        }),
      ],
    }
  }

  const head = await buildTaskHeadTable(
    taskNumber,
    displayQuestion,
    isAnswerBlock,
    block,
    ctx,
    { ...headOptions, showAnswerPass: showAnswer },
  )
  const bodyParts: DocxBlock[] = []

  if (isChoiceBlock(block) && choiceFormat !== 'text') {
    bodyParts.push(...(await buildChoiceOptions(block, showAnswer, ctx)))
  }

  if (isAnswerBlock) {
    const style = getBlockAnswerStyle(block, ctx.subject)
    bodyParts.push(...(await buildAnswerArea(block, style, ctx.subject, showAnswer, ctx)))
  }

  if (block.type === 'fill_gaps') {
    bodyParts.push(...(await buildFillGaps(block, showAnswer, ctx)))
  }

  result.push(head)
  result.push(...bodyParts)
  result.push(spacerParagraph(LAYOUT.taskGap))
  return result
}
