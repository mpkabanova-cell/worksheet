/**
 * Извлечение текста из PDF: текстовый слой или vision OCR по страницам (сканы).
 */

import { callVisionOcr } from './visionOcr.js'

const MIN_TEXT_CHARS = 200

function getMaxPages(env = process.env) {
  const n = Number(env.CONTEXT_PDF_MAX_PAGES)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 3
}

/**
 * @param {Buffer} data
 */
async function extractTextLayer(data) {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    return (result.text || '').trim()
  } finally {
    await parser.destroy()
  }
}

/**
 * @param {Buffer} data
 * @param {number} maxPages
 */
async function renderPagesToPng(data, maxPages) {
  const { pdf } = await import('pdf-to-img')
  const document = await pdf(data, { scale: 2 })
  const pages = []
  let i = 0
  try {
    for await (const image of document) {
      if (i >= maxPages) break
      pages.push(Buffer.from(image))
      i += 1
    }
  } finally {
    await document.destroy()
  }
  return pages
}

/**
 * @param {Buffer} data
 * @param {import('./visionOcr.js').getVisionConfig extends (...args: any) => infer R ? R : never} [visionConfig]
 */
export async function extractTextFromPdf(data, visionConfig) {
  const maxPages = getMaxPages()

  try {
    const textLayer = await extractTextLayer(data)
    if (textLayer.length >= MIN_TEXT_CHARS) {
      return textLayer
    }
  } catch {
    /* fall through to vision */
  }

  const pages = await renderPagesToPng(data, maxPages)
  if (!pages.length) {
    return ''
  }

  const chunks = []
  for (let i = 0; i < pages.length; i += 1) {
    const pageText = await callVisionOcr(pages[i], 'image/png', visionConfig)
    if (pageText.trim()) {
      chunks.push(pageText.trim())
    }
  }

  return chunks.join('\n\n---\n\n')
}
