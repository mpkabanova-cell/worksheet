import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import { toPng } from 'html-to-image'
import type { ExportContext, MathImageResult } from '@/export/word/types'

let mountNode: HTMLDivElement | null = null
let katexStyleNode: HTMLStyleElement | null = null

function getMountNode(): HTMLDivElement {
  if (!mountNode) {
    mountNode = document.createElement('div')
    mountNode.style.position = 'fixed'
    mountNode.style.left = '-10000px'
    mountNode.style.top = '0'
    mountNode.style.background = '#ffffff'
    mountNode.style.padding = '0'
    mountNode.style.zIndex = '-1'
    document.body.appendChild(mountNode)
  }

  if (!katexStyleNode) {
    katexStyleNode = document.createElement('style')
    katexStyleNode.textContent = katexCss
    mountNode.appendChild(katexStyleNode)
  }

  return mountNode
}

function cacheKey(tex: string, displayMode: boolean, fontSizePx: number): string {
  return `${displayMode ? 'd' : 'i'}:${fontSizePx}:${tex}`
}

export async function renderMathToPng(
  tex: string,
  displayMode: boolean,
  fontSizePx: number,
  ctx: ExportContext,
): Promise<MathImageResult> {
  const key = cacheKey(tex, displayMode, fontSizePx)
  const cached = ctx.mathCache.get(key)
  if (cached) return cached

  const html = katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
  })

  const wrapper = document.createElement('div')
  wrapper.className = displayMode ? 'math-display' : 'math-inline'
  wrapper.style.display = displayMode ? 'block' : 'inline-block'
  wrapper.style.fontSize = `${fontSizePx * 1.05}px`
  wrapper.style.color = '#161a33'
  wrapper.style.background = '#ffffff'
  wrapper.style.lineHeight = displayMode ? '1.2' : '1'
  wrapper.style.padding = '0'
  wrapper.style.margin = '0'
  wrapper.innerHTML = html

  const mount = getMountNode()
  const captureRoot = document.createElement('div')
  captureRoot.style.display = 'inline-block'
  captureRoot.style.background = '#ffffff'
  captureRoot.appendChild(wrapper)
  mount.replaceChildren(katexStyleNode!, captureRoot)

  const dataUrl = await toPng(captureRoot, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })

  const response = await fetch(dataUrl)
  const buffer = new Uint8Array(await response.arrayBuffer())

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Math image decode failed'))
    img.src = dataUrl
  })

  const rawWidth = Math.max(1, Math.round(img.width / 2))
  const rawHeight = Math.max(1, Math.round(img.height / 2))
  const targetHeight = displayMode ? rawHeight : Math.max(rawHeight, Math.round(fontSizePx * 1.05))
  const scale = targetHeight / rawHeight
  const width = Math.max(1, Math.round(rawWidth * scale))

  const result: MathImageResult = {
    data: buffer,
    width,
    height: targetHeight,
    baselineOffsetPx: displayMode ? 0 : Math.max(0, Math.round((targetHeight - fontSizePx) * 0.35)),
  }

  ctx.mathCache.set(key, result)
  return result
}
