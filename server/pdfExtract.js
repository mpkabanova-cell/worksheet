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
  const parts = []

  if (useTextLayer()) {
    try {
      const textLayer = await extractTextLayer(data)
      if (textLayer) parts.push(textLayer)
    } catch {
      /* vision still runs */
    }
  }

  const pages = await renderPagesToPng(data, maxPages)
  if (!pages.length && !parts.length) {
    return ''
  }

  const visionChunks = []
  for (let i = 0; i < pages.length; i += 1) {
    const pageText = await callVisionOcr(pages[i], 'image/png', visionConfig)
    if (pageText.trim()) {
      visionChunks.push(pageText.trim())
    }
  }

  if (visionChunks.length) {
    parts.push(visionChunks.join('\n\n---\n\n'))
  }

  return parts.join('\n\n').trim()
}
