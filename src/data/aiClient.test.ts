import { describe, expect, it, vi, afterEach } from 'vitest'
import { AiError, AUTH_ERROR_USER_MESSAGE, chatJson, extractJson, isAuthError } from '@/data/aiClient'
import { sanitizeAiJsonText } from '@/data/mathTextUtils'

describe('sanitizeAiJsonText', () => {
  it('fixes invalid LaTeX escapes like \\sin before JSON.parse', () => {
    const raw = '{"q":"$\\sin x$"}'
    const parsed = JSON.parse(sanitizeAiJsonText(raw)) as { q: string }
    expect(parsed.q).toBe('$\\sin x$')
  })

  it('fixes \\frac before JSON.parse (avoids form-feed corruption)', () => {
    const raw = '{"q":"$\\frac{1}{2}$"}'
    const parsed = JSON.parse(sanitizeAiJsonText(raw)) as { q: string }
    expect(parsed.q).toBe('$\\frac{1}{2}$')
    expect(parsed.q).not.toContain('\u000C')
  })

  it('fixes \\tg before JSON.parse (avoids tab corruption)', () => {
    const raw = String.raw`{"q":"$\tg 30^{\circ}$"}`
    const parsed = JSON.parse(sanitizeAiJsonText(raw)) as { q: string }
    expect(parsed.q).toContain('\\tg')
    expect(parsed.q).not.toContain('\t')
  })

  it('fixes \\left and \\sqrt in JSON strings', () => {
    const raw = String.raw`{"q":"$\\left(\\sqrt{x}\\right)$"}`
    const parsed = JSON.parse(sanitizeAiJsonText(raw)) as { q: string }
    expect(parsed.q).toBe('$\\left(\\sqrt{x}\\right)$')
  })

  it('does not alter content outside JSON string values', () => {
    const raw = '{ "q": "$\\sin x$", "n": 1 }'
    const parsed = JSON.parse(sanitizeAiJsonText(raw)) as { q: string; n: number }
    expect(parsed.q).toBe('$\\sin x$')
    expect(parsed.n).toBe(1)
  })
})

describe('extractJson', () => {
  it('parses JSON with LaTeX from a markdown fence', () => {
    const content = '```json\n{"q":"$\\sin x$"}\n```'
    const parsed = extractJson(content) as { q: string }
    expect(parsed.q).toBe('$\\sin x$')
  })

  it('parses JSON embedded in surrounding text', () => {
    const content = 'Here is the worksheet:\n{"tasks":[{"question":"$\\frac{2}{3}$"}]}\nDone.'
    const parsed = extractJson(content) as { tasks: { question: string }[] }
    expect(parsed.tasks[0].question).toBe('$\\frac{2}{3}$')
  })

  it('parses first balanced object when extra braces follow', () => {
    const content =
      'Ответ:\n{"tasks":[{"question":"У Кроша 5 яблок"}]}\n\nДополнительно: {"ignored": true}'
    const parsed = extractJson(content) as { tasks: { question: string }[] }
    expect(parsed.tasks[0].question).toContain('Крош')
  })

  it('repairs trailing commas before closing brackets', () => {
    const content = '{"tasks":[{"question":"$\\frac{1}{2}$",},],}'
    const parsed = extractJson(content) as { tasks: { question: string }[] }
    expect(parsed.tasks[0].question).toBe('$\\frac{1}{2}$')
  })

  it('throws AiError instead of raw SyntaxError for broken JSON', () => {
    expect(() => extractJson('not json at all')).toThrow(AiError)
    expect(() => extractJson('not json at all')).toThrow('Модель вернула невалидный JSON')
    try {
      extractJson('{"q":"$\\sin x$", broken}')
    } catch (err) {
      expect(err).toBeInstanceOf(AiError)
      expect(err).not.toBeInstanceOf(SyntaxError)
      expect((err as Error).message).not.toContain('Bad escaped character')
    }
  })
})

describe('chatJson auth errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps 401 with AUTH_ERROR to user message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({ error: 'AUTH_ERROR', message: AUTH_ERROR_USER_MESSAGE }),
      })),
    )

    await expect(chatJson('sys', 'user')).rejects.toSatisfy((err: unknown) => {
      expect(isAuthError(err)).toBe(true)
      expect(err).toBeInstanceOf(AiError)
      return true
    })
  })
})
