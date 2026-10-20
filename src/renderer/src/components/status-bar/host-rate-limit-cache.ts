import { create } from 'zustand'
import type { RateLimitState } from '../../../../shared/rate-limit-types'

export type HostRateLimitEntry = {
  state: RateLimitState | null
  // Why: 'unsupported' marks hosts without the accounts RPC so the bar falls back to the local snapshot.
  status: 'loading' | 'ready' | 'unsupported' | 'error'
}

// Why: kept per environment so switching hosts shows the last known numbers instantly.
export const useHostRateLimitCache = create<{
  byEnvironmentId: Record<string, HostRateLimitEntry>
  setEntry: (environmentId: string, entry: HostRateLimitEntry) => void
}>((set) => ({
  byEnvironmentId: {},
  setEntry: (environmentId, entry) =>
    set((current) => ({
      byEnvironmentId: { ...current.byEnvironmentId, [environmentId]: entry }
    }))
}))
