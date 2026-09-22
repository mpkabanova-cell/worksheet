import { stripSolutionTail } from './contextFilter'
import type { WorksheetBlock } from './worksheet'

function countTimeMentions(text: string): number {
  return text.match(/\d+\s*минут/g)?.length ?? 0
}

function hasCaveData(text: string): boolean {
  return countTimeMentions(text) >= 3
}

export function planExpectsStoryContext(expectation?: string): boolean {
  const e = expectation?.trim() || ''
  if (!e) return false
  return /пещер|персонаж|бараш|лосяш|совун/i.test(e)
}

export function questionNeedsCaveContext(question: string): boolean {
  return /пещер|персонаж/i.test(question) && /время|минут|быстр|медлен|дольше|меньше|наибольш|наименьш/i.test(question)
}

/** Извлекает условие про пещеру из reference_file (без решений). */
export function extractCaveConditionFromReference(content: string): string {
  const cleaned = stripSolutionTail(content.replace(/\[[^\]]+\]/g, ' '))
  const caveIdx = cleaned.search(/пещер/i)
  if (caveIdx < 0) return ''

  const leadIdx = cleaned.search(/Бараш|Крош|Совун/i)
  const start = leadIdx >= 0 && leadIdx < caveIdx + 400 ? leadIdx : Math.max(0, caveIdx - 120)
  let chunk = cleaned.slice(start)

  const solutionIdx = chunk.search(/\n\s*Решение\s*:/i)
  if (solutionIdx >= 0) chunk = chunk.slice(0, solutionIdx)

  chunk = chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+\s*минут\s*=/.test(line))
    .join('\n')
    .trim()

  if (countTimeMentions(chunk) < 2) return ''
  return chunk
}

export function enrichCaveQuestion(question: string, referenceContent: string): string {
  const q = question.trim()
  if (hasCaveData(q)) return q

  const context = extractCaveConditionFromReference(referenceContent)
  if (!context) return q
  if (!q) return context
  if (context.includes(q)) return context
  return `${context}\n\n${q}`
}

export function enrichBlockFromReference(
  block: WorksheetBlock,
  referenceContent: string,
  planExpectation?: string,
): WorksheetBlock {
  if (!referenceContent.trim()) return block
  if (!planExpectsStoryContext(planExpectation) && !questionNeedsCaveContext(block.question || '')) {
    return block
  }

  const enrichedQuestion = enrichCaveQuestion(block.question || '', referenceContent)
  if (enrichedQuestion === block.question) return block
  return { ...block, question: enrichedQuestion }
}
