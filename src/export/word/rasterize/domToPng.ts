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

function readIntPx(value: string): number | null {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** html-to-image can paint img at intrinsic PNG size; match layout width/height before capture. */
async function normalizeImagesForCapture(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(async (img) => {
      if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return

      const styleW = readIntPx(img.style.width)
      const styleH = readIntPx(img.style.height)
      const attrW = img.width > 0 ? img.width : null
      const attrH = img.height > 0 ? img.height : null
      const layoutW = styleW ?? attrW ?? (img.clientWidth > 0 ? img.clientWidth : null)
      let layoutH = styleH ?? attrH ?? (img.clientHeight > 0 ? img.clientHeight : null)

      if (layoutW == null) return
      if (layoutH == null) {
        layoutH = Math.max(1, Math.round((layoutW / img.naturalWidth) * img.naturalHeight))
      }

      if (img.naturalWidth === layoutW && img.naturalHeight === layoutH) {
        img.width = layoutW
        img.height = layoutH
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = layoutW
      canvas.height = layoutH
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, layoutW, layoutH)

      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = canvas.toDataURL('image/png')
      })
      img.width = layoutW
      img.height = layoutH
      img.style.width = `${layoutW}px`
      img.style.height = `${layoutH}px`
      img.style.maxWidth = `${layoutW}px`
      img.style.maxHeight = `${layoutH}px`
    }),
  )
}

export type CaptureDomToPngOptions = {
  /** Capture full scroll width instead of clipping to declared width. */
  fitContent?: boolean
  contentPaddingPx?: number
  /** Device pixel ratio for html-to-image (PDF export uses higher values). */
  pixelRatio?: number
}

/** Default 2×; PDF task slices use 3× for sharper print output. */
export const PDF_DOM_CAPTURE_PIXEL_RATIO = 3

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
    node.style.overflow = 'visible'
  }

  await waitForLayout()
  await normalizeImagesForCapture(captureRoot)

  const dataUrl = await toPng(captureRoot, {
    pixelRatio: options.pixelRatio ?? 2,
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
    width: Math.max(1, Math.round(img.width / (options.pixelRatio ?? 2))),
    height: Math.max(1, Math.round(img.height / (options.pixelRatio ?? 2))),
  }

  ctx.domImageCache.set(cacheKey, result)
  return result
}
