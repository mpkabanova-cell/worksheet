import type { WorksheetDraft } from '@/data/worksheet'
import { normalizeWorksheetDraft } from '@/data/blockUtils'
import { docxBlobToPdf } from '@/export/docxBlobToPdf'
import { downloadBlob } from '@/export/downloadBlob'
import { exportWorksheetDocxBlob } from '@/export/word/exportWorksheetDocx'

export async function exportWorksheetPdf(draft: WorksheetDraft): Promise<void> {
  const normalized = normalizeWorksheetDraft(draft)
  const { blob, fileName } = await exportWorksheetDocxBlob(normalized)
  const pdfFileName = fileName.replace(/\.docx$/i, '.pdf')
  const pdfBlob = await docxBlobToPdf(blob, normalized.print.orientation)
  downloadBlob(pdfBlob, pdfFileName)
}
