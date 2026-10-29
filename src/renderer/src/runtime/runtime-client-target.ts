import type { GlobalSettings } from '../../../shared/global-settings-types'
import { parseExecutionHostId, type ExecutionHostId } from '../../../shared/execution-host'

export type RuntimeClientTarget = { kind: 'local' } | { kind: 'environment'; environmentId: string }

export function getActiveRuntimeTarget(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined
): RuntimeClientTarget {
  const environmentId = settings?.activeRuntimeEnvironmentId?.trim()
  return environmentId ? { kind: 'environment', environmentId } : { kind: 'local' }
}

/** RPC target for a dispatchable host; direct SSH cannot use this client path. */
export function runtimeTargetForExecutionHostId(
  hostId: ExecutionHostId
): RuntimeClientTarget | null {
  const parsed = parseExecutionHostId(hostId)
  if (parsed?.kind === 'local') {
    return { kind: 'local' }
  }
  if (parsed?.kind === 'runtime') {
    return { kind: 'environment', environmentId: parsed.environmentId }
  }
  return null
}

export function settingsForRuntimeOwner(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined,
  runtimeEnvironmentId: string | null | undefined
): Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined {
  if (runtimeEnvironmentId === null) {
    return { activeRuntimeEnvironmentId: null }
  }
  const ownerId = runtimeEnvironmentId?.trim()
  return ownerId ? { activeRuntimeEnvironmentId: ownerId } : settings
}

/** Owner of a repo-scoped call: a runtime host named by `hostId`, else the active environment. */
export function runtimeTargetForRepoHost(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined,
  hostId?: ExecutionHostId
): RuntimeClientTarget {
  const parsed = parseExecutionHostId(hostId)
  if (parsed?.kind === 'runtime') {
    return { kind: 'environment', environmentId: parsed.environmentId }
  }
  // Local and SSH repos are both served by this machine's runtime; the SSH leg runs in main.
  return parsed ? { kind: 'local' } : getActiveRuntimeTarget(settings)
}
