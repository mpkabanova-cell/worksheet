import { FONT_CSS } from '@/export/word/layoutTokens'
import { toPng } from 'html-to-image'
import type { DomImageResult, ExportContext } from '@/export/word/types'

let mountNode: HTMLDivElement | null = null

function getMountNode(): HTMLDivElement {
  if (!mountNode) {
    mountNode = document.createElement('div')
    mountNode.style.position = 'fixed'
    mountNode.style.left = '-10000px'
    mountNode.style.top = '0'
    mountNode.style.zIndex = '-1'
    mountNode.style.background = '#ffffff'
    document.body.appendChild(mountNode)
  }
  return mountNode
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

export type CaptureDomToPngOptions = {
  /** Capture full scroll width instead of clipping to declared width. */
  fitContent?: boolean
  contentPaddingPx?: number
}

export async function captureDomToPng(
  node: HTMLElement,
  cacheKey: string,
  ctx: ExportContext,
  beforeCapture?: (mountedRoot: HTMLElement) => void,
  options: CaptureDomToPngOptions = {},
): Promise<DomImageResult> {
  const cached = ctx.domImageCache.get(cacheKey)
  if (cached) return cached

  const mount = getMountNode()
  const captureRoot = document.createElement('div')
  captureRoot.style.display = 'inline-block'
  captureRoot.style.background = '#ffffff'
  captureRoot.style.fontFamily = FONT_CSS
  captureRoot.style.overflow = 'visible'
  captureRoot.style.setProperty('-webkit-print-color-adjust', 'exact')
  captureRoot.style.setProperty('print-color-adjust', 'exact')
  node.style.overflow = 'visible'
  captureRoot.appendChild(node)
  mount.replaceChildren(captureRoot)

  const initialDeclaredWidth = parseInt(node.style.width, 10)

  await waitForLayout()
  await waitForImages(node)
  beforeCapture?.(node)

  node.style.width = 'auto'
  node.style.maxWidth = 'none'
  node.style.overflow = 'visible'
  await waitForLayout()

  const measuredWidth = Math.ceil(node.scrollWidth)
  const paddingPx = options.contentPaddingPx ?? 8
  const fitContent = options.fitContent ?? false
  const captureWidth = fitContent
    ? Math.max(
        measuredWidth + paddingPx,
        Number.isFinite(initialDeclaredWidth) && initialDeclaredWidth > 0 ? initialDeclaredWidth : 0,
      )
    : Number.isFinite(initialDeclaredWidth) && initialDeclaredWidth > 0
      ? initialDeclaredWidth
      : Math.max(measuredWidth + paddingPx, 1)

  if (captureWidth > 0) {
    captureRoot.style.width = `${captureWidth}px`
    node.style.width = `${captureWidth}px`
    node.style.maxWidth = `${captureWidth}px`
    node.style.boxSizing = 'border-box'
    node.style.overflow = fitContent ? 'visible' : 'hidden'
  }

  await waitForLayout()

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
    img.onerror = () => reject(new Error('DOM image decode failed'))
    img.src = dataUrl
  })

  const result: DomImageResult = {
    data: buffer,
    width: Math.max(1, Math.round(img.width / 2)),
    height: Math.max(1, Math.round(img.height / 2)),
  }

  ctx.domImageCache.set(cacheKey, result)
  return result
}
