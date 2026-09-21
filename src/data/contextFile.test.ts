import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  CONTEXT_FILE_TEXT_MAX,
  extractContextFile,
  referenceFilePayload,
} from './contextFile'

describe('extractContextFile', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps successful API response to draft fields', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Распознанный текст' }),
    } as Response)

    const file = new File(['x'], 'scan.png', { type: 'image/png' })
    const result = await extractContextFile(file)

    expect(result).toEqual({
      name: 'scan.png',
      text: 'Распознанный текст',
      note: undefined,
    })
    expect(fetch).toHaveBeenCalledWith('/api/extract-context', expect.objectContaining({ method: 'POST' }))
  })

  it('returns note when text is empty', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: '' }),
    } as Response)

    const file = new File(['x'], 'empty.pdf', { type: 'application/pdf' })
    const result = await extractContextFile(file)

    expect(result.text).toBeUndefined()
    expect(result.note).toContain('empty.pdf')
  })

  it('throws on API error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'EXTRACT_ERROR', message: 'OpenRouter down' }),
    } as Response)

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await expect(extractContextFile(file)).rejects.toThrow('OpenRouter down')
  })
})

describe('referenceFilePayload', () => {
  it('returns null without attachment', () => {
    expect(referenceFilePayload({})).toBeNull()
  })

  it('includes content capped at max length', () => {
    const long = 'a'.repeat(CONTEXT_FILE_TEXT_MAX + 50)
    const payload = referenceFilePayload({
      contextFileName: 'doc.docx',
      contextFileText: long,
    })
    expect(payload?.content?.length).toBe(CONTEXT_FILE_TEXT_MAX)
  })
})
