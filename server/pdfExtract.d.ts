export type PdfVisionMode = 'sparse' | 'all' | 'off'

export function pageNeedsVision(
  text: string,
  mode: PdfVisionMode,
  minChars: number,
): boolean

export function extractTextFromPdf(
  data: Buffer,
  visionConfig?: {
    apiKey?: string
    baseUrl?: string
    model?: string
    timeoutMs?: number
    referer?: string
  },
): Promise<string>
