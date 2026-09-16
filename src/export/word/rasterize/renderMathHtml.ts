import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import {
  needsDoubleCellHeight,
  preprocessMathText,
  splitMathSegments,
  texForCellsLayout,
} from '@/data/mathTextUtils'
import { FONT_MATH_CSS } from '@/export/word/layoutTokens'

let katexStyleNode: HTMLStyleElement | null = null

export function ensureKatexStyles(mount: HTMLElement): void {
  if (katexStyleNode) return
  katexStyleNode = document.createElement('style')
  katexStyleNode.textContent = katexCss
  mount.appendChild(katexStyleNode)
}

export interface MathHtmlOptions {
  color?: string
  fontSize?: number
  lineHeight?: number
  positive?: boolean
  cellsLayout?: boolean
  cellSize?: number
}

function applyCellsDoubleHeightStyles(span: HTMLElement, cellSize: number): void {
  span.style.display = 'inline-block'
  span.style.verticalAlign = 'top'
  span.style.lineHeight = `${cellSize * 2}px`
  span.style.minHeight = `${cellSize * 2}px`
}

export function appendMathText(parent: HTMLElement, text: string, options: MathHtmlOptions = {}): HTMLElement {
  const cellSize = options.cellSize ?? options.lineHeight ?? 16
  const container = document.createElement('span')
  container.className = options.cellsLayout ? 'math-text math-text--cells' : 'math-text'
  container.style.fontFamily = FONT_MATH_CSS
  container.style.fontSize = `${options.fontSize ?? 14}px`
  container.style.lineHeight = `${options.cellsLayout ? cellSize : (options.lineHeight ?? 20)}px`
  container.style.color = options.positive ? '#0DB56C' : (options.color ?? '#161A33')

  const preparedRaw = preprocessMathText(text)
  const prepared =
    !preparedRaw.includes('$') && /\\(?:frac|text|cdot|times|sqrt|left|right)\b/.test(preparedRaw)
      ? `$${preparedRaw}$`
      : preparedRaw
  for (const segment of splitMathSegments(prepared)) {
    if (segment.kind === 'text') {
      if (segment.value) {
        container.appendChild(document.createTextNode(segment.value))
      }
      continue
    }

    const rawTex = segment.value
    const tex = options.cellsLayout ? texForCellsLayout(rawTex) : rawTex
    const doubleHeight = Boolean(options.cellsLayout && needsDoubleCellHeight(rawTex))
    const baseClass = segment.display ? 'math-display' : 'math-inline'
    const span = document.createElement('span')
    span.className = doubleHeight ? `${baseClass} ${baseClass}--cell-double` : baseClass
    if (doubleHeight) {
      applyCellsDoubleHeightStyles(span, cellSize)
      span.innerHTML = katex.renderToString(tex, {
        displayMode: segment.display,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
      })
      const katexEl = span.querySelector('.katex') as HTMLElement | null
      if (katexEl) katexEl.style.fontSize = '14px'
    } else {
      span.innerHTML = katex.renderToString(tex, {
        displayMode: segment.display,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
      })
    }
    container.appendChild(span)
  }

  parent.appendChild(container)
  return container
}
