import { describe, expect, it, vi, beforeEach } from 'vitest'

const callVisionOcr = vi.fn(async () => '[график y=x^2]')
const getText = vi.fn(async () => ({ text: 'a'.repeat(250) }))
const destroy = vi.fn(async () => {})

vi.mock('../../server/visionOcr.js', () => ({
  callVisionOcr,
}))

vi.mock('pdf-parse', () => ({
  PDFParse: class {
    constructor() {}
    getText = getText
    destroy = destroy
  },
}))

vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(async () => ({
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('fake-png')
    },
    destroy: vi.fn(async () => {}),
  })),
}))

describe('extractTextFromPdf', () => {
  beforeEach(() => {
    callVisionOcr.mockClear()
    getText.mockClear()
  })

  it('calls vision OCR even when pdf text layer is long', async () => {
    const { extractTextFromPdf } = await import('../../server/pdfExtract.js')
    const result = await extractTextFromPdf(Buffer.from('%PDF'), {})
    expect(getText).toHaveBeenCalled()
    expect(callVisionOcr).toHaveBeenCalled()
    expect(result).toContain('[график y=x^2]')
    expect(result.length).toBeGreaterThan(200)
  })
})
