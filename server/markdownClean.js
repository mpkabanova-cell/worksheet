/**
 * Порт strip_markdown_images из ocr_to_doc_project-main/backend/app/markdown_merge.py
 */

const MD_IMAGE = /!\[[^\]]*\]\([^)]*\)/gm
const HTML_IMG = /<img\b[^>]*>/gi

export function stripMarkdownImages(text) {
  let s = text.replace(MD_IMAGE, '')
  s = s.replace(HTML_IMG, '')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

export const CONTEXT_FILE_TEXT_MAX = 12_000

export function truncateContextText(text) {
  const trimmed = text.trim()
  if (trimmed.length <= CONTEXT_FILE_TEXT_MAX) {
    return { text: trimmed, truncated: false }
  }
  return { text: trimmed.slice(0, CONTEXT_FILE_TEXT_MAX), truncated: true }
}
