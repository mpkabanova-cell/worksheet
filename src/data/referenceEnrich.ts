import { splitContextBlocks, stripIrrelevantSections } from './contextFilter'
import { looksLikeAuthorPlanDescription, stripMetaTaskDescription } from './taskContent'
import type { TaskType, WorksheetBlock } from './worksheet'

export const QUESTION_MAX_LEN = 1500
export const MATCHING_QUESTION_MAX_LEN = 400

const GRADE_HEADING_RE = /^\d+\s*[-–—]\s*\d+\s*класс/i
const TASK_NUMBER_RE = /^\d+\.\s+[A-ZА-ЯЁ]/
const MULTI_GRADE_RE = /\d+\s*[-–—]\s*\d+\s*класс/gi

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

export function looksLikeReferenceDump(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.length > QUESTION_MAX_LEN) return true
  return (t.match(MULTI_GRADE_RE) ?? []).length >= 2
}

function sliceUntilNextGradeHeading(content: string, startPattern: RegExp): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i])) {
      start = i
      break
    }
  }
  if (start < 0) return ''

  const chunk: string[] = []
  for (let i = start; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (chunk.length > 2 && GRADE_HEADING_RE.test(trimmed) && i > start) break
    if (chunk.length > 2 && TASK_NUMBER_RE.test(trimmed)) break
    chunk.push(lines[i])
  }
  return chunk.join('\n')
}

function trimChunkToSingleTask(chunk: string): string {
  const lines = chunk.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (kept.length > 3 && GRADE_HEADING_RE.test(trimmed)) break
    if (kept.length > 3 && TASK_NUMBER_RE.test(trimmed)) break
    kept.push(line)
  }
  return kept.join('\n').trim()
}

/** Извлекает только условие задачи про пещеру (блок 5–6 классы), без следующих разделов. */
export function extractCaveConditionFromReference(content: string): string {
  const withoutBrackets = content.replace(/\[[^\]]+\]/g, ' ').replace(/\r\n/g, '\n')
  const blocks = splitContextBlocks(withoutBrackets)
  const caveBlock = blocks.find((b) => /пещер/i.test(b.body) || /пещер/i.test(b.title))

  let raw = ''
  if (caveBlock) {
    raw = caveBlock.title ? `${caveBlock.title}\n${caveBlock.body}` : caveBlock.body
  } else {
    raw = sliceUntilNextGradeHeading(withoutBrackets, /пещер/i)
  }
  if (!raw.trim()) return ''

  let chunk = stripIrrelevantSections(raw)
  chunk = trimChunkToSingleTask(chunk)
  chunk = chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+\s*минут\s*=/.test(line))
    .join('\n')
    .trim()

  if (countTimeMentions(chunk) < 2) return ''
  return chunk
}

/** Только повествование задачи про пещеру — без строк с минутами. */
export function extractCaveNarrativeFromReference(content: string): string {
  const condition = extractCaveConditionFromReference(content)
  if (!condition) return ''

  const narrativeLines: string[] = []
  for (const line of condition.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^\d+\s*[-–—]\s*\d+\s*класс/i.test(trimmed)) continue
    if (/\d+\s*минут/.test(trimmed) || /минуту/.test(trimmed)) continue
    narrativeLines.push(trimmed)
  }
  return narrativeLines.join('\n').trim()
}

export function extractMatchingInstruction(question: string): string {
  const lines = question
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const explicit = lines.find((line) => /^сопостав/i.test(line) && line.length <= MATCHING_QUESTION_MAX_LEN)
  if (explicit) return explicit

  return (
    lines.find(
      (line) =>
        line.length >= 20 &&
        line.length <= MATCHING_QUESTION_MAX_LEN &&
        !GRADE_HEADING_RE.test(line) &&
        !TASK_NUMBER_RE.test(line) &&
        !/^\d+\s*минут/i.test(line) &&
        !/^(def |import |if b==)/.test(line),
    ) ?? ''
  )
}

export function trimReferenceDumpFromQuestion(question: string, type?: TaskType): string {
  let q = question.trim()
  if (!q) return q

  if (looksLikeReferenceDump(q)) {
    const instruction = extractMatchingInstruction(q)
    q = instruction || q.slice(0, type === 'matching' ? MATCHING_QUESTION_MAX_LEN : QUESTION_MAX_LEN).trim()
  }

  if (type === 'matching' && q.length > MATCHING_QUESTION_MAX_LEN) {
    q = extractMatchingInstruction(q) || q.slice(0, MATCHING_QUESTION_MAX_LEN).trim()
  } else if (q.length > QUESTION_MAX_LEN) {
    q = q.slice(0, QUESTION_MAX_LEN).trim()
  }

  return q
}

function cleanStudentQuestion(question: string, type?: TaskType): string {
  return trimReferenceDumpFromQuestion(stripMetaTaskDescription(question), type)
}

export function enrichCaveQuestion(question: string, referenceContent: string): string {
  const q = question.trim()
  if (hasCaveData(q)) return trimReferenceDumpFromQuestion(q)

  const context = extractCaveConditionFromReference(referenceContent)
  if (!context) return q
  if (!q) return context
  if (context.includes(q)) return context

  const merged = `${context}\n\n${q}`
  return trimReferenceDumpFromQuestion(merged)
}

function matchingHasColumnData(block: WorksheetBlock): boolean {
  const left = block.leftItems?.map((i) => i.text ?? '').join('\n') ?? ''
  const right = block.rightItems?.map((i) => i.text ?? '').join('\n') ?? ''
  return Boolean(left.trim() && right.trim() && (hasCaveData(`${left}\n${right}`) || /\d+\s*минут/i.test(`${left}\n${right}`)))
}

export function trimReferenceDumpFromBlock(block: WorksheetBlock): WorksheetBlock {
  const question = block.question?.trim()
  if (!question) return block
  const trimmed = cleanStudentQuestion(question, block.type)
  if (trimmed === question) return block
  return { ...block, question: trimmed }
}

export function enrichBlockFromReference(
  block: WorksheetBlock,
  referenceContent: string,
  planExpectation?: string,
): WorksheetBlock {
  if (!referenceContent.trim()) return block

  if (block.type === 'matching') {
    if (matchingHasColumnData(block)) {
      const instruction =
        extractMatchingInstruction(block.question || '') ||
        'Сопоставьте элементы из левого столбца с элементами правого.'
      return trimReferenceDumpFromBlock({ ...block, question: instruction })
    }
    return trimReferenceDumpFromBlock(block)
  }

  if (block.type === 'fill_gaps') {
    const aboutCave =
      /пещер/i.test(block.question || '') || /пещер/i.test(planExpectation || '')
    if (aboutCave) {
      const condition = extractCaveConditionFromReference(referenceContent)
      const instruction = 'Заполните пропуски в данных ниже.'
      if (condition) {
        const question = condition.includes(instruction)
          ? condition
          : `${condition}\n\n${instruction}`
        return trimReferenceDumpFromBlock({ ...block, question })
      }
      return trimReferenceDumpFromBlock({
        ...block,
        question: enrichCaveQuestion(block.question || '', referenceContent),
      })
    }
    return trimReferenceDumpFromBlock(block)
  }

  if (block.type === 'extended_answer' || block.type === 'short_answer') {
    const needsEnrich =
      looksLikeAuthorPlanDescription(block.question || '') ||
      planExpectsStoryContext(planExpectation) ||
      questionNeedsCaveContext(block.question || '')
    if (needsEnrich) {
      const enriched = enrichCaveQuestion(block.question || '', referenceContent)
      if (enriched.trim()) {
        return trimReferenceDumpFromBlock({ ...block, question: enriched })
      }
    }
    return trimReferenceDumpFromBlock(block)
  }

  if (!planExpectsStoryContext(planExpectation) && !questionNeedsCaveContext(block.question || '')) {
    return trimReferenceDumpFromBlock(block)
  }

  const enrichedQuestion = enrichCaveQuestion(block.question || '', referenceContent)
  if (enrichedQuestion === block.question) return trimReferenceDumpFromBlock(block)
  return trimReferenceDumpFromBlock({ ...block, question: enrichedQuestion })
}
