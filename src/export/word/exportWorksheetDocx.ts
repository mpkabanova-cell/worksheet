import type { WorksheetDraft } from '@/data/worksheet'
import { worksheetDisplayName } from '@/data/worksheet'
import { buildWorksheetDocumentChildren } from '@/export/word/build/buildSheet'
import { PAGE_MARGIN_TWIPS } from '@/export/word/build/buildHeader'
import { runFont } from '@/export/word/layoutTokens'
import type { ExportContext, ExportOptions } from '@/export/word/types'
import {
  Document,
  Packer,
  PageOrientation,
} from 'docx'

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'worksheet'
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportWorksheetDocx(draft: WorksheetDraft): Promise<void> {
  const options: ExportOptions = {
    showAnswers: draft.showAnswers,
    showDifficulty: draft.showDifficulty,
    answersSeparate: draft.print.answersSeparate,
    orientation: draft.print.orientation,
  }

  const ctx: ExportContext = {
    draft,
    options,
    subject: draft.subject,
    mathCache: new Map(),
    imageCache: new Map(),
    domImageCache: new Map(),
  }

  const children = await buildWorksheetDocumentChildren(ctx)

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: runFont(),
            size: 21,
            color: '161A33',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: PAGE_MARGIN_TWIPS,
              bottom: PAGE_MARGIN_TWIPS,
              left: PAGE_MARGIN_TWIPS,
              right: PAGE_MARGIN_TWIPS,
            },
            size: {
              orientation:
                options.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${sanitizeFileName(worksheetDisplayName(draft))}.docx`)
}
