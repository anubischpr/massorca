import type {
  GhAccountBindingInventory,
  GhAccountBindingValidationResult,
  GhActiveAccountSwitchResult
} from '../../shared/github/auth-types'
import type {
  GhAccountGitConfigResult,
  GhAccountGitConfigState
} from '../../shared/github/gh-account-git-config'
import type { RepoGhAccountInference } from '../../shared/github/gh-account-inference'

/** Why: the sign-in dialog reads only these; the token never leaves gh's credential store. */
export type GhSignInFailureReason = 'cancelled' | 'timeout' | 'unavailable' | 'failed'

export type GhSignInState =
  | { kind: 'code'; userCode: string; verificationUrl: string }
  | { kind: 'done'; user: string | null }
  | { kind: 'failed'; reason: GhSignInFailureReason }

export type GhSignInEvent = { signInId: string; state: GhSignInState }

export type GhSignInStartResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_host' | 'unsupported' }

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
  listHostBindableAccounts: (args?: { wslDistro?: string }) => Promise<GhAccountBindingInventory>
  switchActiveAccount: (args: {
    host: string
    user: string
    wslDistro?: string
  }) => Promise<GhActiveAccountSwitchResult>
  listAccountOrgs: (args: {
    accounts: { host: string; user: string }[]
    wslDistro?: string
  }) => Promise<Record<string, string[]>>
  inferRepoAccount: (args: { repoPath: string; repoId?: string }) => Promise<RepoGhAccountInference>
  /** Starts `gh auth login --web` on this computer; progress arrives on `onSignInEvent`. */
  startSignIn: (args: { signInId: string; host: string }) => Promise<GhSignInStartResult>
  cancelSignIn: (args: { signInId: string }) => Promise<void>
  onSignInEvent: (callback: (event: GhSignInEvent) => void) => () => void
}
