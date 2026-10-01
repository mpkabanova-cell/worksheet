import { Fragment, useMemo, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  needsDoubleCellHeight,
  preprocessMathText,
  texForCellsLayout,
} from '@/data/mathTextUtils'
import {
  parseContent,
  type ContentSegment,
} from '@/export/word/richText/parseRichText'

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

function wrapTextSegment(segment: ContentSegment & { kind: 'text' }): ReactNode {
  let node: ReactNode = segment.value
  if (segment.code) {
    node = <code className="math-text-code">{node}</code>
  }
  if (segment.underline) {
    node = <u className="gaps-answer-word">{node}</u>
  }
  if (segment.strike) {
    node = <s>{node}</s>
  }
  if (segment.italic) {
    node = <em>{node}</em>
  }
  if (segment.bold) {
    node = <strong>{node}</strong>
  }
  return node
}

function segmentToReact(segment: ContentSegment, key: number, layout: MathTextLayout): ReactNode {
  if (segment.kind === 'break') {
    return <br key={key} />
  }
  if (segment.kind === 'math') {
    const rawTex = segment.value.trim()
    const tex = layout === 'cells' ? texForCellsLayout(rawTex) : rawTex
    return (
      <span
        key={key}
        className={mathSpanClass(segment.display, layout, rawTex)}
        dangerouslySetInnerHTML={{ __html: renderKatex(tex, segment.display) }}
      />
    )
  }
  if (!segment.value) return null
  return <Fragment key={key}>{wrapTextSegment(segment)}</Fragment>
}

/** Renders WYSIWYG markdown subset, `<u>`, and `$...$` / `$$...$$` LaTeX via KaTeX. */
export function MathText({ text, className, as: Tag = 'span', layout = 'default' }: MathTextProps) {
  const safeText = typeof text === 'string' ? text : text == null ? '' : String(text)
  const prepared = useMemo(() => preprocessMathText(safeText), [safeText])
  const nodes = useMemo(
    () => parseContent(prepared).map((segment, index) => segmentToReact(segment, index, layout)),
    [prepared, layout],
  )

  const rootClass =
    className != null
      ? `math-text ${layout === 'cells' ? 'math-text--cells ' : ''}${className}`
      : layout === 'cells'
        ? 'math-text math-text--cells'
        : 'math-text'

  return <Tag className={rootClass}>{nodes}</Tag>
}
