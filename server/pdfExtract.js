/**
 * Извлечение текста из PDF: vision OCR по страницам + опционально текстовый слой pdf-parse.
 */

import { callVisionOcr } from './visionOcr.js'

function getMaxPages(env = process.env) {
  const n = Number(env.CONTEXT_PDF_MAX_PAGES)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 3
}

function useTextLayer(env = process.env) {
  return env.PDF_EXTRACT_TEXT_LAYER !== '0'
}

async function loadPdfParse() {
  await import('pdf-parse/worker')
  return import('pdf-parse')
}

function pageImageBuffer(page) {
  const raw = page?.imageBuffer ?? page?.data
  if (!raw) return null
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
}

/**
 * @param {Buffer} data
 * @param {import('./visionOcr.js').getVisionConfig extends (...args: any) => infer R ? R : never} [visionConfig]
 */
export async function extractTextFromPdf(data, visionConfig) {
  const maxPages = getMaxPages()
  const { PDFParse } = await loadPdfParse()
  const parser = new PDFParse({ data })
  const parts = []
  let screenshotError = null

  try {
    if (useTextLayer()) {
      try {
        const result = await parser.getText({ first: maxPages })
        const textLayer = (result.text || '').trim()
        if (textLayer) parts.push(textLayer)
      } catch {
        /* vision still runs */
      }
    }

    try {
      const screenshot = await parser.getScreenshot({ scale: 2, first: maxPages })
      const visionChunks = []
      for (const page of screenshot.pages ?? []) {
        const pngBuffer = pageImageBuffer(page)
        if (!pngBuffer) continue
        const pageText = await callVisionOcr(pngBuffer, 'image/png', visionConfig)
        if (pageText.trim()) {
          visionChunks.push(pageText.trim())
        }
      }
      if (visionChunks.length) {
        parts.push(visionChunks.join('\n\n---\n\n'))
      }
    } catch (err) {
      screenshotError = err
      if (!parts.length) throw err
    }
  } finally {
    await parser.destroy()
  }

  if (!parts.length && screenshotError) {
    const message =
      screenshotError instanceof Error
        ? screenshotError.message
        : 'Не удалось распознать страницы PDF'
    throw new Error(message)
  }

  return parts.join('\n\n').trim()
}
