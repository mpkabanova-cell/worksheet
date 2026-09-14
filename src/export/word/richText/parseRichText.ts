import { preprocessMathText, splitMathSegments } from '@/data/mathTextUtils'

export interface FormattedTextSegment {
  kind: 'text'
  value: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  underline?: boolean
  code?: boolean
}

export interface MathContentSegment {
  kind: 'math'
  value: string
  display: boolean
}

export interface BreakSegment {
  kind: 'break'
}

export type ContentSegment = FormattedTextSegment | MathContentSegment | BreakSegment

type InlineStyle = Pick<
  FormattedTextSegment,
  'bold' | 'italic' | 'strike' | 'underline' | 'code'
>

const HR_RE = /\n\n---\n\n/g

/** Split plain text into formatted inline segments (markdown subset from WysiwygTextarea). */
function parseInlineMarkdown(input: string, style: InlineStyle = {}): ContentSegment[] {
  if (!input) return []

  const segments: ContentSegment[] = []

  const patterns: {
    re: RegExp
    apply: (s: InlineStyle) => InlineStyle
    strip: (match: string, inner: string) => string
  }[] = [
    {
      re: /\*\*([\s\S]+?)\*\*/,
      apply: (s) => ({ ...s, bold: true }),
      strip: (_, inner) => inner,
    },
    {
      re: /~~([\s\S]+?)~~/,
      apply: (s) => ({ ...s, strike: true }),
      strip: (_, inner) => inner,
    },
    {
      re: /<u>([\s\S]+?)<\/u>/,
      apply: (s) => ({ ...s, underline: true }),
      strip: (_, inner) => inner,
    },
    {
      re: /`([^`\n]+?)`/,
      apply: (s) => ({ ...s, code: true }),
      strip: (_, inner) => inner,
    },
    {
      re: /\*([^*\n]+?)\*/,
      apply: (s) => ({ ...s, italic: true }),
      strip: (_, inner) => inner,
    },
  ]

  function parseChunk(text: string, currentStyle: InlineStyle): void {
    if (!text) return

    let earliest: {
      index: number
      length: number
      inner: string
      nextStyle: InlineStyle
    } | null = null

    for (const pattern of patterns) {
      pattern.re.lastIndex = 0
      const match = pattern.re.exec(text)
      if (!match) continue
      if (!earliest || match.index < earliest.index) {
        earliest = {
          index: match.index,
          length: match[0].length,
          inner: match[1] ?? '',
          nextStyle: pattern.apply({ ...currentStyle }),
        }
      }
    }

    if (!earliest) {
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        if (line) {
          segments.push({
            kind: 'text',
            value: line,
            ...currentStyle,
          })
        }
        if (index < lines.length - 1) {
          segments.push({ kind: 'break' })
        }
      })
      return
    }

    if (earliest.index > 0) {
      parseChunk(text.slice(0, earliest.index), currentStyle)
    }
    parseChunk(earliest.inner, earliest.nextStyle)
    if (earliest.index + earliest.length < text.length) {
      parseChunk(text.slice(earliest.index + earliest.length), currentStyle)
    }
  }

  parseChunk(input, style)
  return segments
}

function parseHeadingLine(line: string): ContentSegment[] | null {
  const match = /^###\s+(.+)$/.exec(line)
  if (!match) return null
  return parseInlineMarkdown(match[1], { bold: true })
}

/** Parse WYSIWYG + math into export segments. */
export function parseContent(input: string): ContentSegment[] {
  if (!input) return []

  const parts = preprocessMathText(input).split(HR_RE)
  const result: ContentSegment[] = []

  parts.forEach((part, partIndex) => {
    if (partIndex > 0) {
      result.push({ kind: 'break' }, { kind: 'break' })
    }

    const mathSegments = splitMathSegments(part)
    for (const segment of mathSegments) {
      if (segment.kind === 'math') {
        result.push({ kind: 'math', value: segment.value, display: segment.display })
        continue
      }

      const lines = segment.value.split('\n')
      lines.forEach((line, lineIndex) => {
        const heading = parseHeadingLine(line)
        if (heading) {
          result.push(...heading)
        } else if (line.startsWith('### ')) {
          result.push(...parseInlineMarkdown(line.slice(4), { bold: true }))
        } else {
          result.push(...parseInlineMarkdown(line))
        }
        if (lineIndex < lines.length - 1) {
          result.push({ kind: 'break' })
        }
      })
    }
  })

  return result
}
