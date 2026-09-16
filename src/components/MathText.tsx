import { Fragment, useMemo, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  needsDoubleCellHeight,
  preprocessMathText,
  texForCellsLayout,
} from '@/data/mathTextUtils'

export type MathTextLayout = 'default' | 'cells'

interface MathTextProps {
  text: string
  className?: string
  as?: 'span' | 'div' | 'p'
  layout?: MathTextLayout
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

function mathSpanClass(display: boolean, layout: MathTextLayout, tex: string): string {
  const base = display ? 'math-display' : 'math-inline'
  if (layout === 'cells' && needsDoubleCellHeight(tex)) {
    return `${base} ${base}--cell-double`
  }
  return base
}

/** Renders plain text with inline `$...$` and display `$$...$$` LaTeX via KaTeX. */
export function MathText({ text, className, as: Tag = 'span', layout = 'default' }: MathTextProps) {
  const safeText = typeof text === 'string' ? text : text == null ? '' : String(text)
  const prepared = useMemo(() => preprocessMathText(safeText), [safeText])
  const nodes = useMemo(() => parseMathText(prepared, layout), [prepared, layout])

  const rootClass =
    className != null
      ? `math-text ${layout === 'cells' ? 'math-text--cells ' : ''}${className}`
      : layout === 'cells'
        ? 'math-text math-text--cells'
        : 'math-text'

  return <Tag className={rootClass}>{nodes}</Tag>
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

function parseMathText(input: string, layout: MathTextLayout): ReactNode[] {
  if (!input) return []

  const nodes: ReactNode[] = []
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
    const rawTex = (display ? match[1] : match[2] ?? '').trim()
    const tex = layout === 'cells' ? texForCellsLayout(rawTex) : rawTex
    nodes.push(
      <span
        key={key++}
        className={mathSpanClass(display, layout, rawTex)}
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
