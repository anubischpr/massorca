import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimitService } from './service'
import { readNanGatewayCredential } from './nan-gateway-credentials'
import { fetchNanRateLimits } from './nan-usage-fetcher'
import { fetchClaudeRateLimits } from './claude-fetcher'
import { fetchCodexRateLimits } from './codex-fetcher'
import { okProvider, resetRateLimitProviderMocks } from './rate-limit-service-test-harness'

vi.mock('./claude-fetcher', () => ({
  fetchClaudeRateLimits: vi.fn(),
  fetchManagedAccountUsage: vi.fn()
}))

vi.mock('./codex-fetcher', () => ({
  consumeCodexRateLimitResetCredit: vi.fn(),
  fetchCodexRateLimits: vi.fn()
}))

vi.mock('./gemini-usage-fetcher', () => ({ fetchGeminiRateLimits: vi.fn() }))
vi.mock('./kimi-fetcher', () => ({ fetchKimiRateLimits: vi.fn() }))
vi.mock('./opencode-go-usage-source-selection', () => ({ fetchOpenCodeGoUsage: vi.fn() }))
vi.mock('./minimax/minimax-fetcher', () => ({ fetchMiniMaxRateLimits: vi.fn() }))
vi.mock('./grok-fetcher', () => ({ fetchGrokRateLimits: vi.fn() }))
vi.mock('./grok-auth', () => ({ readGrokAuthSession: vi.fn(() => ({ status: 'missing' })) }))
vi.mock('./zcode-usage-fetcher', () => ({ fetchZcodeRateLimits: vi.fn() }))
vi.mock('./antigravity-usage-fetcher', () => ({ fetchAntigravityRateLimits: vi.fn() }))
vi.mock('./cursor-fetcher', () => ({ fetchCursorRateLimits: vi.fn() }))
vi.mock('./cursor-auth', () => ({ readCursorAuthSession: vi.fn() }))
vi.mock('../minimax/minimax-cookie-store', () => ({ hasMiniMaxSessionCookie: vi.fn(() => false) }))
vi.mock('./nan-gateway-credentials', () => ({ readNanGatewayCredential: vi.fn() }))
vi.mock('./nan-usage-fetcher', () => ({ fetchNanRateLimits: vi.fn() }))

describe('RateLimitService NaN usage', () => {
  beforeEach(() => {
    resetRateLimitProviderMocks()
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 0))
    vi.mocked(fetchCodexRateLimits).mockResolvedValue(okProvider('codex', 0))
    vi.mocked(readNanGatewayCredential).mockResolvedValue({ status: 'missing' })
    vi.mocked(fetchNanRateLimits).mockResolvedValue({
      ...okProvider('nan', 0),
      status: 'unavailable'
    })
  })

  it('reports the gateway key as unconfigured until a fetch cycle finds it', async () => {
    const service = new RateLimitService()
    expect(service.getState().nanGatewayKeyConfigured).toBe(false)

    const credential = { status: 'ok', apiKey: 'k' } as const
    vi.mocked(readNanGatewayCredential).mockResolvedValue(credential)
    vi.mocked(fetchNanRateLimits).mockResolvedValue(okProvider('nan', 28))
    await service.refresh()

    expect(service.getState().nanGatewayKeyConfigured).toBe(true)
    expect(service.getState().nan?.session?.usedPercent).toBe(28)
    expect(fetchNanRateLimits).toHaveBeenCalledWith(expect.objectContaining({ credential }))
  })

  it('publishes an error snapshot without taking the cycle down when the fetch throws', async () => {
    vi.mocked(fetchNanRateLimits).mockRejectedValue(new Error('boom'))

    const service = new RateLimitService()
    await service.refresh()

    const state = service.getState()
    expect(state.nan).toMatchObject({ provider: 'nan', status: 'error', error: 'boom' })
    expect(state.gemini?.status).toBe('ok')
  })
})
