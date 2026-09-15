import { FONT, FONT_MATH } from '@/export/word/layoutTokens'

let loadPromise: Promise<void> | null = null

/** Ensure export fonts (Arial body + Cambria Math for PNG fallback) are ready. */
export function ensureExportFontsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    await Promise.all([
      document.fonts.load(`400 16px "${FONT}"`),
      document.fonts.load(`500 16px "${FONT}"`),
      document.fonts.load(`600 16px "${FONT}"`),
      document.fonts.load(`400 16px "${FONT_MATH}"`),
    ])
    await document.fonts.ready
  })()

  return loadPromise
}
