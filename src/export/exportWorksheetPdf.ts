import type { WorksheetDraft } from '@/data/worksheet'
import { normalizeWorksheetDraft } from '@/data/blockUtils'
import { collectWorksheetPdfSlices } from '@/export/pdf/collectWorksheetPdfSlices'
import { composeWorksheetPdf } from '@/export/pdf/composeWorksheetPdf'
import { downloadBlob } from '@/export/downloadBlob'
import { ensureExportFontsLoaded } from '@/export/word/loadExportFonts'
import type { ExportContext, ExportOptions } from '@/export/word/types'
import { worksheetDisplayName } from '@/data/worksheet'

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'worksheet'
}

export async function exportWorksheetPdf(draft: WorksheetDraft): Promise<void> {
  const normalized = normalizeWorksheetDraft(draft)
  const options: ExportOptions = {
    showAnswers: normalized.showAnswers,
    showDifficulty: normalized.showDifficulty,
    answersSeparate: normalized.print.answersSeparate,
    orientation: normalized.print.orientation,
  }

  const ctx: ExportContext = {
    draft: normalized,
    options,
    subject: normalized.subject,
    mathCache: new Map(),
    imageCache: new Map(),
    domImageCache: new Map(),
  }

  await ensureExportFontsLoaded()
  const slices = await collectWorksheetPdfSlices(ctx)
  const pdfBlob = await composeWorksheetPdf(slices, normalized.print.orientation)
  const fileName = `${sanitizeFileName(worksheetDisplayName(normalized))}.pdf`
  downloadBlob(pdfBlob, fileName)
}
