import { FONT } from '@/export/word/layoutTokens'

let loadPromise: Promise<void> | null = null

/** Ensure system Arial is ready before DOCX rasterization (not used on the platform UI). */
export function ensureExportFontsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    await Promise.all([
      document.fonts.load(`400 16px "${FONT}"`),
      document.fonts.load(`500 16px "${FONT}"`),
      document.fonts.load(`600 16px "${FONT}"`),
    ])
    await document.fonts.ready
  })()

  return loadPromise
}
