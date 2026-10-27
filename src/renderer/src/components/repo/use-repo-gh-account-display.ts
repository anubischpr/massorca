import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { readRepositoryGhAccountGitConfig } from '@/components/settings/repository-github-account'
import {
  ensureRepoGhAccountGitConfig,
  getRepoGhAccountGitConfigAccount,
  subscribeRepoGhAccountGitConfig,
  type RepoGhAccountGitConfigSlot
} from '@/lib/repo-gh-account-git-config-cache'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { useAppStore } from '@/store'
import {
  ghAccountBindingLabel,
  type GhAccountBinding
} from '../../../../shared/github/account-binding'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'

export type RepoGhAccountDisplay = {
  /** Login to show, or null when neither gh.account nor an Orca binding is set. */
  label: string | null
  source: 'git-config' | 'orca-binding' | null
  /** gh.account and the Orca binding both exist and name different logins. */
  mismatch: boolean
}

/** gh.account wins over the Orca binding; logins compare exactly, as gh does. */
export function deriveRepoGhAccountDisplay(
  binding: GhAccountBinding | null | undefined,
  gitConfigAccount: string | null | undefined
): RepoGhAccountDisplay {
  if (gitConfigAccount) {
    return {
      label: gitConfigAccount,
      source: 'git-config',
      mismatch: binding !== null && binding !== undefined && gitConfigAccount !== binding.user
    }
  }
  if (binding) {
    return { label: ghAccountBindingLabel(binding), source: 'orca-binding', mismatch: false }
  }
  return { label: null, source: null, mismatch: false }
}

type RuntimeTarget = ReturnType<typeof getActiveRuntimeTarget>

async function readGitConfigAccount(
  runtimeTarget: RuntimeTarget,
  repo: Pick<Repo, 'id' | 'path'>
): Promise<string | null | undefined> {
  const reading = await readRepositoryGhAccountGitConfig(runtimeTarget, repo)
  // Why: no reading (folder, or host not connected) is unknown, not "unset", so a later mount retries.
  return reading ? reading.account : undefined
}

/**
 * The account to show for a repo: its git config `gh.account` on its execution host,
 * else the Orca binding. Never the globally active gh login.
 */
export function useRepoGhAccountDisplay(repo: Repo | null | undefined): RepoGhAccountDisplay {
  const settings = useAppStore((state) => state.settings)
  const connectionId = repo?.connectionId ?? null
  // Why: an SSH host that is not connected yet yields no reading; its status change re-triggers the read.
  const sshStatus = useAppStore((state) =>
    connectionId ? (state.sshConnectionStates.get(connectionId)?.status ?? null) : null
  )
  const runtimeEnvironmentId =
    repo && settings
      ? (getRepoOwnerRoutedSettings(settings, repo)?.activeRuntimeEnvironmentId ?? null)
      : null
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId: runtimeEnvironmentId }),
    [runtimeEnvironmentId]
  )
  const repoId = repo?.id ?? null
  const repoPath = repo?.path ?? null
  // Why: without settings the owner host is unknown, and folders have no git config; neither is read or cached.
  const readable = Boolean(repo && settings && !isFolderRepo(repo))
  const slotKey =
    readable && repoId !== null && repoPath !== null
      ? [
          runtimeTarget.kind === 'environment' ? `runtime:${runtimeTarget.environmentId}` : 'local',
          repoId,
          repoPath,
          repo?.executionHostId ?? '',
          connectionId ?? ''
        ].join('\0')
      : null
  const slot = useMemo<RepoGhAccountGitConfigSlot | null>(
    () => (slotKey !== null && repoId !== null ? { key: slotKey, repoId } : null),
    [slotKey, repoId]
  )
  const bindingSignature = repo?.ghAccount ? `${repo.ghAccount.host}\0${repo.ghAccount.user}` : null

  useEffect(() => {
    if (!slot || repoId === null || repoPath === null) {
      return
    }
    // Why: a new binding re-reads, since the settings picker writes the binding and gh.account together.
    ensureRepoGhAccountGitConfig(slot, bindingSignature, () =>
      readGitConfigAccount(runtimeTarget, { id: repoId, path: repoPath })
    )
  }, [slot, bindingSignature, repoId, repoPath, runtimeTarget, sshStatus])

  const subscribe = useCallback(
    (listener: () => void) => subscribeRepoGhAccountGitConfig(slot, listener),
    [slot]
  )
  const gitConfigAccount = useSyncExternalStore(subscribe, () =>
    getRepoGhAccountGitConfigAccount(slot)
  )
  return deriveRepoGhAccountDisplay(repo?.ghAccount, gitConfigAccount)
}
