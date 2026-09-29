import { sanitizeAiJsonText } from './mathTextUtils'

export const AUTH_ERROR_USER_MESSAGE =
  'OpenRouter отклонил ключ API. Обновите OPENAI_API_KEY (или OPENROUTER_API_KEY) в Render → Environment или в локальном .env — нужен актуальный ключ sk-or-... с openrouter.ai/keys.'

export const OPENROUTER_USER_NOT_FOUND_MESSAGE =
  'OpenRouter: «User not found» — ключ не подходит для генерации. Создайте обычный inference API key на openrouter.ai/settings/keys (не provisioning/management). Ключ мог истечь или быть отозван — создайте новый и обновите OPENAI_API_KEY на Render и в .env.'

export function isAuthError(err: unknown): boolean {
  if (!(err instanceof AiError)) return false
  const m = err.message
  return (
    m === AUTH_ERROR_USER_MESSAGE ||
    m === OPENROUTER_USER_NOT_FOUND_MESSAGE ||
    m.startsWith('OpenRouter отклонил') ||
    m.startsWith('OpenRouter: «User not found»')
  )
}

export class AiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiError'
  }
}

function tryParseJson(text: string): unknown {
  return JSON.parse(sanitizeAiJsonText(text))
}

function repairCommonJsonIssues(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, '$1')
}

/** Извлекает первый сбалансированный JSON-объект (не lastIndexOf('}')). */
function extractBalancedJsonSlice(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === '"' && !isEscapedJsonQuote(text, i)) inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

function isEscapedJsonQuote(text: string, quoteIndex: number): boolean {
  let backslashes = 0
  for (let i = quoteIndex - 1; i >= 0 && text[i] === '\\'; i -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

/** @internal Exported for tests. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const balanced = extractBalancedJsonSlice(trimmed)
  const attempts = [
    trimmed,
    fenced,
    balanced,
    balanced ? repairCommonJsonIssues(balanced) : null,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
      ? repairCommonJsonIssues(trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)![1]!.trim())
      : null,
  ].filter((candidate): candidate is string => Boolean(candidate))

  const seen = new Set<string>()
  for (const candidate of attempts) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    try {
      return tryParseJson(candidate)
    } catch {
      try {
        return tryParseJson(repairCommonJsonIssues(candidate))
      } catch {
        /* try next candidate */
      }
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
  const modelHint = (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || ''
  const skipJsonFormat = modelHint.toLowerCase().includes('gemini')

  const payload: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.5,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (!skipJsonFormat) {
    payload.response_format = { type: 'json_object' }
  }

  let lastParseError: unknown

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages =
      attempt === 0
        ? (payload.messages as { role: string; content: string }[])
        : [
            {
              role: 'system',
              content: `${system}\n\nКРИТИЧНО: верни один валидный JSON-объект без markdown, без пояснений до или после. Экранируй все обратные слэши в LaTeX (\\\\frac, \\\\sin).`,
            },
            { role: 'user', content: user },
          ]

    let res: Response
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, messages, temperature: (payload.temperature as number) - attempt * 0.05 }),
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
      let errorCode = ''
      try {
        const body = JSON.parse(raw) as {
          message?: string
          detail?: string
          error?: string | { message?: string }
        }
        if (typeof body.error === 'string') errorCode = body.error
        if (typeof body.message === 'string' && body.message.trim()) detail = body.message
        else if (typeof body.error === 'string' && body.error !== 'UPSTREAM_ERROR') detail = body.error
        else if (body.error && typeof body.error === 'object' && body.error.message) {
          detail = body.error.message
        }
      } catch {
        detail = raw.trim()
      }

      if (res.status === 402 || errorCode === 'INSUFFICIENT_CREDITS') {
        throw new AiError(
          detail ||
            'На OpenRouter недостаточно кредитов. Пополните баланс на openrouter.ai и повторите запрос.',
        )
      }

      if (res.status === 401 || res.status === 403 || errorCode === 'AUTH_ERROR') {
        throw new AiError(detail || AUTH_ERROR_USER_MESSAGE)
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

    try {
      return extractJson(content) as T
    } catch (err) {
      lastParseError = err
      if (attempt === 1) break
    }
  }

  if (lastParseError instanceof AiError) throw lastParseError
  throw new AiError('Модель вернула невалидный JSON. Попробуйте сгенерировать ещё раз.')
}

export function isAiUnavailable(err: unknown): boolean {
  return (
    err instanceof AiError &&
    (err.message === 'NO_API_KEY' || err.message === 'NO_API')
  )
}
