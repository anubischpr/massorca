import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import { worktreeRefreshOptions } from './add-repo-runtime-owner'
import { upsertAddedRepoWithProjectHostSetup } from './add-repo-store-upsert'

/** Add-time host of a folder project; both fields empty means this machine. */
export type FolderProjectHost = {
  sshConnectionId?: string | null
  runtimeEnvironmentId?: string | null
}

export function folderProjectHostOf(repo: Repo): FolderProjectHost {
  const host = parseExecutionHostId(getRepoExecutionHostId(repo))
  return {
    sshConnectionId: host?.kind === 'ssh' ? host.targetId : null,
    runtimeEnvironmentId: host?.kind === 'runtime' ? host.environmentId : null
  }
}

/** Swaps the folder project for the Git repo that repo.initGit returned, then refreshes its worktrees. */
export async function adoptInitializedGitRepo(
  initialized: Repo,
  host: FolderProjectHost
): Promise<void> {
  const sshConnectionId = host.sshConnectionId || null
  const runtimeEnvironmentId = host.runtimeEnvironmentId || null
  // Why: the initialized repo keeps its add-time host, so it replaces the project in place.
  upsertAddedRepoWithProjectHostSetup(
    initialized,
    sshConnectionId ? { sshConnectionId } : { runtimeEnvironmentId }
  )
  await useAppStore
    .getState()
    .fetchWorktrees(initialized.id, worktreeRefreshOptions(runtimeEnvironmentId, sshConnectionId))
}

/** The folder project stays added when Initialize Git fails; only the Git upgrade is reported. */
export function toastGitInitFailure(description: string): void {
  toast.error(
    translate('auto.components.sidebar.NonGitFolderDialog.85523ab0d3', 'Failed to initialize Git'),
    { description }
  )
}
