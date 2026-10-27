import { getComposerEligibleRepos } from '@/lib/new-workspace-composer-repo'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { CreateChatRepoOption } from './create-chat-selection'

/** The projects the create-chat composer can start a chat in, read from the repo list. */
export function createChatRepoOptions(repos: readonly Repo[]): CreateChatRepoOption[] {
  return getComposerEligibleRepos(repos).map((repo) => ({
    repoId: repo.id,
    displayName: repo.displayName,
    path: repo.path,
    hostId: getRepoExecutionHostId(repo),
    isFolder: isFolderRepo(repo)
  }))
}
