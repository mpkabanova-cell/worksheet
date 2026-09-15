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

/** Подготовка текста перед MathText / KaTeX. */
export function preprocessMathText(input: string): string {
  if (!input) return ''

  let text = repairJsonLatexEscapes(input)
  text = text.replace(/\\div\b/g, ':')

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => `$$${normalizeTex(tex)}$$`)
  text = text.replace(/\$([^$\n]+?)\$/g, (_, tex: string) => `$${normalizeTex(tex)}$`)

  return text
}

function normalizeTex(tex: string): string {
  return repairJsonLatexEscapes(tex)
    .replace(/\\div\b/g, ':')
    .replace(/_{2,}/g, (underscores) => `\\text{${underscores}}`)
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

/** True when the gap word appears in plain text outside math delimiters. */
export function gapWordOccursOutsideMath(source: string, word: string): boolean {
  const trimmed = word.trim()
  if (!trimmed) return false

  return splitMathSegments(source).some(
    (segment) => segment.kind === 'text' && segment.value.includes(trimmed),
  )
}
