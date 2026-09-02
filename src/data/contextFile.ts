import JSZip from 'jszip'

export const CONTEXT_FILE_TEXT_MAX = 12_000

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png'])

function extension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function stripXml(xml: string): string {
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

async function extractDocxText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const doc = zip.file('word/document.xml')
  if (!doc) return ''
  const xml = await doc.async('string')
  return stripXml(xml)
}

export interface ContextFileResult {
  name: string
  text: string
  note?: string
}

/** Извлекает текст из приложенного файла для промптов ИИ. */
export async function extractContextFile(file: File): Promise<ContextFileResult> {
  const ext = extension(file.name)

  if (IMAGE_EXT.has(ext)) {
    return {
      name: file.name,
      text: '',
      note: `Приложено изображение «${file.name}». Текст не извлечён; опирайся на название файла, тему и пожелания учителя.`,
    }
  }

  if (ext === '.docx') {
    const text = await extractDocxText(file)
    return {
      name: file.name,
      text: text.slice(0, CONTEXT_FILE_TEXT_MAX),
      note: text ? undefined : `DOCX «${file.name}» не содержит извлекаемого текста.`,
    }
  }

  if (ext === '.pdf') {
    return {
      name: file.name,
      text: '',
      note: `Приложён PDF «${file.name}». Автоматическое извлечение текста недоступно; опирайся на тему, пожелания учителя и название файла.`,
    }
  }

  return { name: file.name, text: '' }
}

export function referenceFilePayload(draft: {
  contextFileName?: string
  contextFileText?: string
  contextFileNote?: string
}) {
  if (!draft.contextFileName?.trim()) return null
  const content = draft.contextFileText?.trim()
  const note = draft.contextFileNote?.trim()
  if (!content && !note) return null
  return {
    name: draft.contextFileName,
    content: content ? content.slice(0, CONTEXT_FILE_TEXT_MAX) : null,
    note: note || null,
  }
}
