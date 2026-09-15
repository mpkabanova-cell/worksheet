import { sanitizeAiJsonText } from './mathTextUtils'

export class AiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiError'
  }
}

function tryParseJson(text: string): unknown {
  return JSON.parse(sanitizeAiJsonText(text))
}

/** @internal Exported for tests. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  const attempts = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(),
    start >= 0 && end > start ? trimmed.slice(start, end + 1) : null,
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of attempts) {
    try {
      return tryParseJson(candidate)
    } catch {
      /* try next candidate */
    }
  }

  throw new AiError('Модель вернула невалидный JSON. Попробуйте сгенерировать ещё раз.')
}

/** Вызов идёт через серверный прокси `/api/chat` — ключ только на сервере. */
export async function chatJson<T>(
  system: string,
  user: string,
  options?: { temperature?: number },
): Promise<T> {
  const modelHint = (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || ''
  const payload: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.5,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }

  if (modelHint && !modelHint.includes('gemini')) {
    payload.response_format = { type: 'json_object' }
  }

  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new AiError('NO_API')
  }

  const raw = await res.text()

  if (res.status === 503) {
    throw new AiError('NO_API_KEY')
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = JSON.parse(raw) as {
        message?: string
        error?: string | { message?: string }
      }
      if (typeof err.message === 'string' && err.message.trim()) detail = err.message
      else if (typeof err.error === 'string') detail = err.error
      else if (err.error && typeof err.error === 'object' && err.error.message) {
        detail = err.error.message
      }
    } catch {
      detail = raw.trim()
    }

    if (!detail) {
      detail =
        res.status === 500 || res.status === 502 || res.status === 504
          ? 'API недоступен. Локально запустите: npm run dev (нужен и фронт, и сервер).'
          : `пустой ответ (${res.status})`
    }

    throw new AiError(`Ошибка API ${res.status}: ${detail.slice(0, 280)}`)
  }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    throw new AiError('Ответ сервера не JSON')
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new AiError('Пустой ответ модели')

  return extractJson(content) as T
}

export function isAiUnavailable(err: unknown): boolean {
  return (
    err instanceof AiError &&
    (err.message === 'NO_API_KEY' || err.message === 'NO_API')
  )
}
