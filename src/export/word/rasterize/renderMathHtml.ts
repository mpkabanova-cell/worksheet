import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import {
  needsDoubleCellHeight,
  preprocessMathText,
  texForCellsLayout,
} from '@/data/mathTextUtils'
import { FONT_MATH_CSS, resolveTextColorCss } from '@/export/word/layoutTokens'

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

function applyKatexColor(root: HTMLElement, color: string): void {
  root.style.color = color
  root.querySelectorAll('.katex').forEach((node) => {
    ;(node as HTMLElement).style.color = color
  })
}

function appendPlainTextWithGapsMarkup(parent: HTMLElement, plain: string): void {
  if (!plain) return

  const re = /<u>([\s\S]+?)<\/u>/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(plain)) !== null) {
    if (match.index > last) {
      parent.appendChild(document.createTextNode(plain.slice(last, match.index)))
    }
    const u = document.createElement('u')
    u.textContent = match[1] ?? ''
    u.style.textDecoration = 'underline'
    u.style.textUnderlineOffset = '2px'
    parent.appendChild(u)
    last = match.index + match[0].length
  }

  if (last < plain.length) {
    parent.appendChild(document.createTextNode(plain.slice(last)))
  }
}

function appendKatexSegment(
  parent: HTMLElement,
  rawTex: string,
  display: boolean,
  options: MathHtmlOptions,
): void {
  const cellSize = options.cellSize ?? options.lineHeight ?? 16
  const color = options.positive ? '#0DB56C' : (options.color ?? resolveTextColorCss({}))
  const tex = options.cellsLayout ? texForCellsLayout(rawTex) : rawTex
  const doubleHeight = Boolean(options.cellsLayout && needsDoubleCellHeight(rawTex))
  const baseClass = display ? 'math-display' : 'math-inline'
  const span = document.createElement('span')
  span.className = doubleHeight ? `${baseClass} ${baseClass}--cell-double` : baseClass
  if (doubleHeight) {
    applyCellsDoubleHeightStyles(span, cellSize)
    span.innerHTML = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    })
    const katexEl = span.querySelector('.katex') as HTMLElement | null
    if (katexEl) katexEl.style.fontSize = '14px'
    applyKatexColor(span, color)
  } else {
    span.innerHTML = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    })
    applyKatexColor(span, color)
  }
  parent.appendChild(span)
}

function appendPreparedMathText(
  parent: HTMLElement,
  prepared: string,
  options: MathHtmlOptions,
): HTMLElement {
  const cellSize = options.cellSize ?? options.lineHeight ?? 16
  const color = options.positive ? '#0DB56C' : (options.color ?? resolveTextColorCss({}))
  const container = document.createElement('span')
  container.className = options.cellsLayout ? 'math-text math-text--cells' : 'math-text'
  container.style.fontFamily = FONT_MATH_CSS
  container.style.fontSize = `${options.fontSize ?? 14}px`
  container.style.lineHeight = `${options.cellsLayout ? cellSize : (options.lineHeight ?? 20)}px`
  container.style.color = color

  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(prepared)) !== null) {
    if (match.index > last) {
      appendPlainTextWithGapsMarkup(container, prepared.slice(last, match.index))
    }
    const display = match[1] != null
    const rawTex = (display ? match[1] : match[2] ?? '').trim()
    if (rawTex) {
      appendKatexSegment(container, rawTex, display, options)
    }
    last = match.index + match[0].length
  }

  if (last < prepared.length) {
    appendPlainTextWithGapsMarkup(container, prepared.slice(last))
  }

  parent.appendChild(container)
  return container
}

export function appendMathText(parent: HTMLElement, text: string, options: MathHtmlOptions = {}): HTMLElement {
  const prepared = preprocessMathText(text)
  return appendPreparedMathText(parent, prepared, options)
}

/** fill_gaps: same pipeline as portal MathText (preprocess + $…$ + `<u>` answers). */
export function appendGapsText(parent: HTMLElement, text: string, options: MathHtmlOptions = {}): HTMLElement {
  return appendMathText(parent, text, options)
}
