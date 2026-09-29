import type { WorksheetDraft } from '@/data/worksheet'
import { worksheetDisplayName } from '@/data/worksheet'
import { normalizeWorksheetDraft } from '@/data/blockUtils'
import { buildWorksheetDocumentChildren } from '@/export/word/build/buildSheet'
import { PAGE_MARGIN_TWIPS } from '@/export/word/build/buildHeader'
import { ensureExportFontsLoaded } from '@/export/word/loadExportFonts'
import { runFont } from '@/export/word/layoutTokens'
import type { ExportContext, ExportOptions } from '@/export/word/types'
import { downloadBlob } from '@/export/downloadBlob'
import {
  Document,
  Packer,
  PageOrientation,
} from 'docx'

export type ExportWorksheetDocxResult = {
  blob: Blob
  fileName: string
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'worksheet'
}

export async function exportWorksheetDocxBlob(
  draft: WorksheetDraft,
): Promise<ExportWorksheetDocxResult> {
  const normalizedDraft = normalizeWorksheetDraft(draft)
  const options: ExportOptions = {
    showAnswers: normalizedDraft.showAnswers,
    showDifficulty: normalizedDraft.showDifficulty,
    answersSeparate: normalizedDraft.print.answersSeparate,
    orientation: normalizedDraft.print.orientation,
  }

  const ctx: ExportContext = {
    draft: normalizedDraft,
    options,
    subject: normalizedDraft.subject,
    mathCache: new Map(),
    imageCache: new Map(),
    domImageCache: new Map(),
  }

  await ensureExportFontsLoaded()
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
  const fileName = `${sanitizeFileName(worksheetDisplayName(normalizedDraft))}.docx`
  return { blob, fileName }
}

export async function exportWorksheetDocx(draft: WorksheetDraft): Promise<void> {
  const { blob, fileName } = await exportWorksheetDocxBlob(draft)
  downloadBlob(blob, fileName)
}
