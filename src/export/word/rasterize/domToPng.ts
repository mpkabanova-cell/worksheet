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

export async function captureDomToPng(
  node: HTMLElement,
  cacheKey: string,
  ctx: ExportContext,
  beforeCapture?: (mountedRoot: HTMLElement) => void,
): Promise<DomImageResult> {
  const cached = ctx.domImageCache.get(cacheKey)
  if (cached) return cached

  const mount = getMountNode()
  const captureRoot = document.createElement('div')
  captureRoot.style.display = 'inline-block'
  captureRoot.style.background = '#ffffff'
  captureRoot.style.fontFamily = FONT_CSS
  captureRoot.appendChild(node)
  mount.replaceChildren(captureRoot)

  await waitForLayout()
  await waitForImages(node)
  beforeCapture?.(node)

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
