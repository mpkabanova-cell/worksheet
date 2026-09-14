import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import { toPng } from 'html-to-image'
import type { ExportContext, MathImageResult } from '@/export/word/types'

const PIXEL_RATIO = 2

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

function isInkPixel(data: Uint8ClampedArray, index: number): boolean {
  const alpha = data[index + 3]
  if (alpha < 12) return false
  const r = data[index]
  const g = data[index + 1]
  const b = data[index + 2]
  return r < 248 || g < 248 || b < 248
}

function cropInkBounds(
  source: HTMLCanvasElement,
): { canvas: HTMLCanvasElement; widthPx: number; heightPx: number } | null {
  const ctx = source.getContext('2d')
  if (!ctx) return null

  const { width, height } = source
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (!isInkPixel(data, index)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) return null

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1
  const cropped = document.createElement('canvas')
  cropped.width = cropW
  cropped.height = cropH
  const croppedCtx = cropped.getContext('2d')
  if (!croppedCtx) return null
  croppedCtx.drawImage(source, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

  return {
    canvas: cropped,
    widthPx: Math.max(1, Math.round(cropW / PIXEL_RATIO)),
    heightPx: Math.max(1, Math.round(cropH / PIXEL_RATIO)),
  }
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const dataUrl = canvas.toDataURL('image/png')
  const response = await fetch(dataUrl)
  return new Uint8Array(await response.arrayBuffer())
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

  const wrapper = document.createElement('span')
  wrapper.className = displayMode ? 'math-display' : 'math-inline'
  wrapper.style.display = displayMode ? 'block' : 'inline-block'
  wrapper.style.fontSize = `${fontSizePx}px`
  wrapper.style.color = '#161a33'
  wrapper.style.background = '#ffffff'
  wrapper.style.lineHeight = displayMode ? '1.2' : '1'
  wrapper.style.padding = '0'
  wrapper.style.margin = '0'
  wrapper.style.verticalAlign = 'baseline'
  wrapper.innerHTML = html

  const mount = getMountNode()
  const captureRoot = document.createElement('span')
  captureRoot.style.display = 'inline-block'
  captureRoot.style.background = '#ffffff'
  captureRoot.style.lineHeight = displayMode ? '1.2' : `${fontSizePx}px`
  captureRoot.style.fontSize = `${fontSizePx}px`
  captureRoot.style.verticalAlign = 'baseline'
  captureRoot.appendChild(wrapper)
  mount.replaceChildren(katexStyleNode!, captureRoot)

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })

  const dataUrl = await toPng(captureRoot, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Math image decode failed'))
    img.src = dataUrl
  })

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = img.width
  sourceCanvas.height = img.height
  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) throw new Error('Canvas unavailable')
  sourceCtx.drawImage(img, 0, 0)

  const cropped = cropInkBounds(sourceCanvas)
  const width = cropped?.widthPx ?? Math.max(1, Math.round(img.width / PIXEL_RATIO))
  const height = cropped?.heightPx ?? Math.max(1, Math.round(img.height / PIXEL_RATIO))
  const buffer = cropped ? await canvasToPng(cropped.canvas) : new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())

  const result: MathImageResult = {
    data: buffer,
    width,
    height,
    baselineOffsetPx: 0,
  }

  ctx.mathCache.set(key, result)
  return result
}
