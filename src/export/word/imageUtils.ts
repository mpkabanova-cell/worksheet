import type { ExportContext } from '@/export/word/types'

export async function fetchImageBytes(source: string, ctx: ExportContext): Promise<Uint8Array | null> {
  if (!source) return null
  if (ctx.imageCache.has(source)) return ctx.imageCache.get(source) ?? null

  let bytes: Uint8Array | null = null
  try {
    if (source.startsWith('data:')) {
      const base64 = source.split(',')[1]
      if (base64) {
        const binary = atob(base64)
        bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      }
    } else {
      const response = await fetch(source)
      if (response.ok) {
        bytes = new Uint8Array(await response.arrayBuffer())
      }
    }
  } catch {
    bytes = null
  }

  ctx.imageCache.set(source, bytes)
  return bytes
}
