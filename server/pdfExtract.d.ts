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
