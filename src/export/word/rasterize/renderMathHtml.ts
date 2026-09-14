import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import { preprocessMathText, splitMathSegments } from '@/data/mathTextUtils'

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
}

export function appendMathText(parent: HTMLElement, text: string, options: MathHtmlOptions = {}): HTMLElement {
  const container = document.createElement('span')
  container.className = 'math-text'
  container.style.fontSize = `${options.fontSize ?? 14}px`
  container.style.lineHeight = `${options.lineHeight ?? 20}px`
  container.style.color = options.positive ? '#0DB56C' : (options.color ?? '#161A33')

  const prepared = preprocessMathText(text)
  for (const segment of splitMathSegments(prepared)) {
    if (segment.kind === 'text') {
      if (segment.value) {
        container.appendChild(document.createTextNode(segment.value))
      }
      continue
    }

    const span = document.createElement('span')
    span.className = segment.display ? 'math-display' : 'math-inline'
    span.innerHTML = katex.renderToString(segment.value, {
      displayMode: segment.display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    })
    container.appendChild(span)
  }

  parent.appendChild(container)
  return container
}
