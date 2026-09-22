/**
 * Порт openrouter_client.py из ocr_to_doc_project-main — vision OCR для изображений.
 */

import { stripMarkdownImages } from './markdownClean.js'

export const DEFAULT_CONTEXT_OCR_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct'

export const USER_PROMPT_VISION = `Распознай текст на изображении максимально точно.
Верни только результат без комментариев.
Сохрани структуру документа (абзацы, списки, таблицы).
Используй Markdown.
Все формулы запиши в LaTeX ($...$ и $$...$$). Если в формулах встречаются незнакомые операторы (например, arctg, пиши их в формулах через \\operatorname{})

Картинки, фото, схемы, диаграммы, графики, карты, таблицы-изображения и любые нетекстовые фрагменты
не воспроизводи как изображения: для каждого дай описание в квадратных скобках.
Для графиков и диаграмм в [скобках] укажи оси, подписи, ключевые точки и значения, если они читаемы.
Для схем и блок-схем опиши связи и элементы кратко, но содержательно.
Не пропускай иллюстрации — каждая должна получить [описание].
Например: [график функции y=x^2, ось OX, OY, вершина в (0,0)], [блок-схема алгоритма с ветвлением].
Не используй синтаксис Markdown-картинок (![...](...)) и не вставляй ссылки на файлы или URL.
Не используй маркеры вида [РИС:1] и подобные — только обычные квадратные скобки с описанием.

Никаких пояснений до или после результата, только распознанный текст и описания в скобках.`

function imageToDataUrl(mime, raw) {
  const b64 = Buffer.from(raw).toString('base64')
  return `data:${mime};base64,${b64}`
}

function extractMessageText(message) {
  const raw = message?.content
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) {
    return raw
      .map((block) => {
        if (typeof block === 'string') return block
        if (block && typeof block === 'object' && 'text' in block) return String(block.text)
        return ''
      })
      .join('')
      .trim()
  }
  return String(raw).trim()
}

function openrouterErrorMessage(statusCode, body) {
  try {
    const data = JSON.parse(body)
    const err = data.error
    if (err && typeof err === 'object') {
      const msg = err.message || err.metadata || String(err)
      const code = err.code
      if (code != null) return `HTTP ${statusCode} [${code}]: ${msg}`
      return `HTTP ${statusCode}: ${msg}`
    }
    if (typeof err === 'string') return `HTTP ${statusCode}: ${err}`
  } catch {
    /* keep raw */
  }
  return `HTTP ${statusCode}: ${body.slice(0, 1500)}`
}

export function getVisionConfig(env = process.env) {
  const apiKey = (env.OPENAI_API_KEY || '').trim()
  const baseUrl = (env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  const model = (env.CONTEXT_OCR_MODEL || '').trim() || DEFAULT_CONTEXT_OCR_MODEL
  const timeoutMs = Number(env.CONTEXT_EXTRACT_TIMEOUT_MS) || 300_000
  const referer = (env.APP_URL || 'https://worksheet.onrender.com').trim()
  return { apiKey, baseUrl, model, timeoutMs, referer }
}

/**
 * @param {Buffer|Uint8Array} imageBytes
 * @param {string} mime
 * @param {ReturnType<typeof getVisionConfig>} [config]
 */
export async function callVisionOcr(imageBytes, mime, config = getVisionConfig()) {
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const payload = {
      model: config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT_VISION },
            {
              type: 'image_url',
              image_url: { url: imageToDataUrl(mime, imageBytes) },
            },
          ],
        },
      ],
      temperature: 0.1,
    }

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.referer,
        'X-Title': 'Worksheet Constructor',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const textBody = await res.text()
    if (!res.ok) {
      throw new Error(openrouterErrorMessage(res.status, textBody))
    }

    let data
    try {
      data = JSON.parse(textBody)
    } catch (e) {
      throw new Error(`OpenRouter: не JSON в ответе: ${textBody.slice(0, 800)}`)
    }

    const choices = data.choices
    if (!choices?.length) {
      throw new Error(`Неожиданный ответ OpenRouter: ${JSON.stringify(data).slice(0, 500)}`)
    }

    const msg = choices[0].message
    const out = extractMessageText(msg)
    if (!out) {
      const fr = choices[0].finish_reason
      throw new Error(`Пустой ответ модели (finish_reason=${fr})`)
    }

    return stripMarkdownImages(out)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Превышено время ожидания распознавания')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function guessImageMime(filename, contentType) {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct === 'image/jpg') return 'image/jpeg'
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(ct)) return ct
  const name = (filename || '').toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}
