/** Подготовка текста перед MathText / KaTeX. */
export function preprocessMathText(input: string): string {
  if (!input) return ''

  let text = input.replace(/\\div\b/g, ':')

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => `$$${normalizeTex(tex)}$$`)
  text = text.replace(/\$([^$\n]+?)\$/g, (_, tex: string) => `$${normalizeTex(tex)}$`)

  return text
}

function normalizeTex(tex: string): string {
  return tex
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
