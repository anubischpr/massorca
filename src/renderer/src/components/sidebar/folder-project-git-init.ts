import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import { upsertAddedRepoWithProjectHostSetup } from './add-repo-store-upsert'

/** Swaps the folder project for the Git repo that repo.initGit returned, then refreshes its worktrees. */
export async function adoptInitializedGitRepo(
  initialized: Repo,
  executionHostId: ExecutionHostId | undefined
): Promise<void> {
  upsertAddedRepoWithProjectHostSetup(
    executionHostId ? { ...initialized, executionHostId } : initialized
  )
  await useAppStore.getState().fetchWorktrees(initialized.id, {
    requireAuthoritative: true,
    ...(executionHostId ? { executionHostId } : {})
  })
}

/** The folder project stays added when Initialize Git fails; only the Git upgrade is reported. */
export function toastGitInitFailure(description: string): void {
  toast.error(
    translate('auto.components.sidebar.NonGitFolderDialog.85523ab0d3', 'Failed to initialize Git'),
    { description }
  )
}
