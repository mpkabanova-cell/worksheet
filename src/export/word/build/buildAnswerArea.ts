import type { AnswerAreaStyle, WorksheetBlock } from '@/data/worksheet'
import { LAYOUT, pxToTwips } from '@/export/word/layoutTokens'
import { rasterizeAnswerArea } from '@/export/word/rasterize/renderAnswerAreaDom'
import { imageRunFromPngSized } from '@/export/word/richText/toDocxContent'
import type { ExportContext } from '@/export/word/types'
import { Paragraph } from 'docx'

export async function buildAnswerArea(
  block: WorksheetBlock,
  style: AnswerAreaStyle,
  subject: string,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<Paragraph[]> {
  const image = await rasterizeAnswerArea(block, style, subject, showAnswer, ctx)

  return [
    new Paragraph({
      indent: { left: pxToTwips(LAYOUT.slotPaddingLeft) },
      spacing: { before: pxToTwips(LAYOUT.slotPaddingTop), after: pxToTwips(4) },
      children: [imageRunFromPngSized(image.data, image.width, image.height)],
    }),
  ]
}
