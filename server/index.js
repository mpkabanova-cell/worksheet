import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { extractContextFromFile, ContextExtractError, MAX_UPLOAD_BYTES } from './extractContext.js'
import { parseSingleFileUpload, UploadError } from './upload.js'
import { getVisionConfig } from './visionOcr.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

const PORT = Number(process.env.PORT) || 3001
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim()
const OPENAI_BASE_URL = (
  process.env.OPENAI_BASE_URL ||
  'https://openrouter.ai/api/v1'
).replace(/\/$/, '')
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'google/gemini-2.5-flash'
const visionConfig = getVisionConfig()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    hasKey: Boolean(OPENAI_API_KEY),
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

  if (response_format) {
    body.response_format = response_format
  } else if (!OPENAI_MODEL.includes('gemini')) {
    body.response_format = { type: 'json_object' }
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
        if (typeof parsed.message === 'string') message = parsed.message
        else if (typeof parsed.error === 'string') message = parsed.error
        else if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
          message = parsed.error.message
        }
      } catch {
        /* keep raw */
      }
      if (!message.trim()) message = `Upstream HTTP ${upstream.status}`
      console.error('[api/chat] upstream error', upstream.status, message)
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
})
