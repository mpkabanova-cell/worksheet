/** Normalize text for Word export while preserving boundary spaces around math. */
export function normalizeExportText(text: string): string {
  return text.replace(/\t/g, ' ').replace(/\u00a0/g, ' ').replace(/ {2,}/g, ' ')
}
