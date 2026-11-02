import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askJevChoice, isSafeAbstractText, type JevChoiceRequest } from './jev-decision-client'

const API_KEY = 'test-jev-key'
const REQUEST: JevChoiceRequest = {
  state: 'Abstract task',
  instructions: 'Pick one',
  criteria: { low: 'Low', high: 'High' }
}

function jevBody(choice = 'high'): string {
  return JSON.stringify({
    model: 'jev-1.2.3',
    answers: { decision: { type: 'choice', choice, confidence: 0.9 } }
  })
}

function clientWith(fetchImpl: typeof fetch) {
  return { isEnabled: () => true, readApiKey: () => API_KEY, fetchImpl }
}

describe('askJevChoice', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('reads no key and calls nothing while the feature is off', async () => {
    const readApiKey = vi.fn(() => API_KEY)
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(
      askJevChoice(REQUEST, { isEnabled: () => false, readApiKey, fetchImpl })
    ).resolves.toBeNull()

    expect(readApiKey).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('calls nothing when the key is missing or cannot be decrypted', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const unreadable = (): string => {
      throw new Error('decrypt failed')
    }

    await expect(
      askJevChoice(REQUEST, { isEnabled: () => true, readApiKey: () => null, fetchImpl })
    ).resolves.toBeNull()
    await expect(
      askJevChoice(REQUEST, { isEnabled: () => true, readApiKey: unreadable, fetchImpl })
    ).resolves.toBeNull()

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts one choice question without following redirects and returns the answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(jevBody()))

    await expect(askJevChoice(REQUEST, clientWith(fetchImpl))).resolves.toEqual({
      choice: 'high',
      confidence: 0.9
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${API_KEY}`)
    expect(JSON.parse(String(init?.body))).toEqual({
      state: 'Abstract task',
      model: 'jev-latest',
      questions: {
        decision: { type: 'choice', instructions: 'Pick one', criteria: REQUEST.criteria }
      }
    })
  })

  it.each([
    ['an HTTP failure', () => new Response('nope', { status: 500 })],
    ['an unparsable body', () => new Response('not json')],
    ['a wrong shape', () => new Response('{"answers":{}}')],
    ['a choice outside the criteria', () => new Response(jevBody('medium'))],
    ['an inherited key as the choice', () => new Response(jevBody('constructor'))],
    ['an oversized body', () => new Response(' '.repeat(70000))]
  ])('returns null on %s', async (_name, respond) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => respond())

    await expect(askJevChoice(REQUEST, clientWith(fetchImpl))).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns null without a retry when the network fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('offline')
    })

    await expect(askJevChoice(REQUEST, clientWith(fetchImpl))).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('gives up at the timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )

    await expect(
      askJevChoice({ ...REQUEST, timeoutMs: 5 }, clientWith(fetchImpl))
    ).resolves.toBeNull()
  })

  it('never logs the key or the provider response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(`${API_KEY} provider detail`, { status: 500 })
    )

    await askJevChoice(REQUEST, clientWith(fetchImpl))

    expect(warn).toHaveBeenCalledWith('[jev] decision skipped: http_500')
    expect(JSON.stringify(warn.mock.calls)).not.toContain(API_KEY)
  })
})

describe('isSafeAbstractText', () => {
  it.each(['Implement the parser fix', 'Corregir la validación del formulario (bajo impacto)'])(
    'accepts %s',
    (text) => {
      expect(isSafeAbstractText(text)).toBe(true)
    }
  )

  it.each([
    ['empty text', ''],
    ['a path', 'Fix src/main/index.ts'],
    ['a Windows path', 'Fix C:\\Users\\someone'],
    ['a URL', 'Read https://example.com'],
    ['a sensitive word', 'Rotate the api key'],
    ['a long number', 'Handle order 1234567'],
    ['an email', 'Write to someone@example.com'],
    ['more than 160 characters', 'a'.repeat(161)]
  ])('rejects %s', (_name, text) => {
    expect(isSafeAbstractText(text)).toBe(false)
  })
})
