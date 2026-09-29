/**
 * Единое чтение ключа и base URL OpenRouter (OPENAI_* + alias OPENROUTER_API_KEY).
 */

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

/** Модель генерации plan/worksheet по умолчанию (OpenRouter slug). */
export const DEFAULT_CHAT_MODEL = 'google/gemini-2.0-flash-001'

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim()
  }
  return value
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveApiKey(env = process.env) {
  const raw = (env.OPENAI_API_KEY || env.OPENROUTER_API_KEY || '').trim()
  if (!raw) return ''
  return stripWrappingQuotes(raw)
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveBaseUrl(env = process.env) {
  const raw = (env.OPENAI_BASE_URL || env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).trim()
  return raw.replace(/\/$/, '') || DEFAULT_BASE_URL
}

/**
 * @param {string} apiKey
 * @returns {boolean}
 */
export function isLikelyOpenRouterKey(apiKey) {
  if (!apiKey) return false
  return apiKey.startsWith('sk-or') || apiKey.startsWith('sk-')
}

/**
 * @param {string} apiKey
 * @returns {string | undefined}
 */
export function authHintForKey(apiKey) {
  if (!apiKey) return undefined
  if (isLikelyOpenRouterKey(apiKey)) return undefined
  return 'Ключ задан, но формат не похож на OpenRouter (ожидается sk-or-... или sk-...).'
}

export const AUTH_ERROR_USER_MESSAGE =
  'OpenRouter отклонил ключ API. Обновите OPENAI_API_KEY (или OPENROUTER_API_KEY) в Render → Environment или в локальном .env — нужен актуальный ключ sk-or-... с openrouter.ai/keys.'

/**
 * @param {number} status
 * @returns {boolean}
 */
export function isUpstreamAuthFailure(status) {
  return status === 401 || status === 403
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function messageLooksLikeAuthFailure(message) {
  return /\bHTTP\s+401\b/i.test(message) || /\bHTTP\s+403\b/i.test(message)
}

/**
 * Gemini на OpenRouter часто без response_format; JSON добираем промптом + extractJson.
 * @param {string} model
 */
export function chatModelPrefersPromptJson(model) {
  return String(model || '').toLowerCase().includes('gemini')
}

/**
 * @param {string} model
 * @param {unknown} [clientResponseFormat]
 * @returns {Record<string, unknown> | undefined}
 */
export function resolveChatResponseFormat(model, clientResponseFormat) {
  if (chatModelPrefersPromptJson(model)) return undefined
  if (clientResponseFormat) return clientResponseFormat
  return { type: 'json_object' }
}
