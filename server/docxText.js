/**
 * Порт docx_text.py — извлечение текста из DOCX (параграфы + таблицы).
 */

import JSZip from 'jszip'

/** Убирает inline-рисунки Word до stripXml — иначе координаты wp:anchor/v:shape склеиваются в «502920061341…». */
function stripEmbeddedObjects(xml) {
  return xml
    .replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi, '')
    .replace(/<w:pict\b[\s\S]*?<\/w:pict>/gi, '')
    .replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/gi, '')
}

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

/** Хвосты координат wp:anchor, если рисунок не полностью вырезан из параграфа. */
function cleanCoordinateGarbage(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\d{8,}/, '').trimEnd())
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      const digits = (t.match(/\d/g) || []).length
      return !(t.length > 20 && digits / t.length > 0.85 && !/[а-яА-Яa-zA-Z]/.test(t))
    })
    .join('\n')
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
      const t = stripXml(stripEmbeddedObjects(match[2]))
      if (t) parts.push(t)
    }
  }

  if (!parts.length) {
    return cleanCoordinateGarbage(stripXml(stripEmbeddedObjects(xml)))
  }

  return cleanCoordinateGarbage(parts.join('\n\n').trim())
}
