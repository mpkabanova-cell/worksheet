import { describe, expect, it, vi, beforeEach } from 'vitest'

const callVisionOcr = vi.fn(async () => '[график y=x^2]')
const getText = vi.fn(async () => ({
  pages: [
    { pageNumber: 1, text: 'a'.repeat(250) },
    { pageNumber: 2, text: 'коротко' },
  ],
}))
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
    vi.resetModules()
    callVisionOcr.mockClear()
    getText.mockClear()
    getScreenshot.mockClear()
    destroy.mockClear()
    delete process.env.PDF_VISION_MODE
  })

  it('uses text layer for rich pages and vision only for sparse pages', async () => {
    const { extractTextFromPdf } = await import('../../server/pdfExtract.js')
    const result = await extractTextFromPdf(Buffer.from('%PDF'), {})
    expect(getText).toHaveBeenCalled()
    expect(getScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ partial: [2], scale: expect.any(Number) }),
    )
    expect(callVisionOcr).toHaveBeenCalledTimes(1)
    expect(result).toContain('a'.repeat(250))
    expect(result).toContain('[график y=x^2]')
  })

  it('returns text layer when screenshot rendering fails', async () => {
    getScreenshot.mockRejectedValueOnce(new Error('render failed'))
    const { extractTextFromPdf } = await import('../../server/pdfExtract.js')
    const result = await extractTextFromPdf(Buffer.from('%PDF'), {})
    expect(result).toContain('a'.repeat(250))
    expect(callVisionOcr).not.toHaveBeenCalled()
  })

  it('runs vision on all pages when PDF_VISION_MODE=all', async () => {
    process.env.PDF_VISION_MODE = 'all'
    getScreenshot.mockResolvedValueOnce({
      pages: [{ data: Buffer.from('p1') }, { data: Buffer.from('p2') }],
    })
    const { extractTextFromPdf } = await import('../../server/pdfExtract.js')
    await extractTextFromPdf(Buffer.from('%PDF'), {})
    expect(getScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ partial: [1, 2] }),
    )
    expect(callVisionOcr).toHaveBeenCalledTimes(2)
  })
})

describe('pageNeedsVision', () => {
  it('skips vision for long text in sparse mode', async () => {
    const { pageNeedsVision } = await import('../../server/pdfExtract.js')
    expect(pageNeedsVision('x'.repeat(200), 'sparse', 120)).toBe(false)
    expect(pageNeedsVision('коротко', 'sparse', 120)).toBe(true)
  })
})
