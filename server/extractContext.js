/**
 * Маршрутизация извлечения контекста по типу файла.
 */

import { extractTextFromDocxWithVision } from './docxVision.js'
import { extractTextFromPdf } from './pdfExtract.js'
import { callVisionOcr, getVisionConfig, guessImageMime } from './visionOcr.js'
import { truncateContextText } from './markdownClean.js'
import { AUTH_ERROR_USER_MESSAGE, messageLooksLikeAuthFailure } from './openrouterEnv.js'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function extension(name) {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function rethrowExtractError(err) {
  if (err instanceof ContextExtractError) throw err
  const detail = err instanceof Error ? err.message : 'Не удалось обработать файл'
  if (messageLooksLikeAuthFailure(detail)) {
    throw new ContextExtractError('AUTH_ERROR', AUTH_ERROR_USER_MESSAGE, 401)
  }
  throw err
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} [contentType]
 */
export async function extractContextFromFile(buffer, filename, contentType) {
  const ext = extension(filename)
  const visionConfig = getVisionConfig()

  let text = ''

  if (ext === '.docx') {
    if (!visionConfig.apiKey) {
      throw new ContextExtractError('NO_API_KEY', 'OPENAI_API_KEY не задан на сервере', 503)
    }
    try {
      text = await extractTextFromDocxWithVision(buffer, visionConfig)
    } catch (err) {
      rethrowExtractError(err)
    }
  } else if (ext === '.pdf') {
    if (!visionConfig.apiKey) {
      throw new ContextExtractError('NO_API_KEY', 'OPENAI_API_KEY не задан на сервере', 503)
    }
    try {
      text = await extractTextFromPdf(buffer, visionConfig)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Не удалось обработать PDF'
      if (messageLooksLikeAuthFailure(detail)) {
        throw new ContextExtractError('AUTH_ERROR', AUTH_ERROR_USER_MESSAGE, 401)
      }
      throw new ContextExtractError(
        'PDF_EXTRACT_ERROR',
        `Не удалось извлечь текст из PDF: ${detail}`,
        502,
      )
    }
  } else if (IMAGE_EXT.has(ext)) {
    if (!visionConfig.apiKey) {
      throw new ContextExtractError('NO_API_KEY', 'OPENAI_API_KEY не задан на сервере', 503)
    }
    const mime = guessImageMime(filename, contentType)
    try {
      text = await callVisionOcr(buffer, mime, visionConfig)
    } catch (err) {
      rethrowExtractError(err)
    }
  } else {
    throw new ContextExtractError(
      'BAD_FORMAT',
      'Поддерживаются форматы docx, pdf, jpg, png',
      400,
    )
  }

  const { text: trimmed, truncated } = truncateContextText(text)
  return { text: trimmed, truncated }
}

export class ContextExtractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message)
    this.name = 'ContextExtractError'
    this.code = code
    this.status = status
  }
}
