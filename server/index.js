import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { convertDocxToPdf, isPdfConverterAvailable } from './docxToPdf.js'
import { extractContextFromFile, ContextExtractError, MAX_UPLOAD_BYTES } from './extractContext.js'
import { parseSingleFileUpload, UploadError } from './upload.js'
import { getVisionConfig } from './visionOcr.js'
import {
  authHintForKey,
  authErrorMessageForUpstream,
  DEFAULT_CHAT_MODEL,
  isLikelyOpenRouterKey,
  isUpstreamAuthFailure,
  resolveApiKey,
  resolveBaseUrl,
  resolveChatResponseFormat,
  verifyOpenRouterKey,
} from './openrouterEnv.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

const PORT = Number(process.env.PORT) || 3001
const OPENAI_API_KEY = resolveApiKey()
const OPENAI_BASE_URL = resolveBaseUrl()
const OPENAI_MODEL = process.env.OPENAI_MODEL || DEFAULT_CHAT_MODEL
const visionConfig = getVisionConfig()

/** @type {{ ok: boolean | null, hint?: string, checkedAt?: string, credits?: Record<string, unknown> }} */
let openRouterAuthState = { ok: null }

async function refreshOpenRouterAuthState() {
  if (!OPENAI_API_KEY) {
    openRouterAuthState = { ok: false, hint: 'OPENAI_API_KEY не задан', checkedAt: new Date().toISOString() }
    return
  }
  const result = await verifyOpenRouterKey(OPENAI_API_KEY, OPENAI_BASE_URL)
  openRouterAuthState = {
    ok: result.ok,
    ...(result.hint ? { hint: result.hint } : {}),
    ...(result.credits ? { credits: result.credits } : {}),
    checkedAt: new Date().toISOString(),
  }
  if (result.ok) {
    const c = result.credits
    const bal =
      c && c.limitRemaining != null
        ? `limit_remaining=$${c.limitRemaining}`
        : 'key ok'
    console.log('[startup] OpenRouter key: verified', bal)
  } else {
    console.error('[startup] OpenRouter key check failed', result.status, result.upstreamMessage)
  }
}

const MAX_EXPORT_DOCX_BYTES = 20 * 1024 * 1024

/** @type {boolean | null} */
let pdfConverterAvailable = null

async function refreshPdfConverterState() {
  pdfConverterAvailable = await isPdfConverterAvailable()
  if (pdfConverterAvailable) {
    console.log('[startup] PDF export: LibreOffice converter ready')
  } else {
    console.warn(
      '[startup] PDF export: LibreOffice (soffice) not found — POST /api/export/pdf will return 503',
    )
  }
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  const hasKey = Boolean(OPENAI_API_KEY)
  const keyPrefixOk = isLikelyOpenRouterKey(OPENAI_API_KEY)
  const authHint = authHintForKey(OPENAI_API_KEY)
  res.status(200).json({
    ok: true,
    hasKey,
    keyPrefixOk: hasKey && keyPrefixOk,
    ...(authHint ? { authHint } : {}),
    openRouterAuthOk: openRouterAuthState.ok,
    ...(openRouterAuthState.hint ? { openRouterAuthHint: openRouterAuthState.hint } : {}),
    ...(openRouterAuthState.checkedAt ? { openRouterAuthCheckedAt: openRouterAuthState.checkedAt } : {}),
    ...(openRouterAuthState.credits ? { openRouterCredits: openRouterAuthState.credits } : {}),
    pdfExportAvailable: pdfConverterAvailable,
    model: OPENAI_MODEL,
    ocrModel: visionConfig.model,
  })
})

app.post('/api/extract-context', async (req, res) => {
  try {
    const { buffer, filename, mimeType } = await parseSingleFileUpload(req, MAX_UPLOAD_BYTES)
    const result = await extractContextFromFile(buffer, filename, mimeType)
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof UploadError || err instanceof ContextExtractError) {
      res.status(err.status).json({ error: err.code, message: err.message })
      return
    }
    const message = err instanceof Error ? err.message : 'Ошибка извлечения контекста'
    console.error('[api/extract-context]', message)
    res.status(502).json({ error: 'EXTRACT_ERROR', message })
  }
})

app.post('/api/export/pdf', async (req, res) => {
  try {
    const { buffer, filename } = await parseSingleFileUpload(req, MAX_EXPORT_DOCX_BYTES)
    const lower = filename.toLowerCase()
    if (!lower.endsWith('.docx') && buffer.length >= 2 && buffer[0] !== 0x50 && buffer[1] !== 0x4b) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Нужен файл Word (.docx), собранный экспортом листа',
      })
      return
    }

    const pdf = await convertDocxToPdf(buffer)
    if (!pdf) {
      res.status(503).json({
        error: 'PDF_CONVERTER_UNAVAILABLE',
        message:
          'На сервере нет LibreOffice для конвертации. Установите LibreOffice или скачайте DOCX.',
      })
      return
    }

    const baseName = filename.replace(/\.docx$/i, '') || 'worksheet'
    const outName = `${baseName}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(outName)}`)
    res.send(pdf)
  } catch (err) {
    if (err instanceof UploadError) {
      res.status(err.status).json({ error: err.code, message: err.message })
      return
    }
    const message = err instanceof Error ? err.message : 'Ошибка конвертации PDF'
    console.error('[api/export/pdf]', message)
    res.status(502).json({ error: 'PDF_EXPORT_ERROR', message })
  }
})

app.post('/api/chat', async (req, res) => {
  if (!OPENAI_API_KEY) {
    res.status(503).json({ error: 'NO_API_KEY', message: 'OPENAI_API_KEY не задан на сервере' })
    return
  }

  const { messages, temperature, response_format } = req.body ?? {}
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Нужен messages[]' })
    return
  }

  const body = {
    model: OPENAI_MODEL,
    temperature: typeof temperature === 'number' ? temperature : 0.5,
    messages,
  }

  const responseFormat = resolveChatResponseFormat(OPENAI_MODEL, response_format)
  if (responseFormat) {
    body.response_format = responseFormat
  }

  try {
    const upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'https://worksheet.onrender.com',
        'X-Title': 'Worksheet Constructor',
      },
      body: JSON.stringify(body),
    })

    const text = await upstream.text()
    if (!upstream.ok) {
      let message = text.slice(0, 500)
      try {
        const parsed = JSON.parse(text)
        if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
          message = parsed.error.message
        } else if (typeof parsed.message === 'string') message = parsed.message
        else if (typeof parsed.error === 'string') message = parsed.error
      } catch {
        /* keep raw */
      }
      if (!message.trim()) message = `Upstream HTTP ${upstream.status}`
      console.error('[api/chat] upstream error', upstream.status, message)
      if (upstream.status === 402) {
        res.status(402).json({
          error: 'INSUFFICIENT_CREDITS',
          message:
            'На OpenRouter недостаточно кредитов. Пополните баланс на openrouter.ai и повторите запрос.',
          detail: message.slice(0, 500),
        })
        return
      }
      if (isUpstreamAuthFailure(upstream.status)) {
        const userMessage = authErrorMessageForUpstream(message)
        res.status(upstream.status).json({
          error: 'AUTH_ERROR',
          message: userMessage,
          detail: message.slice(0, 500),
        })
        return
      }
      res.status(upstream.status).json({
        error: 'UPSTREAM_ERROR',
        message,
      })
      return
    }

    res.type('json').send(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка прокси'
    res.status(502).json({ error: 'PROXY_ERROR', message })
  }
})

if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    }),
  )
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    if (req.path.startsWith('/assets/')) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(dist, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text')
      .send('API ok. Соберите фронт: npm run build (папка dist отсутствует).')
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Worksheet server on http://0.0.0.0:${PORT}`)
  console.log(`Chat model: ${OPENAI_MODEL}; OCR model: ${visionConfig.model}; key: ${OPENAI_API_KEY ? 'set' : 'MISSING'}`)
  refreshOpenRouterAuthState().catch((err) => {
    console.warn('[startup] OpenRouter auth refresh failed', err instanceof Error ? err.message : err)
  })
  refreshPdfConverterState().catch((err) => {
    console.warn('[startup] PDF converter check failed', err instanceof Error ? err.message : err)
  })
})

import('pdf-parse/worker')
  .then(() => import('pdf-parse'))
  .then(() => {
    console.log('PDF extract: pdf-parse ready')
  })
  .catch((err) => {
    console.warn(
      '[startup] pdf-parse недоступен — загрузка PDF не будет работать. Выполните npm install.',
      err instanceof Error ? err.message : err,
    )
  })
