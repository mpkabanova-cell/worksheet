/**
 * DOCX: текст + vision OCR встроенных картинок на месте в документе.
 * Порт паттерна ocr_to_doc (/api/process-image → call_openrouter_vision).
 * Без LibreOffice — работает на Render.
 */

import JSZip from 'jszip'
import { callVisionOcr, guessImageMime } from './visionOcr.js'

const OCR_MEDIA_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'])
const EMBED_RE = /r:embed="(rId[^"]+)"/g
const LINK_RE = /r:link="(rId[^"]+)"/g
const REL_RE = /Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g

function findNextOpen(body, openTag, from) {
  if (
    openTag === '<w:r' ||
    openTag === '<w:p' ||
    openTag === '<w:tbl' ||
    openTag === '<w:tr' ||
    openTag === '<w:tc'
  ) {
    return findNextTagIndex(body, openTag, from)
  }
  return body.indexOf(openTag, from)
}

function extractBalancedElement(body, start, openTag, closeTag) {
  const openEnd = body.indexOf('>', start)
  if (openEnd === -1) return null
  let depth = 1
  let pos = openEnd + 1
  while (pos < body.length) {
    const nextOpen = findNextOpen(body, openTag, pos)
    const nextClose = body.indexOf(closeTag, pos)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      const openEndNested = body.indexOf('>', nextOpen)
      if (openEndNested === -1) return null
      pos = openEndNested + 1
    } else {
      depth -= 1
      if (depth === 0) {
        return body.slice(start, nextClose + closeTag.length)
      }
      pos = nextClose + closeTag.length
    }
  }
  return null
}

/** Топ-уровневые w:p / w:tbl с учётом вложенных параграфов (text box в drawing). */
function splitBodyBlocks(body) {
  /** @type {Array<{ type: 'p' | 'tbl', xml: string }>} */
  const blocks = []
  let i = 0
  while (i < body.length) {
    const pIdx = findNextTagIndex(body, '<w:p', i)
    const tIdx = findNextTagIndex(body, '<w:tbl', i)
    if (pIdx === -1 && tIdx === -1) break

    const useTable = tIdx !== -1 && (pIdx === -1 || tIdx < pIdx)
    const start = useTable ? tIdx : pIdx
    const openTag = useTable ? '<w:tbl' : '<w:p'
    const closeTag = useTable ? '</w:tbl>' : '</w:p>'
    const xml = extractBalancedElement(body, start, openTag, closeTag)
    if (!xml) break
    blocks.push({ type: useTable ? 'tbl' : 'p', xml })
    i = start + xml.length
  }
  return blocks
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
}

function extractTextFromXmlFragment(fragment) {
  const parts = []
  for (const block of splitBodyBlocks(fragment)) {
    if (block.type !== 'p') continue
    const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
    let m
    while ((m = tRe.exec(block.xml))) {
      const t = decodeXmlEntities(m[1]).replace(/<[^>]+>/g, '').trim()
      if (t) parts.push(t)
    }
  }
  return [...new Set(parts)].join('\n')
}

function extractRunText(runXml, seenFragments) {
  const parts = []
  const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  let m
  while ((m = tRe.exec(runXml))) {
    let text = decodeXmlEntities(m[1])
    if (text.includes('<w:p') || text.includes('<w:r')) {
      if (seenFragments?.has(text)) continue
      seenFragments?.add(text)
      text = extractTextFromXmlFragment(text)
    } else {
      text = text.replace(/<[^>]+>/g, '').trim()
    }
    if (text) parts.push(text)
  }
  if (/<w:tab\/>/.test(runXml)) parts.push('\t')
  if (/<w:br\/>/.test(runXml)) parts.push('\n')
  return parts.join('')
}

function findEmbedIds(blockXml) {
  const ids = []
  for (const re of [EMBED_RE, LINK_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(blockXml))) {
      if (!ids.includes(m[1])) ids.push(m[1])
    }
  }
  return ids
}

function parseRelationshipMap(relsXml) {
  const map = new Map()
  let m
  REL_RE.lastIndex = 0
  while ((m = REL_RE.exec(relsXml))) {
    const target = m[2].startsWith('word/') ? m[2] : `word/${m[2]}`
    map.set(m[1], target)
  }
  return map
}

/**
 * @param {import('jszip').JSZip} zip
 * @param {string} mediaPath
 */
async function readZipBuffer(zip, mediaPath) {
  const file = zip.file(mediaPath)
  if (!file) return null
  return Buffer.from(await file.async('arraybuffer'))
}

/**
 * @param {Map<string, string>} cache
 */
async function ocrRelationshipImage(embedId, relMap, zip, visionConfig, cache) {
  const mediaPath = relMap.get(embedId)
  if (!mediaPath) return ''
  if (cache.has(mediaPath)) return cache.get(mediaPath) || ''

  const ext = mediaPath.slice(mediaPath.lastIndexOf('.')).toLowerCase()
  if (!OCR_MEDIA_EXT.has(ext)) {
    cache.set(mediaPath, '')
    return ''
  }

  const buf = await readZipBuffer(zip, mediaPath)
  if (!buf?.length) {
    cache.set(mediaPath, '')
    return ''
  }

  const raw = (await callVisionOcr(buf, guessImageMime(mediaPath), visionConfig)).trim()
  const description = normalizeVisionDescription(raw)
  cache.set(mediaPath, description)
  return description
}

/** Каждая картинка → [описание]; если модель вернула текст без скобок — оборачиваем. */
function normalizeVisionDescription(raw) {
  const text = raw.trim()
  if (!text) return ''
  if (/\[[^\]]+\]/.test(text)) return text
  const inner = text.replace(/^\[+|\]+$/g, '').trim()
  return `[${inner}]`
}

/**
 * @param {Map<string, string>} cache
 */
async function processDrawingBlock(blockXml, relMap, zip, visionConfig, cache) {
  const chunks = []
  const seenInBlock = new Set()
  for (const embedId of findEmbedIds(blockXml)) {
    if (seenInBlock.has(embedId)) continue
    seenInBlock.add(embedId)
    const desc = await ocrRelationshipImage(embedId, relMap, zip, visionConfig, cache)
    if (desc) chunks.push(desc)
  }
  return chunks.join('\n\n')
}

/** Word иногда дублирует text box в mc:Choice + mc:Fallback — «1 мин=2 мин1 мин=2 мин». */
function normalizeTimelineLine(line) {
  let s = line.replace(/\s+/g, ' ').trim()
  s = s.replace(/(\d)([а-яА-Я])/g, '$1 $2').replace(/([а-яА-Я])(=)/g, '$1 $2')
  const half = Math.floor(s.length / 2)
  if (half > 5 && s.slice(0, half).trim() === s.slice(half).trim()) {
    s = s.slice(0, half).trim()
  }
  return s.replace(/\s+([.,;:!?])/g, '$1').trim()
}

/** Склеивает текст; каждое [описание картинки] — на своём месте в потоке. */
function mergeParagraphParts(parts) {
  const out = []
  let textBuf = []

  const flushText = () => {
    if (!textBuf.length) return
    const line = normalizeTimelineLine(textBuf.join(' '))
    textBuf = []
    if (line && out[out.length - 1] !== line) out.push(line)
  }

  for (const part of parts) {
    const p = part.trim()
    if (!p) continue
    if (p.startsWith('[')) {
      flushText()
      out.push(p)
    } else {
      textBuf.push(p.replace(/\s+/g, ' ').trim())
    }
  }
  flushText()
  return out.join('\n\n')
}

function findNextTagIndex(body, openTag, from) {
  let idx = from
  while ((idx = body.indexOf(openTag, idx)) !== -1) {
    const next = body.charAt(idx + openTag.length)
    if (next === '>' || next === ' ' || next === '/') return idx
    idx += openTag.length
  }
  return -1
}

/**
 * @param {Map<string, string>} cache
 */
async function processParagraph(pXml, relMap, zip, visionConfig, cache) {
  const parts = []
  const seenFragments = new Set()
  let i = 0
  while (i < pXml.length) {
    const candidates = [
      { kind: 'r', idx: findNextTagIndex(pXml, '<w:r', i), open: '<w:r', close: '</w:r>' },
      {
        kind: 'd',
        idx: findNextTagIndex(pXml, '<w:drawing', i),
        open: '<w:drawing',
        close: '</w:drawing>',
      },
      { kind: 'p', idx: findNextTagIndex(pXml, '<w:pict', i), open: '<w:pict', close: '</w:pict>' },
      {
        kind: 'm',
        idx: findNextTagIndex(pXml, '<mc:AlternateContent', i),
        open: '<mc:AlternateContent',
        close: '</mc:AlternateContent>',
      },
    ]
      .filter((c) => c.idx !== -1)
      .sort((a, b) => a.idx - b.idx)

    if (!candidates.length) break

    const next = candidates[0]
    const blockXml = extractBalancedElement(pXml, next.idx, next.open, next.close)
    if (!blockXml) break

    if (next.kind === 'r') {
      const t = extractRunText(blockXml, seenFragments)
      if (t) parts.push(t)
      const desc = await processDrawingBlock(blockXml, relMap, zip, visionConfig, cache)
      if (desc) parts.push(desc)
    } else {
      const desc = await processDrawingBlock(blockXml, relMap, zip, visionConfig, cache)
      if (desc) parts.push(desc)
    }

    i = next.idx + blockXml.length
  }

  return mergeParagraphParts(parts)
}

/**
 * @param {Map<string, string>} cache
 */
async function processTable(tblXml, relMap, zip, visionConfig, cache) {
  const rows = []
  let rowStart = 0
  while (rowStart < tblXml.length) {
    const trIdx = findNextTagIndex(tblXml, '<w:tr', rowStart)
    if (trIdx === -1) break
    const rowXml = extractBalancedElement(tblXml, trIdx, '<w:tr', '</w:tr>')
    if (!rowXml) break

    const cells = []
    let cellStart = 0
    while (cellStart < rowXml.length) {
      const tcIdx = findNextTagIndex(rowXml, '<w:tc', cellStart)
      if (tcIdx === -1) break
      const cellXml = extractBalancedElement(rowXml, tcIdx, '<w:tc', '</w:tc>')
      if (!cellXml) break

      const cellParts = []
      for (const block of splitBodyBlocks(cellXml)) {
        if (block.type !== 'p') continue
        const t = await processParagraph(block.xml, relMap, zip, visionConfig, cache)
        if (t) cellParts.push(t.replace(/\n+/g, ' '))
      }
      cells.push(cellParts.join(' ').trim())
      cellStart = tcIdx + cellXml.length
    }

    if (cells.some(Boolean)) rows.push(cells.join(' | '))
    rowStart = trIdx + rowXml.length
  }
  return rows
}

/**
 * @param {Buffer} buffer
 * @param {ReturnType<import('./visionOcr.js').getVisionConfig>} visionConfig
 */
export async function extractTextFromDocxWithVision(buffer, visionConfig) {
  const zip = await JSZip.loadAsync(buffer)
  const doc = zip.file('word/document.xml')
  if (!doc) return ''

  const xml = await doc.async('string')
  const relsFile = zip.file('word/_rels/document.xml.rels')
  const relsXml = relsFile ? await relsFile.async('string') : ''
  const relMap = parseRelationshipMap(relsXml)
  /** @type {Map<string, string>} */
  const ocrCache = new Map()

  const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)
  const body = bodyMatch ? bodyMatch[1] : xml
  const output = []

  for (const block of splitBodyBlocks(body)) {
    if (block.type === 'tbl') {
      const rows = await processTable(block.xml, relMap, zip, visionConfig, ocrCache)
      output.push(...rows)
    } else {
      const t = await processParagraph(block.xml, relMap, zip, visionConfig, ocrCache)
      if (t) output.push(t)
    }
  }

  return output.join('\n\n').trim()
}
