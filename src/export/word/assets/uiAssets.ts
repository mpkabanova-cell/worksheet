import starFilledUrl from '@/assets/worksheet/star-filled.svg?url'
import starEmptyUrl from '@/assets/worksheet/star-empty.svg?url'
import type { ExportContext } from '@/export/word/types'

async function rasterizeSvg(url: string, size: number): Promise<Uint8Array> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load asset: ${url}`))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error('PNG encode failed'))
    }, 'image/png')
  })

  return new Uint8Array(await blob.arrayBuffer())
}

function drawRadioChecked(size: number): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const center = size
  const outerR = size - 1
  ctx.beginPath()
  ctx.arc(center, center, outerR, 0, Math.PI * 2)
  ctx.fillStyle = '#0DB56C'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(center, center, size * 0.375, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  const blob = canvas.toDataURL('image/png')
  const base64 = blob.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function drawCheckboxChecked(size: number): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const pad = 2
  const radius = 4
  ctx.fillStyle = '#0DB56C'
  ctx.beginPath()
  ctx.roundRect(pad, pad, size * 2 - pad * 2, size * 2 - pad * 2, radius * 2)
  ctx.fill()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(size * 0.55, size * 1.05)
  ctx.lineTo(size * 0.85, size * 1.35)
  ctx.lineTo(size * 1.55, size * 0.55)
  ctx.stroke()

  const blob = canvas.toDataURL('image/png')
  const base64 = blob.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function drawCircle(size: number, fill: string, stroke?: string): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const r = size - 1
  ctx.beginPath()
  ctx.arc(size, size, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }

  const blob = canvas.toDataURL('image/png')
  const base64 = blob.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function cachedAsset(
  ctx: ExportContext,
  key: string,
  loader: () => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const hit = ctx.imageCache.get(key)
  if (hit) return hit

  const bytes = await loader()
  ctx.imageCache.set(key, bytes)
  return bytes
}

export async function getStarFilledPng(ctx: ExportContext, size = 16): Promise<Uint8Array> {
  return cachedAsset(ctx, `star-filled-${size}`, () => rasterizeSvg(starFilledUrl, size))
}

export async function getStarEmptyPng(ctx: ExportContext, size = 16): Promise<Uint8Array> {
  return cachedAsset(ctx, `star-empty-${size}`, () => rasterizeSvg(starEmptyUrl, size))
}

export async function getChoiceRadioMarkerPng(ctx: ExportContext, size = 16): Promise<Uint8Array> {
  return cachedAsset(ctx, `choice-radio-${size}`, async () => drawCircle(size, '#E4E6F7'))
}

export async function getChoiceRadioCheckedPng(ctx: ExportContext, size = 16): Promise<Uint8Array> {
  return cachedAsset(ctx, `choice-radio-checked-${size}`, async () => drawRadioChecked(size))
}

export async function getChoiceCheckboxCheckedPng(ctx: ExportContext, size = 16): Promise<Uint8Array> {
  return cachedAsset(ctx, `choice-checkbox-checked-${size}`, async () => drawCheckboxChecked(size))
}

export async function getChoiceCheckboxMarkerPng(ctx: ExportContext, size = 16): Promise<Uint8Array> {
  return cachedAsset(ctx, `choice-checkbox-${size}`, async () => {
    const canvas = document.createElement('canvas')
    canvas.width = size * 2
    canvas.height = size * 2
    const c = canvas.getContext('2d')
    if (!c) throw new Error('Canvas unavailable')
    const radius = 3
    c.fillStyle = '#E4E6F7'
    c.beginPath()
    c.roundRect(size - size + 2, size - size + 2, size * 2 - 4, size * 2 - 4, radius * 2)
    c.fill()
    const blob = canvas.toDataURL('image/png')
    const base64 = blob.split(',')[1] ?? ''
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  })
}
