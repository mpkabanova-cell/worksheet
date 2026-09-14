import { sheetTopicLabel } from '@/data/worksheet'
import { LAYOUT, TYPO } from '@/export/word/layoutTokens'
import { plainParagraph, richParagraphs, spacerParagraph } from '@/export/word/richText/toDocxContent'
import type { ExportContext } from '@/export/word/types'
import { Paragraph, Tab, TabStopType, TextRun } from 'docx'
import { pxToTwips } from '@/export/word/layoutTokens'

export async function buildHeader(ctx: ExportContext): Promise<(Paragraph)[]> {
  const { draft } = ctx
  const minimal = draft.createdManually === true
  const title = sheetTopicLabel(draft)
  const result: Paragraph[] = []

  if (!minimal) {
    result.push(
      new Paragraph({
        spacing: { after: pxToTwips(24) },
        tabStops: [{ type: TabStopType.LEFT, position: pxToTwips(72) }],
        children: [
          new TextRun({
            text: 'Ученик:',
            size: 21,
            font: 'Onest',
            color: '656C94',
          }),
          new TextRun({ children: [new Tab()] }),
          new TextRun({
            text: ' ',
            underline: {},
          }),
        ],
      }),
    )
  }

  result.push(
    plainParagraph(title, TYPO.sheetTitle, {
      spacing: { after: pxToTwips(minimal ? 8 : 24) },
    }),
  )

  if (!minimal && draft.intro.trim()) {
    const introParas = await richParagraphs(draft.intro, { ...TYPO.sheetIntro, secondary: true }, ctx, {
      spacing: { after: pxToTwips(8) },
    })
    result.push(...introParas)
  }

  result.push(spacerParagraph(LAYOUT.sheetContentPaddingX))
  return result
}

export function buildPageFooter(pageNumber: number): Paragraph {
  return new Paragraph({
    alignment: 'center',
    spacing: { before: pxToTwips(LAYOUT.pageFooterBottom) },
    children: [
      new TextRun({
        text: String(pageNumber + 1),
        size: 21,
        color: '656C94',
        font: 'Onest',
      }),
    ],
  })
}

export function buildAnswersTitle(): Paragraph {
  return plainParagraph('Ответы', TYPO.sheetTitle, {
    spacing: { before: pxToTwips(24), after: pxToTwips(16) },
  })
}
