import { prepareReferenceContent } from './contextFilter'

export const CONTEXT_FILE_TEXT_MAX = 12_000

export interface ContextFileResult {
  name: string
  text?: string
  note?: string
}

export interface ContextExtractResponse {
  text: string
  truncated?: boolean
}

export interface ContextExtractErrorResponse {
  error: string
  message: string
}

async function extractDocxTextFallback(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const doc = zip.file('word/document.xml')
  if (!doc) return ''
  const xml = await doc.async('string')
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

/** Извлекает текст из приложенного файла для промптов ИИ (через серверный OCR). */
export async function extractContextFile(file: File): Promise<ContextFileResult> {
  const form = new FormData()
  form.append('file', file)

  let res: Response
  try {
    res = await fetch('/api/extract-context', {
      method: 'POST',
      body: form,
    })
  } catch {
    throw new Error('Не удалось связаться с сервером распознавания')
  }

  if (res.status === 503) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (ext === '.docx') {
      const text = (await extractDocxTextFallback(file)).slice(0, CONTEXT_FILE_TEXT_MAX)
      return {
        name: file.name,
        text,
        note: text ? undefined : `DOCX «${file.name}» не содержит извлекаемого текста.`,
      }
    }
  }

  let payload: ContextExtractResponse | ContextExtractErrorResponse
  try {
    payload = (await res.json()) as ContextExtractResponse | ContextExtractErrorResponse
  } catch {
    throw new Error('Сервер вернул некорректный ответ')
  }

  if (!res.ok) {
    const err = payload as ContextExtractErrorResponse
    throw new Error(err.message || 'Не удалось обработать файл')
  }

  const data = payload as ContextExtractResponse
  const text = data.text?.trim() || ''

  return {
    name: file.name,
    text: text || undefined,
    note: text
      ? undefined
      : `Файл «${file.name}» приложён, но текст не извлечён.`,
  }
}

export function referenceFilePayload(draft: {
  contextFileName?: string
  contextFileText?: string
  contextFileNote?: string
  wishes?: string
}) {
  if (!draft.contextFileName?.trim()) return null
  const raw = draft.contextFileText?.trim()
  const note = draft.contextFileNote?.trim()

  if (!raw && !note) return null

  const prepared = raw
    ? prepareReferenceContent(raw, { wishes: draft.wishes ?? null }).slice(0, CONTEXT_FILE_TEXT_MAX)
    : null

  return {
    name: draft.contextFileName,
    content: prepared || null,
    relevance_note:
      'В content только условия и учебный материал для заданий. Решения, ответы, ключи, разборы и иллюстрации из них исключены автоматически. Какой раздел файла использовать — см. additional_wishes.',
    note: note || null,
  }
}

/** source_content для агента планирования (spec). */
export function sourceContentForDraft(draft: {
  contextFileText?: string
  contextFileName?: string
  wishes?: string
}): string | null {
  const raw = draft.contextFileText?.trim()
  if (!raw) return null
  const filtered = prepareReferenceContent(raw, { wishes: draft.wishes ?? null })
  return filtered ? filtered.slice(0, CONTEXT_FILE_TEXT_MAX) : null
}
