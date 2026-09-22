/**
 * Извлечение текста из PDF: текстовый слой по страницам + vision OCR только там, где текста мало.
 */

import { callVisionOcr } from './visionOcr.js'

/** @typedef {'sparse' | 'all' | 'off'} PdfVisionMode */

function getMaxPages(env = process.env) {
  const raw = env.CONTEXT_PDF_MAX_PAGES
  if (raw == null || raw === '' || raw === '0') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, 200)
}

function getPageTextMin(env = process.env) {
  const n = Number(env.PDF_PAGE_TEXT_MIN)
  return Number.isFinite(n) && n > 0 ? n : 120
}

/** @returns {PdfVisionMode} */
function getVisionMode(env = process.env) {
  const mode = (env.PDF_VISION_MODE || 'sparse').trim().toLowerCase()
  if (mode === 'all' || mode === 'off') return mode
  return 'sparse'
}

function getVisionConcurrency(env = process.env) {
  const n = Number(env.PDF_VISION_CONCURRENCY)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : 3
}

function getScreenshotScale(env = process.env) {
  const n = Number(env.PDF_SCREENSHOT_SCALE)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2) : 1.25
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

function pageNumber(page, index) {
  return page?.pageNumber ?? index + 1
}

function pageText(page) {
  return (page?.text || '').trim()
}

function textParams(maxPages) {
  return maxPages ? { first: maxPages } : {}
}

/** @param {string} text @param {PdfVisionMode} mode @param {number} minChars */
export function pageNeedsVision(text, mode, minChars) {
  if (mode === 'off') return false
  if (mode === 'all') return true
  return text.length < minChars
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} worker
 */
async function mapPool(items, concurrency, worker) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      await worker(item)
    }
  })
  await Promise.all(runners)
}

/**
 * @param {Buffer} data
 * @param {import('./visionOcr.js').getVisionConfig extends (...args: any) => infer R ? R : never} [visionConfig]
 */
export async function extractTextFromPdf(data, visionConfig) {
  const maxPages = getMaxPages()
  const pageTextMin = getPageTextMin()
  const visionMode = getVisionMode()
  const visionConcurrency = getVisionConcurrency()
  const screenshotScale = getScreenshotScale()
  const { PDFParse } = await loadPdfParse()
  const parser = new PDFParse({ data })

  /** @type {Map<number, string>} */
  const pageContent = new Map()
  /** @type {number[]} */
  let orderedPageNumbers = []

  try {
    if (useTextLayer()) {
      try {
        const textResult = await parser.getText(textParams(maxPages))
        const pages = textResult.pages?.length
          ? textResult.pages
          : textResult.text?.trim()
            ? [{ pageNumber: 1, text: textResult.text }]
            : []

        orderedPageNumbers = pages.map((page, index) => pageNumber(page, index))
        for (let i = 0; i < pages.length; i++) {
          const num = orderedPageNumbers[i]
          const text = pageText(pages[i])
          if (text) pageContent.set(num, text)
        }
      } catch {
        /* vision fallback below */
      }
    }

    const visionPages = orderedPageNumbers.filter((num) =>
      pageNeedsVision(pageContent.get(num) || '', visionMode, pageTextMin),
    )

    if (visionPages.length) {
      try {
        const screenshot = await parser.getScreenshot({
          scale: screenshotScale,
          partial: visionPages,
        })

        /** @type {Map<number, Buffer>} */
        const pngByPage = new Map()
        for (let i = 0; i < (screenshot.pages ?? []).length; i++) {
          const shotPage = screenshot.pages[i]
          const png = pageImageBuffer(shotPage)
          if (!png) continue
          pngByPage.set(visionPages[i], png)
        }

        await mapPool(visionPages, visionConcurrency, async (pageNum) => {
          const png = pngByPage.get(pageNum)
          if (!png) return
          const visionText = (await callVisionOcr(png, 'image/png', visionConfig)).trim()
          if (!visionText) return
          const existing = pageContent.get(pageNum) || ''
          pageContent.set(
            pageNum,
            existing && visionMode === 'sparse'
              ? `${existing}\n\n${visionText}`.trim()
              : visionText,
          )
        })
      } catch {
        /* оставляем текстовый слой */
      }
    }

    if (!pageContent.size && visionMode !== 'off') {
      const fallbackPages = maxPages ? Array.from({ length: maxPages }, (_, i) => i + 1) : [1]
      orderedPageNumbers = fallbackPages
      const screenshot = await parser.getScreenshot({
        scale: screenshotScale,
        partial: fallbackPages,
      })
      await mapPool(fallbackPages, visionConcurrency, async (pageNum) => {
        const idx = fallbackPages.indexOf(pageNum)
        const png = pageImageBuffer(screenshot.pages?.[idx])
        if (!png) return
        const visionText = (await callVisionOcr(png, 'image/png', visionConfig)).trim()
        if (visionText) pageContent.set(pageNum, visionText)
      })
    }
  } finally {
    await parser.destroy()
  }

  const nums = orderedPageNumbers.length
    ? orderedPageNumbers
    : [...pageContent.keys()].sort((a, b) => a - b)

  return nums
    .map((num) => pageContent.get(num)?.trim())
    .filter(Boolean)
    .join('\n\n---\n\n')
    .trim()
}
