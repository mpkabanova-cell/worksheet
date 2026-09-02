import { Fragment, useMemo, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

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
  const nodes = useMemo(() => parseMathText(safeText), [safeText])

  return (
    <Tag className={className ? `math-text ${className}` : 'math-text'}>
      {nodes}
    </Tag>
  )
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
      nodes.push(<Fragment key={key++}>{input.slice(last, match.index)}</Fragment>)
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
    nodes.push(<Fragment key={key++}>{input.slice(last)}</Fragment>)
  }

  return nodes
}
