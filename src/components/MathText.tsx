import { Fragment, useMemo, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { preprocessMathText } from '@/data/mathTextUtils'

interface MathTextProps {
  text: string
  className?: string
  as?: 'span' | 'div' | 'p'
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    })
  } catch {
    return tex
  }
}

/** Renders plain text with inline `$...$` and display `$$...$$` LaTeX via KaTeX. */
export function MathText({ text, className, as: Tag = 'span' }: MathTextProps) {
  const safeText = typeof text === 'string' ? text : text == null ? '' : String(text)
  const prepared = useMemo(() => preprocessMathText(safeText), [safeText])
  const nodes = useMemo(() => parseMathText(prepared), [prepared])

  return (
    <Tag className={className ? `math-text ${className}` : 'math-text'}>
      {nodes}
    </Tag>
  )
}

function parsePlainText(input: string, keyStart: number): ReactNode[] {
  if (!input) return []

  const nodes: ReactNode[] = []
  let key = keyStart
  const re = /<u>([\s\S]+?)<\/u>/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={key++}>{input.slice(last, match.index)}</Fragment>)
    }
    nodes.push(
      <u key={key++} className="gaps-answer-word">
        {match[1]}
      </u>,
    )
    last = match.index + match[0].length
  }

  if (last < input.length) {
    nodes.push(<Fragment key={key++}>{input.slice(last)}</Fragment>)
  }

  return nodes
}

function parseMathText(input: string): ReactNode[] {
  if (!input) return []

  const nodes: ReactNode[] = []
  // Display math first: $$...$$, then inline $...$
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      const plainNodes = parsePlainText(input.slice(last, match.index), key)
      nodes.push(...plainNodes)
      key += plainNodes.length
    }
    const display = match[1] != null
    const tex = (display ? match[1] : match[2] ?? '').trim()
    nodes.push(
      <span
        key={key++}
        className={display ? 'math-display' : 'math-inline'}
        dangerouslySetInnerHTML={{ __html: renderKatex(tex, display) }}
      />,
    )
    last = match.index + match[0].length
  }

  if (last < input.length) {
    const plainNodes = parsePlainText(input.slice(last), key)
    nodes.push(...plainNodes)
  }

  return nodes
}
