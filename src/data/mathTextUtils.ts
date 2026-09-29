/**
 * JSON.parse turns `\f`, `\t`, `\b`, `\n`, `\r` inside LaTeX into control chars.
 * Example: "$\frac{3}{7}$" becomes form-feed + "rac{3}{7}" and KaTeX fails.
 */
export function repairJsonLatexEscapes(text: string): string {
  return text
    .replace(/\u000Crac/g, '\\frac')
    .replace(/\u000Corall/g, '\\forall')
    .replace(/\u0009ext/g, '\\text')
    .replace(/\u0009imes/g, '\\times')
    .replace(/\u0009heta/g, '\\theta')
    .replace(/\u0009an\b/g, '\\tan')
    .replace(/\u0009o\b/g, '\\to')
    .replace(/\u0009g\b/g, '\\tg')
    .replace(/\u0008eta/g, '\\beta')
    .replace(/\u0008ar\b/g, '\\bar')
    .replace(/\u0008inom/g, '\\binom')
    .replace(/\u0008ig/g, '\\big')
    .replace(/\u000Aeq/g, '\\neq')
    .replace(/\u000Ab/g, '\\nabla')
    .replace(/\u000Au\b/g, '\\nu')
    .replace(/\u000Aot\b/g, '\\not')
    .replace(/\u000Dight/g, '\\right')
    .replace(/\u000Dho/g, '\\rho')
    .replace(/\u000Dquad/g, '\\quad')
}

/** LaTeX suffixes that collide with JSON escapes (\f, \t, \b, \n, \r). */
const LATEX_AFTER_JSON_ESCAPE: Record<string, string[]> = {
  f: ['rac', 'orall'],
  t: ['ext', 'imes', 'heta', 'an', 'o', 'g'],
  b: ['eta', 'ar', 'inom', 'ig'],
  n: ['eq', 'u', 'abla', 'ot'],
  r: ['ight', 'ho', 'quad'],
}

function isEscapedQuote(text: string, quoteIndex: number): boolean {
  let backslashes = 0
  for (let i = quoteIndex - 1; i >= 0 && text[i] === '\\'; i -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

/**
 * Fixes LaTeX backslashes inside JSON string literals before JSON.parse.
 * Handles invalid escapes (\sin, \sqrt) and JSON-valid ones that corrupt LaTeX (\frac, \tg).
 */
export function sanitizeAiJsonText(raw: string): string {
  let result = ''
  let inString = false
  let i = 0

  while (i < raw.length) {
    const ch = raw[i]

    if (!inString) {
      result += ch
      if (ch === '"') inString = true
      i += 1
      continue
    }

    if (ch === '"' && !isEscapedQuote(raw, i)) {
      inString = false
      result += ch
      i += 1
      continue
    }

    if (ch === '\\') {
      const next = raw[i + 1]
      if (!next) {
        result += '\\\\'
        i += 1
        continue
      }

      if (next === 'u') {
        const slice = raw.slice(i, i + 6)
        if (/^\\u[0-9a-fA-F]{4}$/.test(slice)) {
          result += slice
          i += 6
          continue
        }
      }

      if ('"\\/bfnrt'.includes(next)) {
        const suffix = raw.slice(i + 2)
        const latexCandidates = LATEX_AFTER_JSON_ESCAPE[next]
        if (latexCandidates?.some((prefix) => suffix.startsWith(prefix))) {
          result += '\\\\' + next
          i += 2
          continue
        }
        result += ch + next
        i += 2
        continue
      }

      result += '\\\\' + next
      i += 2
      continue
    }

    result += ch
    i += 1
  }

  return result
}

/** Российская запись в LaTeX: десятичная запятая, tg/ctg вместо tan/cot. */
export function normalizeRussianMathTex(tex: string): string {
  let result = tex
    .replace(/\\arctan\b/g, '\\arctg')
    .replace(/\\arcctg\b/g, '\\arcctg')
    .replace(/\\tan\b/g, '\\tg')
    .replace(/\\cot\b/g, '\\ctg')

  let prev = ''
  while (prev !== result) {
    prev = result
    result = result.replace(/(\d)\.(\d)/g, '$1,$2')
  }

  return result
}

function normalizeMathComparison(value: string): string {
  return value.replace(/\s+/g, '').replace(/[−–—]/g, '-').toLowerCase()
}

/** Plain math immediately followed by an equivalent $...$ span — keep only the formula. */
export function stripDuplicatePlainMath(input: string): string {
  const match = input.match(/^([\s\S]*?)(\$[^$\n]+?\$)\s*$/)
  if (!match) return input

  const [, plain, wrapped] = match
  const trimmedPlain = plain.trim()
  if (!trimmedPlain || !looksLikeMathPlainText(trimmedPlain)) return input

  const latex = wrapped.slice(1, -1)
  if (normalizeMathComparison(trimmedPlain) === normalizeMathComparison(latex)) {
    return wrapped
  }

  return input
}

const CELLS_CHARS_PER_ROW = 48
const FRACTION_TEX_RE = /\\(?:d|t|c)?frac\b/

/** Whether answer text contains a fraction that needs two cell rows. */
export function needsDoubleCellHeight(source: string): boolean {
  if (!source.trim()) return false
  return FRACTION_TEX_RE.test(source)
}

/** Use display-style fractions in the cells grid for readable numerator/denominator. */
export function texForCellsLayout(tex: string): string {
  return tex.replace(/\\frac\b/g, '\\dfrac')
}

/** Grid row count for a cells answer (1 row per plain line, 2 per line with fractions). */
export function cellsRowsNeededForText(text: string): number {
  if (!text.trim()) return 0
  return text.split(/\n/).reduce((sum, paragraph) => {
    const horizontalLines = Math.max(1, Math.ceil(paragraph.length / CELLS_CHARS_PER_ROW))
    const rowHeight = needsDoubleCellHeight(paragraph) ? 2 : 1
    return sum + horizontalLines * rowHeight
  }, 0)
}

/** Подготовка текста перед MathText / KaTeX. */
export function preprocessMathText(input: string): string {
  if (!input) return ''

  let text = stripDuplicatePlainMath(repairJsonLatexEscapes(input))
  text = text.replace(/\\div\b/g, ':')

  return expandMathSegments(splitMathSegments(text))
    .map((segment) => {
      if (segment.kind === 'math') {
        return segment.display ? `$$${segment.value}$$` : `$${segment.value}$`
      }
      return segment.value
    })
    .join('')
}

function normalizeTex(tex: string): string {
  return normalizeRussianMathTex(
    repairJsonLatexEscapes(tex)
      .replace(/\\div\b/g, ':')
      // Gap placeholders must never appear inside formulas.
      .replace(/\\text\{_+\}/g, '')
      .replace(/_{3,}/g, ''),
  )
}

export type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }

/** Разбивает строку на plain-текст и math-сегменты. */
export function splitMathSegments(input: string): MathSegment[] {
  if (!input) return []

  const segments: MathSegment[] = []
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      segments.push({ kind: 'text', value: input.slice(last, match.index) })
    }
    const display = match[1] != null
    segments.push({
      kind: 'math',
      value: (display ? match[1] : match[2] ?? '').trim(),
      display,
    })
    last = match.index + match[0].length
  }

  if (last < input.length) {
    segments.push({ kind: 'text', value: input.slice(last) })
  }

  return segments
}

const INLINE_MATH_CHAR = /[\dA-Za-z^_{}\\+\-−–—·:(),= ]/

function isMathGlueText(value: string): boolean {
  return value.length > 0 && /^[\s+\-−–—·:(),]+$/.test(value)
}

function normalizeMathGlueText(value: string): string {
  return value.replace(/[−–—]/g, '-').replace(/\u00a0/g, ' ')
}

function looksLikeInlineMathRun(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^[\d\s.)]+$/.test(trimmed)) return false
  return /[\^_\\]|[\d.]+[a-zA-Z]|[a-zA-Z]\s*[\^_{(]|\\frac|\\sqrt|\\cdot/.test(trimmed)
}

function findInlineMathStart(text: string, from: number): number | null {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '\\') return i
    if (ch === '(' && /[\dA-Za-z\\(]/.test(text[i + 1] ?? '')) return i
    if (/\d/.test(ch) && /[a-zA-Z(\\]/.test(text[i + 1] ?? '')) return i
    if (/[a-zA-Z]/.test(ch)) {
      const tail = text.slice(i, i + 24)
      if (/^[_^\\({]/.test(tail.slice(1)) || /\^|_|\\/.test(tail)) return i
    }
  }
  return null
}

function findInlineMathEnd(text: string, start: number): number {
  let i = start
  while (i < text.length) {
    const ch = text[i]
    if (ch === '.' && /\d/.test(text[i - 1] ?? '')) {
      if (i + 1 >= text.length || /[\s,.;:!?)}\]]/.test(text[i + 1] ?? '')) {
        break
      }
    }
    if (!INLINE_MATH_CHAR.test(ch)) break
    i += 1
  }
  while (i > start && /\s/.test(text[i - 1] ?? '')) i -= 1
  return i
}

function splitInlineMathFromPlainText(text: string): MathSegment[] {
  if (!text) return []

  const segments: MathSegment[] = []
  let index = 0

  while (index < text.length) {
    const start = findInlineMathStart(text, index)
    if (start == null) {
      segments.push({ kind: 'text', value: text.slice(index) })
      break
    }
    if (start > index) {
      segments.push({ kind: 'text', value: text.slice(index, start) })
    }
    const end = findInlineMathEnd(text, start)
    const raw = text.slice(start, end).trim()
    if (raw && looksLikeInlineMathRun(raw)) {
      segments.push({ kind: 'math', value: normalizeTex(raw), display: false })
    } else {
      segments.push({ kind: 'text', value: text.slice(start, end) })
    }
    index = end
  }

  return segments
}

/** Merge `$a$ + $b$`-style fragments and extract inline math from plain text. */
export function mergeAdjacentMathSegments(segments: MathSegment[]): MathSegment[] {
  const result: MathSegment[] = []
  let index = 0

  while (index < segments.length) {
    const segment = segments[index]
    if (segment.kind !== 'math') {
      result.push(segment)
      index += 1
      continue
    }

    let tex = segment.value
    let display = segment.display
    index += 1

    while (index < segments.length) {
      const between = segments[index]
      if (between.kind !== 'text' || !isMathGlueText(between.value)) break

      tex += normalizeMathGlueText(between.value)
      index += 1
      if (index >= segments.length) break

      const next = segments[index]
      if (next.kind !== 'math') break

      tex += next.value
      display = display || next.display
      index += 1
    }

    result.push({ kind: 'math', value: normalizeTex(tex), display })
  }

  return result
}

export function expandMathSegments(segments: MathSegment[]): MathSegment[] {
  const expanded = segments.flatMap((segment) => {
    if (segment.kind === 'math') return [segment]
    return splitInlineMathFromPlainText(segment.value)
  })
  return mergeAdjacentMathSegments(expanded)
}

/** Whether a textarea selection falls entirely inside a $...$ / $$...$$ math span. */
export function isSelectionInsideMath(source: string, selectionStart: number, selectionEnd: number): boolean {
  if (selectionStart >= selectionEnd) return false

  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let match: RegExpExecArray | null

  while ((match = re.exec(source)) !== null) {
    const matchStart = match.index
    const matchEnd = match.index + match[0].length
    if (selectionStart >= matchStart && selectionEnd <= matchEnd) {
      return true
    }
  }

  return false
}

/** True when the gap word appears in non-formula plain text only. */
export function gapWordOccursOutsideMath(source: string, word: string): boolean {
  const trimmed = word.trim()
  if (!trimmed) return false

  return splitMathSegments(source).some(
    (segment) => isUsablePlainTextSegment(segment) && segment.value.includes(trimmed),
  )
}

export function isUsablePlainTextSegment(segment: MathSegment): boolean {
  return segment.kind === 'text' && !looksLikeMathPlainText(segment.value)
}

export function isFormulaSegment(segment: MathSegment): boolean {
  if (segment.kind === 'math') return true
  return looksLikeMathPlainText(segment.value)
}

const GAP_MARKER_RE = /\\text\{_+\}|_{3,}/

/** Gap markers or gap answers inside math / math-like plain text. */
export function hasForbiddenGapsInFormulas(source: string, gapWords: string[] = []): boolean {
  return splitMathSegments(source).some((segment) => {
    if (!isFormulaSegment(segment)) return false
    const content = segment.kind === 'math' ? segment.value : segment.value
    if (GAP_MARKER_RE.test(content)) return true
    return gapWords.some((word) => {
      const trimmed = word.trim()
      return trimmed.length > 0 && content.includes(trimmed)
    })
  })
}

/** Whether selection is inside $...$ or math-like plain text (no gaps allowed). */
export function isSelectionInsideForbiddenGapRegion(
  source: string,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  if (selectionStart >= selectionEnd) return false
  if (isSelectionInsideMath(source, selectionStart, selectionEnd)) return true

  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(source)) !== null) {
    if (match.index > last) {
      const plainStart = last
      const plainEnd = match.index
      if (
        looksLikeMathPlainText(source.slice(plainStart, plainEnd)) &&
        selectionStart >= plainStart &&
        selectionEnd <= plainEnd
      ) {
        return true
      }
    }
    last = match.index + match[0].length
  }

  if (last < source.length) {
    const plainStart = last
    if (
      looksLikeMathPlainText(source.slice(plainStart)) &&
      selectionStart >= plainStart &&
      selectionEnd <= source.length
    ) {
      return true
    }
  }

  return false
}

/** Replace ___ with answers only in usable plain-text segments. */
export function migrateGapsTextToSource(gapsText: string, gapAnswers: string[]): string {
  let answerIndex = 0
  const normalized = normalizeGapPlaceholders(gapsText)

  const countGapMarkers = (text: string): number =>
    (text.match(/\\text\{_+\}|_{3,}/g) ?? []).length

  return splitMathSegments(normalized)
    .map((segment) => {
      if (segment.kind === 'math') {
        answerIndex += countGapMarkers(segment.value)
        const cleaned = stripGapMarkersFromMathTex(segment.value)
        return segment.display ? `$$${cleaned}$$` : `$${cleaned}$`
      }
      if (looksLikeMathPlainText(segment.value)) {
        answerIndex += countGapMarkers(segment.value)
        return stripGapMarkersFromPlainSegment(segment.value)
      }
      return segment.value.replace(/_{3,}/g, () => {
        if (answerIndex >= gapAnswers.length) return '___'
        const word = gapAnswers[answerIndex]
        answerIndex += 1
        return word
      })
    })
    .join('')
}

/** Strip fill-gap placeholders from LaTeX formula text. */
export function stripGapMarkersFromMathTex(tex: string): string {
  return tex
    .replace(/\\text\{_+\}/g, '')
    .replace(/\\underline\{\s*\}/g, '')
    .replace(/_{3,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s-\s+(?=\+)/g, ' - ')
    .trim()
}

/** Plain text that looks like an inline formula (often missing $ delimiters from AI). */
export function looksLikeMathPlainText(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  if (/^[\d\s.)]+$/.test(value)) return false
  return /\\frac|\\text\{|\\cdot|\^|[a-z0-9]\s*\^\s*[{(]|[+-]\s*[a-z0-9({]/i.test(value)
}

function stripGapMarkersFromPlainSegment(text: string): string {
  if (!looksLikeMathPlainText(text)) return text
  return stripGapMarkersFromMathTex(text)
}

/**
 * Приводит маркеры пропусков от LLM/Word к ___ (например __2__, [1], буква+цифра+буква).
 */
export function normalizeGapPlaceholders(text: string): string {
  if (!text.trim()) return text

  let next = text.replace(/__\d+__/g, '___')
  next = next.replace(/\[\s*\d+\s*\]/g, '___')
  next = next.replace(/\{\s*\d+\s*\}/g, '___')
  // «числители1без» → «числители ___ без»
  next = next.replace(/([\p{L}]{2,})(\d{1,2})(?=[\p{L}])/gu, '$1 ___ ')
  return next.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1')
}

export function gapsTextHasBlankMarkers(text: string): boolean {
  return /_{3,}/.test(text) || /__\d+__/.test(text)
}

/** Remove gap markers from $...$ / $$...$$ and from math-like plain fragments. */
export function sanitizeGapsSourceText(source: string): string {
  if (!source.trim()) return source

  return splitMathSegments(source)
    .map((segment) => {
      if (segment.kind === 'math') {
        const cleaned = stripGapMarkersFromMathTex(segment.value)
        return segment.display ? `$$${cleaned}$$` : `$${cleaned}$`
      }
      return stripGapMarkersFromPlainSegment(segment.value)
    })
    .join('')
}

/** Whether source still contains gap markers inside math spans. */
export function hasGapMarkersInMath(source: string): boolean {
  return splitMathSegments(source).some((segment) => {
    if (segment.kind === 'math') {
      return /\\text\{_+\}|_{3,}/.test(segment.value)
    }
    return looksLikeMathPlainText(segment.value) && /\\text\{_+\}|_{3,}/.test(segment.value)
  })
}
