import { useCallback, useEffect } from 'react'
import { useAppStore } from '../../store'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { RateLimitState } from '../../../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { getActiveRuntimeTarget } from '../../runtime/runtime-client-target'
import {
  refreshHostRateLimits,
  watchHostRateLimits,
  type HostRateLimitEvent
} from '../../runtime/host-rate-limit-watcher'
import { useHostRateLimitCache, type HostRateLimitEntry } from './host-rate-limit-cache'

export type EffectiveRateLimits = {
  rateLimits: RateLimitState
  source: 'local' | 'host'
  /** Name of the paired host the numbers come from; null for the local snapshot. */
  hostLabel: string | null
  refresh: () => Promise<void>
}

const EMPTY_RATE_LIMITS = createEmptyRateLimitState()

function applyEvent(environmentId: string, event: HostRateLimitEvent): void {
  const { byEnvironmentId, setEntry } = useHostRateLimitCache.getState()
  const previous: HostRateLimitEntry | undefined = byEnvironmentId[environmentId]
  if (event.type === 'state') {
    setEntry(environmentId, { state: event.state, status: 'ready' })
  } else if (event.type === 'unsupported') {
    setEntry(environmentId, { state: null, status: 'unsupported' })
  } else {
    // Why: a transient failure keeps the last good numbers instead of blanking the bar.
    setEntry(environmentId, { state: previous?.state ?? null, status: 'error' })
  }
}

/**
 * The status bar reads usage from whichever runtime owns the active workspace:
 * the paired host when one is active (same owner as the account switchers,
 * covering folder workspaces too since the host runs them), else this desktop.
 * SSH workspaces keep the desktop owner, matching claudeTarget/codexTarget.
 */
export function useEffectiveRateLimits(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined
): EffectiveRateLimits {
  const localRateLimits = useAppStore((s) => s.rateLimits)
  const refreshLocal = useAppStore((s) => s.refreshRateLimits)
  const environments = useAppStore((s) => s.runtimeEnvironments)
  const target = getActiveRuntimeTarget(settings)
  const environmentId = target.kind === 'environment' ? target.environmentId : null
  const entry = useHostRateLimitCache((s) =>
    environmentId ? s.byEnvironmentId[environmentId] : undefined
  )

  useEffect(() => {
    if (!environmentId) {
      return
    }
    return watchHostRateLimits(environmentId, (event) => applyEvent(environmentId, event))
  }, [environmentId])

  const refresh = useCallback(async () => {
    if (!environmentId) {
      await refreshLocal()
      return
    }
    applyEvent(environmentId, await refreshHostRateLimits(environmentId))
  }, [environmentId, refreshLocal])

  if (!environmentId || entry?.status === 'unsupported') {
    return { rateLimits: localRateLimits, source: 'local', hostLabel: null, refresh }
  }
  const hostLabel = environments.find((environment) => environment.id === environmentId)?.name
  return {
    // Why: until the host answers, show nothing rather than the desktop's numbers under a host label.
    rateLimits: entry?.state ?? EMPTY_RATE_LIMITS,
    source: 'host',
    hostLabel: hostLabel ?? null,
    refresh
  }
}
