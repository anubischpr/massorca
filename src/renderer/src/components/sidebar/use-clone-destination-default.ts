import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { browseRuntimeServerDirectory } from '@/runtime/runtime-server-directory-browser'
import { getHostSettingOverride } from '../../../../shared/host-setting-overrides'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { getRemoteCloneParent } from './clone-defaults'

const HOME_LOOKUP_TIMEOUT_MS = 5000

async function resolveRemoteHome(
  runtimeEnvironmentId: string | null,
  sshTargetId: string | null
): Promise<string> {
  const lookup = runtimeEnvironmentId
    ? browseRuntimeServerDirectory(runtimeEnvironmentId, '~')
    : window.api.ssh.browseDir({ targetId: sshTargetId ?? '', dirPath: '~' })
  return Promise.race([
    lookup.then((result) => result.resolvedPath),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out')), HOME_LOOKUP_TIMEOUT_MS)
    )
  ])
}

/**
 * Prefills the clone parent on SSH/runtime hosts, resolved on that host: its configured
 * default location, else `<remote home>/projects`. Never replaces a value the user typed.
 */
export function useCloneDestinationDefault({
  step,
  runtimeEnvironmentId,
  sshTargetId,
  cloneDestination,
  setCloneDestination
}: {
  step: string
  runtimeEnvironmentId: string | null | undefined
  sshTargetId: string | null | undefined
  cloneDestination: string
  setCloneDestination: (value: string) => void
}): void {
  const settings = useAppStore((s) => s.settings)
  const autoFilledRef = useRef<{ hostKey: string; value: string } | null>(null)
  const runtimeId = runtimeEnvironmentId?.trim() || null
  const sshId = sshTargetId?.trim() || null
  // Why: these keys are exactly the execution host ids host-scoped settings are stored under.
  const hostKey: ExecutionHostId | null = runtimeId
    ? `runtime:${runtimeId}`
    : sshId
      ? `ssh:${sshId}`
      : null
  const override = hostKey
    ? getHostSettingOverride(settings, hostKey, 'defaultWorktreeLocation')
    : undefined

  useEffect(() => {
    const previous = autoFilledRef.current
    if (step !== 'clone' || !hostKey) {
      // Why: re-entering the clone step re-resolves, but still only over our own fill.
      autoFilledRef.current = previous ? { hostKey: '', value: previous.value } : null
      return
    }
    const current = cloneDestination.trim()
    // Why: fill once per host, and never over a value the user typed.
    if (previous?.hostKey === hostKey || (current && previous?.value !== current)) {
      return
    }
    let cancelled = false
    const fill = (value: string): void => {
      if (cancelled || !value) {
        return
      }
      autoFilledRef.current = { hostKey, value }
      setCloneDestination(value)
    }
    if (override) {
      fill(getRemoteCloneParent({ configuredLocation: override }))
    } else {
      if (current) {
        setCloneDestination('')
      }
      resolveRemoteHome(runtimeId, sshId)
        .then((home) => fill(getRemoteCloneParent({ home })))
        .catch(() => {
          // Leave the field empty; the user can still type or browse a host path.
        })
    }
    return () => {
      cancelled = true
    }
  }, [cloneDestination, hostKey, override, runtimeId, setCloneDestination, sshId, step])
}
