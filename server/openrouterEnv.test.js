import { describe, expect, it } from 'vitest'
import {
  authErrorMessageForUpstream,
  authHintForKey,
  isLikelyOpenRouterKey,
  isOpenRouterUserNotFoundMessage,
  OPENROUTER_USER_NOT_FOUND_MESSAGE,
  resolveApiKey,
  resolveBaseUrl,
  resolveChatResponseFormat,
} from './openrouterEnv.js'

describe('resolveApiKey', () => {
  it('prefers OPENAI_API_KEY over OPENROUTER_API_KEY', () => {
    expect(
      resolveApiKey({
        OPENAI_API_KEY: ' sk-openai ',
        OPENROUTER_API_KEY: 'sk-or-fallback',
      }),
    ).toBe('sk-openai')
  })

  it('falls back to OPENROUTER_API_KEY', () => {
    expect(resolveApiKey({ OPENROUTER_API_KEY: '  sk-or-v1-test  ' })).toBe('sk-or-v1-test')
  })

  it('strips wrapping quotes', () => {
    expect(resolveApiKey({ OPENAI_API_KEY: '"sk-or-quoted"' })).toBe('sk-or-quoted')
  })
})

describe('resolveBaseUrl', () => {
  it('defaults to OpenRouter v1', () => {
    expect(resolveBaseUrl({})).toBe('https://openrouter.ai/api/v1')
  })

  it('trims trailing slash', () => {
    expect(resolveBaseUrl({ OPENAI_BASE_URL: 'https://openrouter.ai/api/v1/' })).toBe(
      'https://openrouter.ai/api/v1',
    )
  })
})

describe('key hints', () => {
  it('accepts sk-or and sk- prefixes', () => {
    expect(isLikelyOpenRouterKey('sk-or-v1-abc')).toBe(true)
    expect(isLikelyOpenRouterKey('sk-live')).toBe(true)
  })

  it('authHint warns on odd format', () => {
    expect(authHintForKey('not-a-key')).toMatch(/формат/)
    expect(authHintForKey('sk-or-ok')).toBeUndefined()
  })
})

describe('resolveChatResponseFormat', () => {
  it('omits json_object for Gemini', () => {
    expect(resolveChatResponseFormat('google/gemini-2.0-flash-001', undefined)).toBeUndefined()
    expect(
      resolveChatResponseFormat('google/gemini-2.0-flash-001', { type: 'json_object' }),
    ).toBeUndefined()
  })

  it('uses json_object for other models', () => {
    expect(resolveChatResponseFormat('openai/gpt-4o-mini', undefined)).toEqual({ type: 'json_object' })
  })
})

describe('authErrorMessageForUpstream', () => {
  it('detects User not found', () => {
    expect(isOpenRouterUserNotFoundMessage('User not found.')).toBe(true)
    expect(authErrorMessageForUpstream('User not found.')).toBe(OPENROUTER_USER_NOT_FOUND_MESSAGE)
  })
})
