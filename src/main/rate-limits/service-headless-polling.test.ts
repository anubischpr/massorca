import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimitService } from './service'
import { fetchClaudeRateLimits } from './claude-fetcher'
import { fetchCodexRateLimits } from './codex-fetcher'
import {
  asRateLimitWindow,
  FakeRateLimitWindow,
  okProvider,
  resetRateLimitProviderMocks
} from './rate-limit-service-test-harness'

vi.mock('./claude-fetcher', () => ({
  fetchClaudeRateLimits: vi.fn(),
  fetchManagedAccountUsage: vi.fn()
}))

vi.mock('./codex-fetcher', () => ({
  consumeCodexRateLimitResetCredit: vi.fn(),
  fetchCodexRateLimits: vi.fn()
}))

vi.mock('./gemini-usage-fetcher', () => ({
  fetchGeminiRateLimits: vi.fn()
}))

vi.mock('./kimi-fetcher', () => ({
  fetchKimiRateLimits: vi.fn()
}))

vi.mock('./opencode-go-usage-source-selection', () => ({
  fetchOpenCodeGoUsage: vi.fn()
}))

vi.mock('./zcode-usage-fetcher', () => ({
  fetchZcodeRateLimits: vi.fn()
}))
// Why: keep the NaN meter offline; a real Gentle Shell key on the dev machine must not reach the network.
vi.mock('./nan-gateway-credentials', () => ({
  readNanGatewayCredential: vi.fn(async () => ({ status: 'missing' }))
}))

vi.mock('./antigravity-usage-fetcher', () => ({
  fetchAntigravityRateLimits: vi.fn()
}))

vi.mock('./minimax/minimax-fetcher', () => ({
  fetchMiniMaxRateLimits: vi.fn()
}))

vi.mock('./grok-fetcher', () => ({
  fetchGrokRateLimits: vi.fn()
}))

vi.mock('./cursor-fetcher', () => ({
  fetchCursorRateLimits: vi.fn()
}))

vi.mock('./cursor-auth', () => ({
  readCursorAuthSession: vi.fn()
}))

vi.mock('./grok-auth', () => ({
  readGrokAuthSession: vi.fn(() => ({ status: 'missing' }))
}))

vi.mock('../minimax/minimax-cookie-store', () => ({
  hasMiniMaxSessionCookie: vi.fn(() => false)
}))

describe('RateLimitService headless background polling', () => {
  beforeEach(() => {
    resetRateLimitProviderMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const POLL_MS = 15 * 60 * 1000

  it('does not poll a headless host with no remote subscriber', async () => {
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 12))
    vi.mocked(fetchCodexRateLimits).mockResolvedValue(okProvider('codex', 24))
    const service = new RateLimitService()
    service.start({ fetchImmediately: false })

    await vi.advanceTimersByTimeAsync(POLL_MS * 2)

    expect(fetchClaudeRateLimits).not.toHaveBeenCalled()
    service.stop()
  })

  it('polls a headless host while a remote client is subscribed, and stops after it leaves', async () => {
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 12))
    vi.mocked(fetchCodexRateLimits).mockResolvedValue(okProvider('codex', 24))
    const service = new RateLimitService()
    service.start({ fetchImmediately: false })
    const unsubscribe = service.onStateChange(() => {})

    await vi.advanceTimersByTimeAsync(POLL_MS)
    const callsWhileSubscribed = vi.mocked(fetchClaudeRateLimits).mock.calls.length
    expect(callsWhileSubscribed).toBeGreaterThan(0)

    unsubscribe()
    await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    expect(fetchClaudeRateLimits).toHaveBeenCalledTimes(callsWhileSubscribed)
    service.stop()
  })

  it('keeps desktop focus gating when nobody is subscribed', async () => {
    vi.mocked(fetchClaudeRateLimits).mockResolvedValue(okProvider('claude', 12))
    vi.mocked(fetchCodexRateLimits).mockResolvedValue(okProvider('codex', 24))
    const service = new RateLimitService()
    const window = new FakeRateLimitWindow()
    window.focused = false
    service.attach(asRateLimitWindow(window))
    service.start({ fetchImmediately: false })

    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(fetchClaudeRateLimits).not.toHaveBeenCalled()
    service.stop()
  })
})
