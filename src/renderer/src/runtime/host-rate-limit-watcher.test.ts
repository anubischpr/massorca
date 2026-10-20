import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyRateLimitState } from '../../../shared/rate-limit-state-factory'
import type { ProviderRateLimits } from '../../../shared/rate-limit-types'
import type { RuntimeRpcFailure } from '../../../shared/runtime-rpc-envelope'

const mocks = vi.hoisted(() => ({
  watchProviderAccounts: vi.fn(),
  callRuntimeRpc: vi.fn()
}))

vi.mock('./runtime-provider-accounts-client', () => ({
  watchProviderAccounts: mocks.watchProviderAccounts
}))
vi.mock('./runtime-rpc-client', async () => {
  const result = await import('./runtime-rpc-result')
  return { callRuntimeRpc: mocks.callRuntimeRpc, RuntimeRpcCallError: result.RuntimeRpcCallError }
})

import { RuntimeRpcCallError } from './runtime-rpc-result'
import {
  normalizeHostRateLimits,
  refreshHostRateLimits,
  watchHostRateLimits,
  type HostRateLimitEvent
} from './host-rate-limit-watcher'

type Handlers = { onSnapshot: (s: unknown) => void; onError: (e: unknown) => void }

function claudeOk(): ProviderRateLimits {
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: 1,
    error: null,
    status: 'ok'
  }
}

function methodNotFound(): RuntimeRpcCallError {
  const failure: RuntimeRpcFailure = {
    ok: false,
    id: 'x',
    error: { code: 'method_not_found', message: 'nope' },
    _meta: { runtimeId: 'r' }
  }
  return new RuntimeRpcCallError(failure)
}

let handlers: Handlers
const closeSubscription = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  mocks.callRuntimeRpc.mockReset()
  closeSubscription.mockReset()
  mocks.watchProviderAccounts.mockReset()
  mocks.watchProviderAccounts.mockImplementation((_settings: unknown, h: Handlers) => {
    handlers = h
    return { close: closeSubscription }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('watchHostRateLimits', () => {
  it('publishes the host snapshot from the subscription', () => {
    const events: HostRateLimitEvent[] = []
    watchHostRateLimits('env-1', (e) => events.push(e))
    handlers.onSnapshot({ rateLimits: { ...createEmptyRateLimitState(), claude: claudeOk() } })

    expect(mocks.watchProviderAccounts).toHaveBeenCalledWith(
      { activeRuntimeEnvironmentId: 'env-1' },
      expect.anything()
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'state', state: { claude: { status: 'ok' } } })
  })

  it('fills provider keys an older host omits (no nan field) so they stay hidden', () => {
    const { nan: _nan, nanGatewayKeyConfigured: _flag, ...legacy } = createEmptyRateLimitState()
    const state = normalizeHostRateLimits(legacy)
    expect(state?.nan).toBeNull()
    expect(state?.nanGatewayKeyConfigured).toBe(false)
    expect(normalizeHostRateLimits(undefined)).toBeNull()
  })

  it('reports unsupported when the host snapshot carries no rate limits', () => {
    const events: HostRateLimitEvent[] = []
    watchHostRateLimits('env-1', (e) => events.push(e))
    handlers.onSnapshot({ rateLimits: null })
    expect(events).toEqual([{ type: 'unsupported' }])
  })

  it('polls accounts.list when the subscription fails', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({
      rateLimits: { ...createEmptyRateLimitState(), codex: claudeOk() }
    })
    const events: HostRateLimitEvent[] = []
    watchHostRateLimits('env-1', (e) => events.push(e))
    handlers.onError(new Error('stream closed'))
    await vi.advanceTimersByTimeAsync(0)

    expect(closeSubscription).toHaveBeenCalled()
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'accounts.list',
      {},
      expect.anything()
    )
    expect(events[0]?.type).toBe('state')
  })

  it('falls back to local (unsupported) when the host lacks the RPC', async () => {
    mocks.callRuntimeRpc.mockRejectedValue(methodNotFound())
    const events: HostRateLimitEvent[] = []
    watchHostRateLimits('env-1', (e) => events.push(e))
    handlers.onError(new Error('method_not_found'))
    await vi.advanceTimersByTimeAsync(0)

    expect(events).toEqual([{ type: 'unsupported' }])
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledTimes(1)
  })

  it('retries after a transient poll failure and stops after close', async () => {
    mocks.callRuntimeRpc.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({
      rateLimits: createEmptyRateLimitState()
    })
    const events: HostRateLimitEvent[] = []
    const close = watchHostRateLimits('env-1', (e) => events.push(e))
    handlers.onError(new Error('x'))
    await vi.advanceTimersByTimeAsync(0)
    expect(events.map((e) => e.type)).toEqual(['error'])
    await vi.advanceTimersByTimeAsync(30_000)
    expect(events.map((e) => e.type)).toEqual(['error', 'state'])

    close()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledTimes(2)
  })
})

describe('refreshHostRateLimits', () => {
  it('asks the host to refresh usage', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ rateLimits: createEmptyRateLimitState() })
    const event = await refreshHostRateLimits('env-1')
    expect(event.type).toBe('state')
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'accounts.list',
      { refreshUsage: true },
      expect.anything()
    )
  })
})
