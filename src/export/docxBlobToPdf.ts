import { renderAsync } from 'docx-preview'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function docxBlobToPdf(
  docxBlob: Blob,
  orientation: 'portrait' | 'landscape',
): Promise<Blob> {
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    zIndex: '-1',
    background: '#ffffff',
  })
  document.body.appendChild(container)

  try {
    await renderAsync(await docxBlob.arrayBuffer(), container, undefined, {
      className: 'docx-export-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
    })

    const wrapper = container.querySelector('.docx-wrapper')
    if (!wrapper) {
      throw new Error('Не удалось отрисовать документ для PDF')
    }

    let pageElements = Array.from(wrapper.querySelectorAll(':scope > section'))
    if (pageElements.length === 0) {
      pageElements = [wrapper as HTMLElement]
    }

    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'l' : 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pageElements.length; i += 1) {
      const el = pageElements[i] as HTMLElement
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      let drawWidth = pageWidth
      let drawHeight = (canvas.height * drawWidth) / canvas.width
      if (drawHeight > pageHeight) {
        drawHeight = pageHeight
        drawWidth = (canvas.width * drawHeight) / canvas.height
      }
      const offsetX = (pageWidth - drawWidth) / 2
      const offsetY = (pageHeight - drawHeight) / 2

      if (i > 0) {
        pdf.addPage()
      }
      pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawWidth, drawHeight, undefined, 'FAST')
    }

    return pdf.output('blob')
  } finally {
    container.remove()
  }
}
