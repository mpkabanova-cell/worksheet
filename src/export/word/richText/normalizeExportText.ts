/** Strip tabs/nbsp and trailing spaces so Word cell width matches visible text. */
export function normalizeExportText(text: string): string {
  return text.replace(/\t/g, ' ').replace(/\u00a0/g, ' ').replace(/ +/g, ' ').trimEnd()
}
