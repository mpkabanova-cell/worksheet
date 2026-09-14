import katex from 'katex'
import { toPng } from 'html-to-image'
import type { ExportContext, MathImageResult } from '@/export/word/types'

let mountNode: HTMLDivElement | null = null

function getMountNode(): HTMLDivElement {
  if (!mountNode) {
    mountNode = document.createElement('div')
    mountNode.style.position = 'fixed'
    mountNode.style.left = '-10000px'
    mountNode.style.top = '0'
    mountNode.style.background = '#ffffff'
    mountNode.style.padding = '2px 4px'
    mountNode.style.zIndex = '-1'
    document.body.appendChild(mountNode)
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
  wrapper.innerHTML = html

  const mount = getMountNode()
  mount.replaceChildren(wrapper)

  const dataUrl = await toPng(wrapper, {
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

  const result: MathImageResult = {
    data: buffer,
    width: Math.max(1, Math.round(img.width / 2)),
    height: Math.max(1, Math.round(img.height / 2)),
  }

  ctx.mathCache.set(key, result)
  return result
}
