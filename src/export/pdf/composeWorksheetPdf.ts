import { jsPDF } from 'jspdf'
import { pngBytesToDataUrl } from '@/export/pdf/pngDataUrl'
import type { PdfSlice } from '@/export/pdf/pdfSlice'
import { SHEET_CONTENT_WIDTH_PX } from '@/export/word/layoutTokens'
import { PAGE_MARGIN_TWIPS } from '@/export/word/build/buildHeader'

/** twips → mm (1 twip = 1/567 inch × 25.4). */
function twipsToMm(twips: number): number {
  return (twips / 567) * 25.4
}

const MARGIN_MM = twipsToMm(PAGE_MARGIN_TWIPS)
const PX_TO_MM = 25.4 / 96

export async function composeWorksheetPdf(
  slices: PdfSlice[],
  orientation: 'portrait' | 'landscape',
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  let pageWidth = pdf.internal.pageSize.getWidth()
  let pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidthMm = pageWidth - MARGIN_MM * 2
  let y = MARGIN_MM

  const startNewPage = () => {
    pdf.addPage()
    pageWidth = pdf.internal.pageSize.getWidth()
    pageHeight = pdf.internal.pageSize.getHeight()
    y = MARGIN_MM
  }

  for (const slice of slices) {
    if (slice.kind === 'pageBreak') {
      startNewPage()
      continue
    }

    const { image, gapAfterPx = 0 } = slice
    const imgWidthMm = (image.width / SHEET_CONTENT_WIDTH_PX) * contentWidthMm
    const imgHeightMm = imgWidthMm * (image.height / Math.max(1, image.width))
    const gapMm = gapAfterPx * PX_TO_MM

    if (y + imgHeightMm > pageHeight - MARGIN_MM) {
      startNewPage()
    }

    const imgData = pngBytesToDataUrl(image.data)
    pdf.addImage(imgData, 'PNG', MARGIN_MM, y, imgWidthMm, imgHeightMm, undefined, 'FAST')
    y += imgHeightMm + gapMm
  }

  return pdf.output('blob')
}
