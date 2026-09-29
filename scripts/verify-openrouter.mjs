#!/usr/bin/env node
/**
 * Проверка OPENAI_API_KEY против OpenRouter (без вывода секрета).
 * Usage: node scripts/verify-openrouter.mjs
 */

import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CHAT_MODEL,
  resolveApiKey,
  resolveBaseUrl,
  verifyOpenRouterKey,
} from '../server/openrouterEnv.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env') })

const apiKey = resolveApiKey()
const baseUrl = resolveBaseUrl()
const model = process.env.OPENAI_MODEL || DEFAULT_CHAT_MODEL

async function main() {
  if (!apiKey) {
    console.error('FAIL: OPENAI_API_KEY (или OPENROUTER_API_KEY) не задан в .env / окружении')
    process.exit(1)
  }

  console.log('Checking OpenRouter GET /key …')
  const auth = await verifyOpenRouterKey(apiKey, baseUrl)
  if (!auth.ok) {
    console.error(`FAIL: auth/key HTTP ${auth.status || 'network'}`)
    if (auth.upstreamMessage) console.error(`Upstream: ${auth.upstreamMessage}`)
    if (auth.hint) console.error(auth.hint)
    process.exit(1)
  }
  console.log('OK: GET /key')
  if (auth.credits) {
    const c = auth.credits
    console.log(
      `Credits (USD): limit_remaining=${c.limitRemaining ?? 'n/a'} limit=${c.limit ?? 'unlimited'} usage_monthly=${c.usageMonthly ?? 'n/a'}`,
    )
    if (c.isManagementKey || c.isProvisioningKey) {
      console.error('WARN: ключ management/provisioning — для генерации нужен inference key')
      process.exit(1)
    }
  }

  console.log(`Checking chat/completions (model=${model}) …`)
  const referer = (process.env.APP_URL || 'https://worksheet-rphn.onrender.com').trim()
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'Worksheet Constructor',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      max_tokens: 8,
      temperature: 0,
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    let msg = text.slice(0, 400)
    try {
      const parsed = JSON.parse(text)
      if (parsed.error?.message) msg = parsed.error.message
    } catch {
      /* keep */
    }
    console.error(`FAIL: chat/completions HTTP ${res.status}`)
    console.error(`Upstream: ${msg}`)
    process.exit(1)
  }

  console.log('OK: chat/completions')
  process.exit(0)
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
