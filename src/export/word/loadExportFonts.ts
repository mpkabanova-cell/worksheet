import { FONT } from '@/export/word/layoutTokens'

let loadPromise: Promise<void> | null = null

/** Load export-only serif fonts for DOCX rasterization (not used on the platform UI). */
export function ensureExportFontsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    if (document.getElementById('export-stix-font')) {
      await document.fonts.ready
      return
    }

    const link = document.createElement('link')
    link.id = 'export-stix-font'
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;0,500;0,600;1,400&display=swap'
    document.head.appendChild(link)

    await Promise.all([
      document.fonts.load(`400 16px "${FONT}"`),
      document.fonts.load(`500 16px "${FONT}"`),
      document.fonts.load(`600 16px "${FONT}"`),
    ])
    await document.fonts.ready
  })()

  return loadPromise
}
