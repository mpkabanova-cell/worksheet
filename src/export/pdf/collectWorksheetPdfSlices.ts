import type { WorksheetBlock } from '@/data/worksheet'
import { countTaskBlocksBefore } from '@/data/blockUtils'
import type { PdfSlice } from '@/export/pdf/pdfSlice'
import { rasterizeExportHeader, rasterizeRichTextBlock } from '@/export/pdf/renderExportHeaderDom'
import { rasterizeTaskBlockForPdf } from '@/export/pdf/rasterizeTaskBlockForPdf'
import { LAYOUT, TYPO } from '@/export/word/layoutTokens'
import type { ExportContext } from '@/export/word/types'

function isNumberedTask(block: WorksheetBlock): boolean {
  return block.type !== 'page_break' && block.type !== 'text' && block.type !== 'answer_field'
}

async function collectPageBlockSlices(
  page: number,
  ctx: ExportContext,
  showAnswerOverride?: boolean,
): Promise<PdfSlice[]> {
  const pageBlocks = ctx.draft.blocks.filter((b) => b.page === page)
  const slices: PdfSlice[] = []

  for (let index = 0; index < pageBlocks.length; index += 1) {
    const block = pageBlocks[index]!
    const showAnswer = showAnswerOverride ?? ctx.options.showAnswers

    if (block.type === 'page_break') {
      slices.push({ kind: 'pageBreak' })
      continue
    }

    if (block.type === 'text') {
      const image = await rasterizeRichTextBlock(
        block.body ?? '',
        ctx,
        `pdf-text-${block.id}-${showAnswer ? 'a' : 's'}`,
        { ...TYPO.plainBody, secondary: true },
      )
      if (image) {
        slices.push({ kind: 'image', image, gapAfterPx: LAYOUT.taskGap })
      }
      continue
    }

    if (block.type === 'answer_field') {
      continue
    }

    const taskNumber = isNumberedTask(block)
      ? countTaskBlocksBefore(ctx.draft.blocks, page, index) + 1
      : null
    const image = await rasterizeTaskBlockForPdf(block, taskNumber, ctx, showAnswer)
    slices.push({ kind: 'image', image, gapAfterPx: LAYOUT.taskGap })
  }

  return slices
}

async function collectAllPageSlices(
  ctx: ExportContext,
  showAnswerOverride?: boolean,
): Promise<PdfSlice[]> {
  const totalPages = Math.max(ctx.draft.pages, 1)
  const slices: PdfSlice[] = []

  for (let page = 0; page < totalPages; page += 1) {
    if (page > 0) {
      slices.push({ kind: 'pageBreak' })
    }
    slices.push(...(await collectPageBlockSlices(page, ctx, showAnswerOverride)))
  }

  return slices
}

export async function collectWorksheetPdfSlices(ctx: ExportContext): Promise<PdfSlice[]> {
  const showAnswersInline = ctx.options.showAnswers && !ctx.options.answersSeparate
  const studentCtx: ExportContext = {
    ...ctx,
    options: { ...ctx.options, showAnswers: showAnswersInline },
  }

  const slices: PdfSlice[] = []

  const header = await rasterizeExportHeader(studentCtx)
  if (header) {
    slices.push({ kind: 'image', image: header, gapAfterPx: 0 })
  }

  slices.push(...(await collectAllPageSlices(studentCtx, showAnswersInline)))

  if (ctx.options.answersSeparate) {
    slices.push({ kind: 'pageBreak' })
    const answersTitle = await rasterizeRichTextBlock(
      'Ответы',
      ctx,
      `pdf-answers-title-${ctx.draft.id}`,
      TYPO.sheetTitle,
    )
    if (answersTitle) {
      slices.push({ kind: 'image', image: answersTitle, gapAfterPx: 16 })
    }
    const answersCtx: ExportContext = {
      ...ctx,
      options: { ...ctx.options, showAnswers: true },
    }
    slices.push(...(await collectAllPageSlices(answersCtx, true)))
  }

  return slices
}
