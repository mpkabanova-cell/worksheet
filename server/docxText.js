/**
 * Порт docx_text.py — извлечение текста из DOCX (параграфы + таблицы).
 */

import JSZip from 'jszip'

function stripXml(xml) {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractTableRows(xml) {
  const rows = []
  const rowRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g
  let rowMatch
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const cells = []
    const cellRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g
    let cellMatch
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const cellText = stripXml(cellMatch[1]).replace(/\n+/g, ' ').trim()
      cells.push(cellText)
    }
    if (cells.some(Boolean)) {
      rows.push(cells.join(' | '))
    }
  }
  return rows
}

/**
 * @param {Buffer|Uint8Array} data
 */
export async function extractTextFromDocx(data) {
  const zip = await JSZip.loadAsync(data)
  const doc = zip.file('word/document.xml')
  if (!doc) return ''

  const xml = await doc.async('string')
  const parts = []

  const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)
  const body = bodyMatch ? bodyMatch[1] : xml

  const blockRe = /(<w:tbl\b[\s\S]*?<\/w:tbl>)|(<w:p\b[\s\S]*?<\/w:p>)/g
  let match
  while ((match = blockRe.exec(body)) !== null) {
    if (match[1]) {
      parts.push(...extractTableRows(match[1]))
    } else if (match[2]) {
      const t = stripXml(match[2])
      if (t) parts.push(t)
    }
  }

  if (!parts.length) {
    return stripXml(xml)
  }

  return parts.join('\n\n').trim()
}
