/**
 * Прогон plan + worksheet для ZADACHI_PROBY_EXTRACT.md
 * Запуск: node_modules/.bin/vite-node scripts/pipeline-probe.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import type { WorksheetDraft } from '../src/data/worksheet'
import { generatePlanAI, generateWorksheetAI } from '../src/data/ai'
import { extractJson } from '../src/data/aiClient'
import { labelForType } from '../src/data/worksheet'

dotenv.config()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim()
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(
  /\/$/,
  '',
)
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'google/gemini-2.5-flash'

function readExtractText(): string {
  const md = fs.readFileSync(path.join(root, 'docs/ZADACHI_PROBY_EXTRACT.md'), 'utf8')
  const start = md.indexOf('```\n')
  const end = md.lastIndexOf('\n```')
  if (start === -1 || end <= start) throw new Error('Не найден блок contextFileText в ZADACHI_PROBY_EXTRACT.md')
  return md.slice(start + 4, end)
}

async function chatJson<T>(
  system: string,
  user: string,
  options?: { temperature?: number },
): Promise<T> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY не задан')

  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    temperature: options?.temperature ?? 0.5,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (!OPENAI_MODEL.includes('gemini')) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'HTTP-Referer': process.env.APP_URL || 'https://worksheet.onrender.com',
      'X-Title': 'Worksheet Constructor',
    },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  if (!res.ok) throw new Error(`API ${res.status}: ${raw.slice(0, 400)}`)

  const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Пустой ответ модели')

  return extractJson(content) as T
}

// Подмена fetch для aiClient → OpenRouter напрямую
const nativeFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.endsWith('/api/chat') || url === '/api/chat') {
    const payload = JSON.parse(String(init?.body)) as {
      messages: { role: string; content: string }[]
      temperature?: number
    }
    const system = payload.messages.find((m) => m.role === 'system')?.content ?? ''
    const user = payload.messages.find((m) => m.role === 'user')?.content ?? ''
    const result = await chatJson<unknown>(system, user, { temperature: payload.temperature })
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return nativeFetch(input, init)
}) as typeof fetch

function formatPlan(plan: WorksheetDraft['plan']): string {
  return plan
    .map(
      (p, i) =>
        `${i + 1}. ${p.taskType} (${labelForType(p.taskType)}) — ${p.userExpectation || '—'}`,
    )
    .join('\n')
}

function optionLabel(o: { text?: string } | string, i: number): string {
  const text = typeof o === 'string' ? o : o.text ?? ''
  return `${String.fromCharCode(97 + i)}) ${text}`
}

function itemLabel(o: { text?: string } | string): string {
  return typeof o === 'string' ? o : o.text ?? ''
}

function formatWorksheet(draft: WorksheetDraft): string {
  const lines: string[] = []
  if (draft.title) lines.push(`**${draft.title}**`, '')
  if (draft.intro) lines.push(draft.intro, '')

  let n = 0
  for (const b of draft.blocks) {
    if (['page_break', 'text', 'answer_field', 'table'].includes(b.type)) continue
    n += 1
    lines.push(`### Задание ${n} (${labelForType(b.type)})`)
    if (b.question) lines.push(b.question)
    if (b.options?.length) {
      lines.push(b.options.map(optionLabel).join('\n'))
      if (b.correctOptionId) {
        const idx = b.options.findIndex((o) => o.id === b.correctOptionId)
        if (idx >= 0) lines.push(`Верный: ${String.fromCharCode(97 + idx)}`)
      }
    }
    const gaps = b.gapsText || b.gapsSourceText || ''
    if (gaps) lines.push('', gaps)
    if (b.leftItems?.length && b.rightItems?.length) {
      lines.push(
        'Слева: ' + b.leftItems.map(itemLabel).join('; '),
        'Справа: ' + b.rightItems.map(itemLabel).join('; '),
      )
    }
    if (b.groups?.length) {
      for (const g of b.groups) {
        lines.push(`${g.title}: ${g.items.map(itemLabel).join(', ')}`)
      }
    }
    if (b.orderItems?.length) lines.push('Элементы: ' + b.orderItems.map(itemLabel).join(' → '))
    if (b.correctAnswers?.length) {
      lines.push('Ключ: ' + b.correctAnswers.join('; '))
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

async function main() {
  const contextFileText = readExtractText()
  const draft: WorksheetDraft = {
    id: 'probe',
    subject: 'Математика',
    grade: '5',
    taskCount: 5,
    topic: 'решение задач',
    wishes: '',
    title: '',
    intro: '',
    difficulty: 'basic',
    showDifficulty: false,
    showAnswers: false,
    addIntro: true,
    plan: [],
    blocks: [],
    pages: 1,
    print: { answersSeparate: false, copies: 1, orientation: 'portrait' },
    contextFileName: 'Задачи пробы.docx',
    contextFileText,
  }

  console.log('Plan…')
  const t0 = Date.now()
  const plan = await generatePlanAI(draft)
  const planSec = ((Date.now() - t0) / 1000).toFixed(1)

  const withPlan = { ...draft, plan, taskCount: plan.length }
  console.log('Worksheet…')
  const t1 = Date.now()
  const sheet = await generateWorksheetAI(withPlan, 'create')
  const sheetSec = ((Date.now() - t1) / 1000).toFixed(1)

  const appendix = [
    '',
    '---',
    '',
    '## Генерация листа',
    '',
    'Вход: Математика, 5 класс, 5 заданий, тема «решение задач», reference_file = extract выше.',
    '',
    `План (${planSec} с):`,
    '',
    '```',
    formatPlan(plan),
    '```',
    '',
    `Рабочий лист (${sheetSec} с):`,
    '',
    '```',
    formatWorksheet(sheet),
    '```',
    '',
  ].join('\n')

  const mdPath = path.join(root, 'docs/ZADACHI_PROBY_EXTRACT.md')
  const base = fs.readFileSync(mdPath, 'utf8').replace(/\n---\n\n## Генерация листа[\s\S]*$/, '')
  fs.writeFileSync(mdPath, base.trimEnd() + appendix, 'utf8')
  console.log('Updated', mdPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
