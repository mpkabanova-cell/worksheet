import {
  prepareReferenceContentDetailed,
  type ContextFilterOptions,
  type PrepareReferenceResult,
} from './contextFilter'

export interface ContextFileResult {
  name: string
  text?: string
  note?: string
  truncated?: boolean
}

export interface ContextExtractResponse {
  text: string
  truncated?: boolean
}

export interface ContextExtractErrorResponse {
  error: string
  message: string
}

export interface ContextReferenceOptions {
  wishes?: string | null
  grade?: string | null
  block?: string | null
}

/** Единая точка: extract → блок по классу/пожеланиям → reference для plan/worksheet. */
export interface ContextReferenceResult extends PrepareReferenceResult {
  rawLength: number
}

export function contextFilterOptions(draft: {
  additionalWishes?: string
  grade?: string
}): ContextFilterOptions {
  return {
    wishes: draft.additionalWishes?.trim() || null,
    grade: draft.grade?.trim() || null,
  }
}

export function buildContextReference(
  rawText: string | undefined,
  options?: ContextReferenceOptions,
): ContextReferenceResult {
  const raw = rawText?.trim() ?? ''
  if (!raw) {
    return {
      content: '',
      selectedBlock: null,
      usedFallback: false,
      rawLength: 0,
    }
  }

  const filterOpts: ContextFilterOptions = {
    wishes: options?.wishes ?? null,
    grade: options?.grade ?? null,
    block: options?.block ?? null,
  }

  return {
    rawLength: raw.length,
    ...prepareReferenceContentDetailed(raw, filterOpts),
  }
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
      const text = await extractDocxTextFallback(file)
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
    truncated: data.truncated,
    note: text
      ? undefined
      : `Файл «${file.name}» приложён, но текст не извлечён.`,
  }
}

export function referenceFilePayload(draft: {
  contextFileName?: string
  contextFileText?: string
  contextFileNote?: string
  additionalWishes?: string
  grade?: string
}) {
  if (!draft.contextFileName?.trim()) return null
  const raw = draft.contextFileText?.trim()
  const note = draft.contextFileNote?.trim()

  if (!raw && !note) return null

  const prepared = raw ? buildContextReference(raw, contextFilterOptions(draft)) : null

  return {
    name: draft.contextFileName,
    content: prepared?.content || null,
    relevance_note:
      'В content только условия и учебный материал для заданий. Решения, ответы, ключи, разборы и иллюстрации из них исключены автоматически. Блок файла выбирается по пожеланиям или параллели формы.',
    filter_note: prepared?.fallbackReason ?? null,
    selected_block: prepared?.selectedBlock ?? null,
    note: note || null,
  }
}

/** source_content для агента планирования (spec). */
export function sourceContentForDraft(draft: {
  contextFileText?: string
  contextFileName?: string
  additionalWishes?: string
  grade?: string
}): string | null {
  const raw = draft.contextFileText?.trim()
  if (!raw) return null
  const { content } = buildContextReference(raw, contextFilterOptions(draft))
  return content || null
}
