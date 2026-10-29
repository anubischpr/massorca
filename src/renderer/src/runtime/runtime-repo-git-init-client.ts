import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { ExecutionHostId } from '../../../shared/execution-host'
import { REPO_INIT_GIT_RUNTIME_CAPABILITY } from '../../../shared/protocol-version'
import type { RepoInitGitResult } from '../../../shared/rpc-contract/repo-init-git-params'
import { runtimeTargetForRepoHost } from './runtime-client-target'
import { callRuntimeRpc, runtimeEnvironmentSupportsCapability } from './runtime-rpc-client'

type RuntimeSettings = Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined

/**
 * Whether the host that owns this repo can initialize Git in a folder project. This machine's own
 * runtime (local and SSH repos) always can; a paired host must advertise the capability, and an
 * unreachable or older host reads as unsupported so the action is hidden instead of failing.
 */
export async function runtimeRepoSupportsGitInit(
  settings: RuntimeSettings,
  hostId?: ExecutionHostId
): Promise<boolean> {
  const target = runtimeTargetForRepoHost(settings, hostId)
  if (target.kind !== 'environment') {
    return true
  }
  try {
    return await runtimeEnvironmentSupportsCapability(
      target.environmentId,
      REPO_INIT_GIT_RUNTIME_CAPABILITY
    )
  } catch {
    return false
  }
}

/** Runs `git init` + an empty first commit on the repo's host. Resolves with a typed refusal. */
export function initializeRuntimeRepoGit(
  settings: RuntimeSettings,
  repoId: string,
  hostId?: ExecutionHostId
): Promise<RepoInitGitResult> {
  return callRuntimeRpc<RepoInitGitResult>(
    runtimeTargetForRepoHost(settings, hostId),
    'repo.initGit',
    { repo: repoId },
    { timeoutMs: 60_000 }
  )
}
