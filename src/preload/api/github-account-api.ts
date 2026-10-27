import type {
  GhAccountBindingInventory,
  GhAccountBindingValidationResult
} from '../../shared/github/auth-types'
import type {
  GhAccountGitConfigResult,
  GhAccountGitConfigState
} from '../../shared/github/gh-account-git-config'

export type GithubAccountApi = {
  listBindableAccounts: (args: {
    repoPath: string
    repoId?: string
    refreshCapability?: boolean
  }) => Promise<GhAccountBindingInventory>
  validateAccountBinding: (args: {
    repoPath: string
    repoId?: string
    host: string
    user: string
  }) => Promise<GhAccountBindingValidationResult>
  applyAccountGitConfig: (args: {
    repoPath: string
    repoId?: string
    next: { host: string; user: string } | null
    previous: { host: string; user: string } | null
    setIdentity: boolean
  }) => Promise<GhAccountGitConfigResult>
  readAccountGitConfig: (args: {
    repoPath: string
    repoId?: string
  }) => Promise<GhAccountGitConfigState | null>
}
