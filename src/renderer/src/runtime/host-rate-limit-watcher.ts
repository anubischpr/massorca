import type { RateLimitState } from '../../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../../shared/rate-limit-state-factory'
import { callRuntimeRpc, RuntimeRpcCallError } from './runtime-rpc-client'
import { watchProviderAccounts } from './runtime-provider-accounts-client'

export type HostRateLimitEvent =
  | { type: 'state'; state: RateLimitState }
  // Why: the host predates the accounts RPC or its rateLimits payload; callers fall back to the local snapshot.
  | { type: 'unsupported' }
  | { type: 'error'; error: Error }

// Mirrors the host RateLimitService DEFAULT_POLL_MS: the host only recomputes this often, so polling faster adds nothing.
const HOST_RATE_LIMIT_POLL_MS = 15 * 60 * 1000
const HOST_RATE_LIMIT_RETRY_MS = 30_000
const HOST_RATE_LIMIT_CALL_TIMEOUT_MS = 20_000
const HOST_RATE_LIMIT_REFRESH_TIMEOUT_MS = 60_000

// Why: an older host omits newer provider keys (e.g. nan); the empty shape keeps them null so they stay hidden.
export function normalizeHostRateLimits(raw: unknown): RateLimitState | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  return { ...createEmptyRateLimitState(), ...raw }
}

function isMethodMissing(error: unknown): boolean {
  return error instanceof RuntimeRpcCallError && error.code === 'method_not_found'
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

async function fetchHostSnapshot(
  environmentId: string,
  refreshUsage: boolean
): Promise<HostRateLimitEvent> {
  try {
    const snapshot = await callRuntimeRpc<{ rateLimits?: unknown }>(
      { kind: 'environment', environmentId },
      'accounts.list',
      refreshUsage ? { refreshUsage: true } : {},
      {
        timeoutMs: refreshUsage
          ? HOST_RATE_LIMIT_REFRESH_TIMEOUT_MS
          : HOST_RATE_LIMIT_CALL_TIMEOUT_MS
      }
    )
    const state = normalizeHostRateLimits(snapshot?.rateLimits)
    return state ? { type: 'state', state } : { type: 'unsupported' }
  } catch (error) {
    return isMethodMissing(error)
      ? { type: 'unsupported' }
      : { type: 'error', error: toError(error) }
  }
}

/** Asks the host to recompute usage (falls back to its cached snapshot on hosts that ignore the flag). */
export function refreshHostRateLimits(environmentId: string): Promise<HostRateLimitEvent> {
  return fetchHostSnapshot(environmentId, true)
}

/**
 * Follows the usage snapshot computed by a paired host: accounts.subscribe when
 * the host has it, otherwise accounts.list polling. Returns a closer.
 */
export function watchHostRateLimits(
  environmentId: string,
  onEvent: (event: HostRateLimitEvent) => void
): () => void {
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let subscription: { close: () => void } | null = null
  let polling = false

  const emit = (event: HostRateLimitEvent): void => {
    if (!closed) {
      onEvent(event)
    }
  }

  const poll = async (): Promise<void> => {
    const event = await fetchHostSnapshot(environmentId, false)
    if (closed) {
      return
    }
    emit(event)
    if (event.type === 'unsupported') {
      return
    }
    timer = setTimeout(
      () => void poll(),
      event.type === 'error' ? HOST_RATE_LIMIT_RETRY_MS : HOST_RATE_LIMIT_POLL_MS
    )
  }

  subscription = watchProviderAccounts(
    { activeRuntimeEnvironmentId: environmentId },
    {
      onSnapshot: (snapshot) => {
        const state = normalizeHostRateLimits(snapshot.rateLimits)
        emit(state ? { type: 'state', state } : { type: 'unsupported' })
      },
      onError: () => {
        // Why: a missing/failed stream must not leave the bar blank; polling also recovers after reconnects.
        subscription?.close()
        subscription = null
        if (!closed && !polling) {
          polling = true
          void poll()
        }
      }
    }
  )

  return () => {
    closed = true
    if (timer !== null) {
      clearTimeout(timer)
    }
    subscription?.close()
  }
}
