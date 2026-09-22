import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
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

  it('includes full filtered content without length cap', () => {
    const long = 'a'.repeat(20_000)
    const payload = referenceFilePayload({
      contextFileName: 'doc.docx',
      contextFileText: `5-6 классы\n\nУсловие задачи.\n\n${long}\n\nРешение:\n\n18 минут.\n\n7-8 классы\n\nдругое`,
      grade: '6',
    })
    expect(payload?.content?.length).toBeGreaterThan(19_000)
    expect(payload?.content).toContain('Условие задачи')
    expect(payload?.content).not.toContain('Решение:')
    expect(payload?.content).not.toContain('18 минут')
    expect(payload?.content).not.toContain('другое')
  })

  it('selects block by grade for reference payload', () => {
    const raw = `5-6 классы

Условие про пещеру.

7-8 классы

Задача про магазин.`
    const payload = referenceFilePayload({
      contextFileName: 'proba.pdf',
      contextFileText: raw,
      grade: '6',
    })
    expect(payload?.content).toContain('пещер')
    expect(payload?.content).not.toContain('магазин')
  })
})
