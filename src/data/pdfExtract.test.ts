import { describe, expect, it, vi, beforeEach } from 'vitest'

const callVisionOcr = vi.fn(async () => '[график y=x^2]')
const getText = vi.fn(async () => ({ text: 'a'.repeat(250) }))
const getScreenshot = vi.fn(async () => ({
  pages: [{ data: Buffer.from('fake-png') }],
}))
const destroy = vi.fn(async () => {})

vi.mock('../../server/visionOcr.js', () => ({
  callVisionOcr,
}))

vi.mock('pdf-parse/worker', () => ({}))

vi.mock('pdf-parse', () => ({
  PDFParse: class {
    constructor() {}
    getText = getText
    getScreenshot = getScreenshot
    destroy = destroy
  },
}))

describe('extractTextFromPdf', () => {
  beforeEach(() => {
    callVisionOcr.mockClear()
    getText.mockClear()
    getScreenshot.mockClear()
    destroy.mockClear()
  })

  it('calls vision OCR via pdf-parse screenshots even when text layer is long', async () => {
    const { extractTextFromPdf } = await import('../../server/pdfExtract.js')
    const result = await extractTextFromPdf(Buffer.from('%PDF'), {})
    expect(getText).toHaveBeenCalled()
    expect(getScreenshot).toHaveBeenCalled()
    expect(callVisionOcr).toHaveBeenCalled()
    expect(result).toContain('[график y=x^2]')
    expect(result.length).toBeGreaterThan(200)
  })

  it('returns text layer when screenshot rendering fails', async () => {
    getScreenshot.mockRejectedValueOnce(new Error('render failed'))
    const { extractTextFromPdf } = await import('../../server/pdfExtract.js')
    const result = await extractTextFromPdf(Buffer.from('%PDF'), {})
    expect(result.length).toBeGreaterThan(200)
    expect(callVisionOcr).not.toHaveBeenCalled()
  })
})
