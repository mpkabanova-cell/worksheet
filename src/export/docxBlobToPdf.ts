import { renderAsync } from 'docx-preview'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/** Префикс классов docx-preview (см. `${className}-wrapper`, `section.${className}`). */
const DOCX_PREVIEW_CLASS = 'docx'

function findPreviewRoot(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector(`.${DOCX_PREVIEW_CLASS}-wrapper`)
  if (wrapper instanceof HTMLElement) return wrapper

  const legacyWrapper = container.querySelector('.docx-wrapper')
  if (legacyWrapper instanceof HTMLElement) return legacyWrapper

  const firstSection = container.querySelector(`section.${DOCX_PREVIEW_CLASS}`)
  if (firstSection instanceof HTMLElement) {
    return (firstSection.parentElement as HTMLElement) ?? container
  }

  if (container.firstElementChild instanceof HTMLElement) {
    return container.firstElementChild
  }

  throw new Error('Не удалось отрисовать документ для PDF')
}

function findPreviewPages(root: HTMLElement): HTMLElement[] {
  const sections = Array.from(
    root.querySelectorAll(`:scope > section.${DOCX_PREVIEW_CLASS}, section.${DOCX_PREVIEW_CLASS}`),
  ).filter((el): el is HTMLElement => el instanceof HTMLElement)

  if (sections.length > 0) return sections

  const anySections = Array.from(root.querySelectorAll(':scope > section')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
  if (anySections.length > 0) return anySections

  return [root]
}

export async function docxBlobToPdf(
  docxBlob: Blob,
  orientation: 'portrait' | 'landscape',
): Promise<Blob> {
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  Object.assign(container.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '210mm',
    minHeight: '297mm',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
    overflow: 'visible',
    background: '#ffffff',
  })
  document.body.appendChild(container)

  try {
    await renderAsync(await docxBlob.arrayBuffer(), container, container, {
      className: DOCX_PREVIEW_CLASS,
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      useBase64URL: true,
    })

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const root = findPreviewRoot(container)
    const pageElements = findPreviewPages(root)

    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'l' : 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pageElements.length; i += 1) {
      const el = pageElements[i]!
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: el.scrollWidth || el.offsetWidth,
        windowHeight: el.scrollHeight || el.offsetHeight,
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(
      detail.includes('Не удалось отрисовать')
        ? detail
        : `Не удалось отрисовать документ для PDF: ${detail}`,
    )
  } finally {
    container.remove()
  }
}
