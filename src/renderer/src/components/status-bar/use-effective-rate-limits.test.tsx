// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import type { ProviderRateLimits, RateLimitState } from '../../../../shared/rate-limit-types'
import type { HostRateLimitEvent } from '../../runtime/host-rate-limit-watcher'
import { useAppStore } from '../../store'
import { useHostRateLimitCache } from './host-rate-limit-cache'

const mocks = vi.hoisted(() => ({
  watchHostRateLimits: vi.fn(),
  refreshHostRateLimits: vi.fn(),
  getRuntimeEnvironmentIdForWorktree: vi.fn()
}))

vi.mock('../../lib/worktree-runtime-owner', () => ({
  getRuntimeEnvironmentIdForWorktree: mocks.getRuntimeEnvironmentIdForWorktree
}))

vi.mock('../../runtime/host-rate-limit-watcher', () => ({
  watchHostRateLimits: mocks.watchHostRateLimits,
  refreshHostRateLimits: mocks.refreshHostRateLimits
}))

import { useEffectiveRateLimits } from './use-effective-rate-limits'

const initialState = useAppStore.getState()

function provider(id: 'claude' | 'nan', usedPercent: number): ProviderRateLimits {
  return {
    provider: id,
    session: { usedPercent, windowMinutes: 300, resetsAt: null, resetDescription: null },
    weekly: null,
    updatedAt: 1,
    error: null,
    status: 'ok'
  }
}

const local: RateLimitState = createEmptyRateLimitState({ claude: provider('claude', 11) })
const host: RateLimitState = createEmptyRateLimitState({
  claude: provider('claude', 77),
  nan: provider('nan', 5)
})
let emit: (event: HostRateLimitEvent) => void = () => {}
const stopWatch = vi.fn()

beforeEach(() => {
  mocks.watchHostRateLimits.mockReset()
  mocks.refreshHostRateLimits.mockReset()
  mocks.getRuntimeEnvironmentIdForWorktree.mockReset()
  stopWatch.mockReset()
  mocks.watchHostRateLimits.mockImplementation(
    (_id: string, onEvent: (e: HostRateLimitEvent) => void) => {
      emit = onEvent
      return stopWatch
    }
  )
  useHostRateLimitCache.setState({ byEnvironmentId: {} })
  useAppStore.setState({
    rateLimits: local,
    runtimeEnvironments: [
      {
        id: 'env-1',
        name: 'pv-vps',
        createdAt: 0,
        updatedAt: 0,
        lastUsedAt: null,
        runtimeId: null,
        endpoints: [],
        preferredEndpointId: 'endpoint-1'
      }
    ]
  })
})

afterEach(() => {
  useAppStore.setState(initialState, true)
})

describe('useEffectiveRateLimits', () => {
  it('follows the active workspace owner even when the global active environment is unset', () => {
    useAppStore.setState({ activeWorktreeId: 'wt-1' })
    mocks.getRuntimeEnvironmentIdForWorktree.mockReturnValue('env-1')
    const { result } = renderHook(() =>
      useEffectiveRateLimits({ activeRuntimeEnvironmentId: null })
    )
    expect(mocks.watchHostRateLimits).toHaveBeenCalledWith('env-1', expect.any(Function))
    act(() => emit({ type: 'state', state: host }))
    expect(result.current.source).toBe('host')
    expect(result.current.rateLimits.nan?.provider).toBe('nan')
  })

  it('uses the local snapshot without watching a host for local workspaces', () => {
    const { result } = renderHook(() =>
      useEffectiveRateLimits({ activeRuntimeEnvironmentId: null })
    )
    expect(result.current.source).toBe('local')
    expect(result.current.rateLimits.claude?.session?.usedPercent).toBe(11)
    expect(mocks.watchHostRateLimits).not.toHaveBeenCalled()
  })

  it('shows the host snapshot, including nan, for a remote environment', () => {
    const { result } = renderHook(() =>
      useEffectiveRateLimits({ activeRuntimeEnvironmentId: 'env-1' })
    )
    expect(result.current.source).toBe('host')
    // Loading: nothing is shown instead of the desktop numbers.
    expect(result.current.rateLimits.claude).toBeNull()
    act(() => emit({ type: 'state', state: host }))
    expect(result.current.rateLimits.claude?.session?.usedPercent).toBe(77)
    expect(result.current.rateLimits.nan?.provider).toBe('nan')
    expect(result.current.hostLabel).toBe('pv-vps')
  })

  it('falls back to the local snapshot when the host is an old build', () => {
    const { result } = renderHook(() =>
      useEffectiveRateLimits({ activeRuntimeEnvironmentId: 'env-1' })
    )
    act(() => emit({ type: 'unsupported' }))
    expect(result.current.source).toBe('local')
    expect(result.current.hostLabel).toBeNull()
    expect(result.current.rateLimits.claude?.session?.usedPercent).toBe(11)
  })

  it('keeps the last host numbers on a transient error and caches per environment', () => {
    const initialProps: { id: string | null } = { id: 'env-1' }
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useEffectiveRateLimits({ activeRuntimeEnvironmentId: id }),
      { initialProps }
    )
    act(() => emit({ type: 'state', state: host }))
    act(() => emit({ type: 'error', error: new Error('offline') }))
    expect(result.current.rateLimits.claude?.session?.usedPercent).toBe(77)

    rerender({ id: null })
    expect(result.current.source).toBe('local')
    expect(stopWatch).toHaveBeenCalled()
    rerender({ id: 'env-1' })
    // Instant: cached host numbers are shown before the new watcher answers.
    expect(result.current.rateLimits.claude?.session?.usedPercent).toBe(77)
  })

  it('refreshes through the host RPC for remote and the local service otherwise', async () => {
    const refreshLocal = vi.fn().mockResolvedValue(undefined)
    useAppStore.setState({ refreshRateLimits: refreshLocal })
    mocks.refreshHostRateLimits.mockResolvedValue({ type: 'state', state: host })
    const remote = renderHook(() => useEffectiveRateLimits({ activeRuntimeEnvironmentId: 'env-1' }))
    await act(async () => remote.result.current.refresh())
    expect(mocks.refreshHostRateLimits).toHaveBeenCalledWith('env-1')
    expect(refreshLocal).not.toHaveBeenCalled()

    const localHook = renderHook(() => useEffectiveRateLimits({ activeRuntimeEnvironmentId: null }))
    await act(async () => localHook.result.current.refresh())
    expect(refreshLocal).toHaveBeenCalledTimes(1)
  })
})
