import type { WorksheetBlock } from '@/data/worksheet'
import { countTaskBlocksBefore } from '@/data/blockUtils'
import { buildAnswersTitle, buildHeader, buildPageFooter } from '@/export/word/build/buildHeader'
import { buildBlockContent } from '@/export/word/build/buildBlock'
import type { ExportContext } from '@/export/word/types'
import { PageBreak, Paragraph, type FileChild } from 'docx'

function isNumberedTask(block: WorksheetBlock): boolean {
  return block.type !== 'page_break' && block.type !== 'text' && block.type !== 'answer_field'
}

async function buildPageBlocks(
  page: number,
  totalPages: number,
  ctx: ExportContext,
  showAnswerOverride?: boolean,
): Promise<FileChild[]> {
  const pageBlocks = ctx.draft.blocks.filter((b) => b.page === page)
  const result: FileChild[] = []

  for (let index = 0; index < pageBlocks.length; index += 1) {
    const block = pageBlocks[index]
    const taskNumber = isNumberedTask(block)
      ? countTaskBlocksBefore(ctx.draft.blocks, page, index) + 1
      : null
    result.push(...(await buildBlockContent(block, taskNumber, ctx, showAnswerOverride)))
  }

  if (totalPages > 1) {
    result.push(buildPageFooter(page))
  }

  return result
}

export async function buildSheetBody(
  ctx: ExportContext,
  showAnswerOverride?: boolean,
): Promise<FileChild[]> {
  const totalPages = Math.max(ctx.draft.pages, 1)
  const result: FileChild[] = []

  result.push(...(await buildHeader(ctx)))

  for (let page = 0; page < totalPages; page += 1) {
    if (page > 0) {
      result.push(new Paragraph({ children: [new PageBreak()] }))
    }
    result.push(...(await buildPageBlocks(page, totalPages, ctx, showAnswerOverride)))
  }

  return result
}

export async function buildWorksheetDocumentChildren(ctx: ExportContext): Promise<FileChild[]> {
  const showAnswersInline = ctx.options.showAnswers && !ctx.options.answersSeparate
  const studentCtx: ExportContext = {
    ...ctx,
    options: { ...ctx.options, showAnswers: showAnswersInline },
  }

  const result: FileChild[] = await buildSheetBody(studentCtx, showAnswersInline)

  if (ctx.options.answersSeparate) {
    result.push(new Paragraph({ children: [new PageBreak()] }))
    result.push(buildAnswersTitle())
    result.push(...(await buildSheetBody({ ...ctx, options: { ...ctx.options, showAnswers: true } }, true)))
  }

  return result
}
