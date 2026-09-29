import type { WorksheetDraft } from '@/data/worksheet'
import { downloadBlob } from '@/export/downloadBlob'
import { exportWorksheetDocxBlob } from '@/export/word/exportWorksheetDocx'

const PDF_UNAVAILABLE =
  'PDF недоступен на сервере (нужен LibreOffice). Скачайте DOCX или запустите сервер с установленным LibreOffice.'

export async function exportWorksheetPdf(draft: WorksheetDraft): Promise<void> {
  const { blob, fileName } = await exportWorksheetDocxBlob(draft)
  const pdfFileName = fileName.replace(/\.docx$/i, '.pdf')

  const form = new FormData()
  form.append('file', blob, fileName)

  const response = await fetch('/api/export/pdf', {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    let message = PDF_UNAVAILABLE
    try {
      const data = (await response.json()) as { message?: string; error?: string }
      if (typeof data.message === 'string' && data.message.trim()) {
        message = data.message
      }
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const pdfBlob = await response.blob()
  downloadBlob(pdfBlob, pdfFileName)
}
