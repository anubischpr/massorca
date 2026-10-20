import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGentleShellAuthPath, readNanGatewayCredential } from './nan-gateway-credentials'
import { fetchNanRateLimits } from './nan-usage-fetcher'

const NOW = Date.parse('2026-10-20T12:00:00.000Z')
const SECRET = 'nan-test-secret'

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'orca-nan-usage-'))
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  rmSync(home, { recursive: true, force: true })
})

function writeAuth(contents: unknown, env: NodeJS.ProcessEnv = {}): void {
  const authPath = getGentleShellAuthPath(env, home)
  mkdirSync(join(authPath, '..'), { recursive: true })
  writeFileSync(authPath, JSON.stringify(contents))
}

function quotaResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const ok = { status: 'ok', apiKey: SECRET } as const

describe('readNanGatewayCredential', () => {
  it('reads the stored nan API key from the Gentle Shell agent home', async () => {
    writeAuth({ nan: { type: 'api_key', key: ` ${SECRET} ` }, other: { key: 'ignored' } })

    expect(await readNanGatewayCredential({ env: {}, home })).toEqual(ok)
  })

  it('honours PI_CODING_AGENT_DIR like the shell does', async () => {
    const env = { PI_CODING_AGENT_DIR: join(home, 'custom-agent') }
    writeAuth({ nan: { type: 'api_key', key: SECRET } }, env)

    expect(await readNanGatewayCredential({ env, home })).toEqual(ok)
    expect(await readNanGatewayCredential({ env: {}, home })).toEqual({ status: 'missing' })
  })

  it('falls back to NAN_API_KEY when nothing is stored', async () => {
    expect(await readNanGatewayCredential({ env: { NAN_API_KEY: SECRET }, home })).toEqual(ok)
  })

  it.each([
    ['a shell-command key', { nan: { type: 'api_key', key: '!pass show nan' } }],
    ['an OAuth entry', { nan: { type: 'oauth', access: 'token' } }],
    ['no nan entry', { anthropic: { type: 'api_key', key: 'other' } }],
    ['a multi-line key', { nan: { type: 'api_key', key: 'a\nb' } }]
  ])('treats %s as not configured', async (_label, auth) => {
    writeAuth(auth)

    expect(await readNanGatewayCredential({ env: {}, home })).toEqual({ status: 'missing' })
  })

  it('treats an unreadable auth file as not configured', async () => {
    const authPath = getGentleShellAuthPath({}, home)
    mkdirSync(join(authPath, '..'), { recursive: true })
    writeFileSync(authPath, '{not json')

    expect(await readNanGatewayCredential({ env: {}, home })).toEqual({ status: 'missing' })
  })
})

describe('fetchNanRateLimits', () => {
  it('returns unavailable without calling the network when no key is configured', async () => {
    const result = await fetchNanRateLimits({ credential: { status: 'missing' } })

    expect(result).toMatchObject({ provider: 'nan', status: 'unavailable' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps per-model allowances to buckets with the most-used model as the headline', async () => {
    vi.mocked(fetch).mockResolvedValue(
      quotaResponse({
        periodStart: '2026-10-01',
        models: [
          {
            model: 'deepseek-v4-flash',
            tokensUsed: 100,
            cap: 1000,
            periodEnd: '2026-11-01T00:00:00Z'
          },
          {
            model: 'glm5.3-flash',
            tokensUsed: 300,
            cap: 1000,
            periodEnd: '2026-10-25T00:00:00Z'
          },
          { model: 'glm5.3', tokensUsed: 0, cap: 0, periodEnd: '2026-10-25T00:00:00Z' }
        ]
      })
    )

    const result = await fetchNanRateLimits({ credential: ok })

    expect(result.status).toBe('ok')
    expect(result.buckets?.map((bucket) => [bucket.name, bucket.usedPercent])).toEqual([
      ['glm5.3-flash', 30],
      ['deepseek-v4-flash', 10]
    ])
    expect(result.monthly).toEqual({
      usedPercent: 30,
      windowMinutes: 43_200,
      resetsAt: Date.parse('2026-10-25T00:00:00Z'),
      resetDescription: null
    })
  })

  it('sends the key only as a bearer token and refuses redirects', async () => {
    vi.mocked(fetch).mockResolvedValue(quotaResponse({ models: [] }))

    await fetchNanRateLimits({ credential: ok })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://cloud-api.nan.builders/api/usage/quota')
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: expect.objectContaining({ Authorization: `Bearer ${SECRET}` })
    })
  })

  it('divides by the full-period cap when the model reports one', async () => {
    vi.mocked(fetch).mockResolvedValue(
      quotaResponse({ models: [{ model: 'glm5.3', tokensUsed: 50, cap: 100, fullCap: 400 }] })
    )

    const result = await fetchNanRateLimits({ credential: ok })

    expect(result.buckets?.[0]).toMatchObject({ name: 'glm5.3', usedPercent: 12.5, resetsAt: null })
  })

  it('fails the whole read when a metered model has unreadable usage', async () => {
    vi.mocked(fetch).mockResolvedValue(
      quotaResponse({
        models: [
          { model: 'glm5.3', tokensUsed: 10, cap: 100 },
          { model: 'qwen3.6', cap: 100 }
        ]
      })
    )

    const result = await fetchNanRateLimits({ credential: ok })

    expect(result).toMatchObject({ status: 'error', usageMetadata: { failureKind: 'parse' } })
    expect(result.buckets).toBeUndefined()
  })

  it('reports an HTTP failure without echoing the key', async () => {
    vi.mocked(fetch).mockResolvedValue(quotaResponse({ error: SECRET }, 401))

    const result = await fetchNanRateLimits({ credential: ok })

    expect(result).toMatchObject({ status: 'error', error: 'NaN usage request failed (HTTP 401)' })
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it('redacts the key from network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error(`connect failed for ${SECRET}`))

    const result = await fetchNanRateLimits({ credential: ok })

    expect(result).toMatchObject({ status: 'error', usageMetadata: { failureKind: 'network' } })
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it('reports a body that is not JSON as a parse failure', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>blocked</html>', { status: 200 }))

    expect(await fetchNanRateLimits({ credential: ok })).toMatchObject({
      status: 'error',
      usageMetadata: { failureKind: 'parse' }
    })
  })
})
