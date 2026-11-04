/** One-click installs of Marketplace tools on this computer. Git is the first; the host is always `local`. */

/** The lowest Git the core workflow supports (see AGENTS.md, Git Binary Compatibility). */
export const GIT_MINIMUM_VERSION = '2.25.0'

/** Package managers MassOrca can install Git with. `xcode-clt` opens Apple's installer window. */
export type GitInstallManager = 'winget' | 'homebrew' | 'xcode-clt' | 'apt' | 'dnf'

/** Who owns an existing Git binary; `unknown` covers copied binaries and other installers. */
export type GitOwner = 'winget' | 'homebrew' | 'apt' | 'dnf' | 'unknown'

export type GitInstallElevation = 'none' | 'os-prompt' | 'sudo'

export type GitInstallStepView = {
  id: string
  label: string
  elevation: GitInstallElevation
}

/** What the Install button will do. `command` is shown for reading only; it is never run as a string. */
export type GitInstallPlanView = {
  manager: GitInstallManager | null
  command: string | null
  /** The exact command to run by hand on this computer, or null when none is known. */
  manualCommand: string | null
  steps: GitInstallStepView[]
}

export type GitInstallStatus =
  | { state: 'missing'; plan: GitInstallPlanView }
  | { state: 'installed'; version: string; path: string; installedBy: 'massorca' }
  | { state: 'outside'; version: string; path: string; owner: GitOwner; plan: GitInstallPlanView }
  | { state: 'broken'; path: string; owner: GitOwner; plan: GitInstallPlanView }
  | { state: 'too-old'; version: string; path: string; plan: GitInstallPlanView }
  | { state: 'unverifiable'; reason: 'probe-timeout' | 'probe-failed' | 'too-many-copies' }

export type GitInstallFailureReason =
  | 'busy'
  | 'unsupported'
  | 'needs-password'
  | 'step-failed'
  | 'installer-opened'
  | 'verify-failed'
  | 'too-old'

export type GitInstallRunResult =
  | { ok: true; status: GitInstallStatus }
  | {
      ok: false
      reason: GitInstallFailureReason
      manualCommand: string | null
      /** Re-detected after the run, so the board can show the real state without a second call. */
      status: GitInstallStatus
    }

/** IPC event the main process sends to the window that started an install. */
export const MARKETPLACE_GIT_PROGRESS_CHANNEL = 'marketplaceInstall:gitProgress'

export type GitInstallStepStatus = 'running' | 'done' | 'failed' | 'skipped'

/** One live update of an install step. `logLine` is already sanitised for display. */
export type GitInstallProgress = {
  stepId: string
  status: GitInstallStepStatus
  logLine?: string
}

export type MarketplaceInstallApi = {
  getGitStatus: () => Promise<GitInstallStatus>
  /** Installs Git with MassOrca; progress arrives on `onGitProgress` while it runs. */
  installGit: () => Promise<GitInstallRunResult>
  /** Takes over an install found outside MassOrca; reinstalls only when its owner is unknown. */
  adoptGit: () => Promise<GitInstallRunResult>
  onGitProgress: (callback: (event: GitInstallProgress) => void) => () => void
}
