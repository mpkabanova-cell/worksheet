/**
 * Извлечение контекста из DOCX через vision: PDF-конвертация или fallback на embedded images.
 */

import JSZip from 'jszip'
import { convertDocxToPdf } from './docxToPdf.js'
import { extractTextFromDocx } from './docxText.js'
import { extractTextFromPdf } from './pdfExtract.js'
import { callVisionOcr, guessImageMime } from './visionOcr.js'

/**
 * @param {import('jszip').JSZipObject} file
 */
async function readZipBuffer(file) {
  return Buffer.from(await file.async('arraybuffer'))
}

/**
 * @param {Buffer} buffer
 * @param {ReturnType<import('./visionOcr.js').getVisionConfig>} visionConfig
 */
export async function extractTextFromDocxWithVision(buffer, visionConfig) {
  const pdfBuffer = await convertDocxToPdf(buffer)
  if (pdfBuffer) {
    return extractTextFromPdf(pdfBuffer, visionConfig)
  }

  console.warn('[docxVision] LibreOffice недоступен — fallback: XML-текст + OCR embedded images')

  const zip = await JSZip.loadAsync(buffer)
  const text = await extractTextFromDocx(buffer)
  const parts = text ? [text] : []

  const mediaFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('word/media/') && !zip.files[name].dir,
  )

  for (const name of mediaFiles) {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'].includes(ext)) {
      continue
    }
    const imageBuffer = await readZipBuffer(zip.file(name))
    const mime = guessImageMime(name)
    const description = await callVisionOcr(imageBuffer, mime, visionConfig)
    if (description.trim()) {
      parts.push(description.trim())
    }
  }

  return parts.join('\n\n').trim()
}
