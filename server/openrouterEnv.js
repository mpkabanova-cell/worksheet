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

export const OPENROUTER_USER_NOT_FOUND_MESSAGE =
  'OpenRouter: «User not found» — ключ не подходит для генерации. Создайте обычный inference API key на openrouter.ai/settings/keys (не provisioning/management). Ключ мог истечь или быть отозван — создайте новый и обновите OPENAI_API_KEY на Render и в .env.'

/**
 * @param {string} upstreamMessage
 * @returns {boolean}
 */
export function isOpenRouterUserNotFoundMessage(upstreamMessage) {
  return /user not found/i.test(String(upstreamMessage || ''))
}

/**
 * @param {string} [upstreamMessage]
 * @returns {string}
 */
export function authErrorMessageForUpstream(upstreamMessage) {
  if (isOpenRouterUserNotFoundMessage(upstreamMessage)) {
    return OPENROUTER_USER_NOT_FOUND_MESSAGE
  }
  return AUTH_ERROR_USER_MESSAGE
}

/**
 * @param {string} apiKey
 * @param {string} [baseUrl]
 * @returns {Promise<{
 *   ok: boolean
 *   status: number
 *   upstreamMessage: string
 *   hint?: string
 *   credits?: {
 *     limitRemaining: number | null
 *     limit: number | null
 *     usageMonthly: number | null
 *     isManagementKey?: boolean
 *     isProvisioningKey?: boolean
 *   }
 * }>}
 */
export async function verifyOpenRouterKey(apiKey, baseUrl = DEFAULT_BASE_URL) {
  if (!apiKey) {
    return { ok: false, status: 0, upstreamMessage: '', hint: 'OPENAI_API_KEY не задан' }
  }

  const root = baseUrl.replace(/\/$/, '')

  try {
    const res = await fetch(`${root}/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const text = await res.text()
    let upstreamMessage = text.slice(0, 500)
    /** @type {Record<string, unknown> | null} */
    let data = null
    try {
      const parsed = JSON.parse(text)
      if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
        upstreamMessage = String(parsed.error.message)
      } else if (typeof parsed.message === 'string') {
        upstreamMessage = parsed.message
      }
      if (parsed.data && typeof parsed.data === 'object') {
        data = parsed.data
      }
    } catch {
      /* keep raw */
    }

    if (res.ok && data) {
      return {
        ok: true,
        status: res.status,
        upstreamMessage: '',
        credits: {
          limitRemaining: typeof data.limit_remaining === 'number' ? data.limit_remaining : null,
          limit: typeof data.limit === 'number' ? data.limit : null,
          usageMonthly: typeof data.usage_monthly === 'number' ? data.usage_monthly : null,
          isManagementKey: Boolean(data.is_management_key),
          isProvisioningKey: Boolean(data.is_provisioning_key),
        },
      }
    }

    if (res.ok) {
      return { ok: true, status: res.status, upstreamMessage: '' }
    }

    return {
      ok: false,
      status: res.status,
      upstreamMessage,
      hint: authErrorMessageForUpstream(upstreamMessage),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, upstreamMessage: msg, hint: `Не удалось связаться с OpenRouter: ${msg}` }
  }
}

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
