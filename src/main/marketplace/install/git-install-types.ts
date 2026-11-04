import type { LocalCommandProbe } from '../../ipc/preflight-command-exec'
import type {
  GitInstallElevation,
  GitInstallManager,
  GitInstallProgress
} from '../../../shared/marketplace-install'

/** One argv command of an install. `argv[0]` is the program; no shell string ever exists. */
export type InstallStep = {
  id: string
  label: string
  argv: readonly string[]
  elevation: GitInstallElevation
  /** What a failure of this step means to the person. */
  failure: 'needs-password' | 'step-failed'
}

export type InternalPlan = {
  manager: GitInstallManager | null
  command: string | null
  manualCommand: string | null
  steps: InstallStep[]
}

export type StepRunResult = { code: number | null; timedOut: boolean }

export type QueryResult = { code: number | null; stdout: string }

export type InstallRecord = { manager: GitInstallManager; recordedAt: string }

/** Small state file under ~/.orca/marketplace: what MassOrca installed, and what it offered to install. */
export type InstallsRecord = {
  version: 1
  tools: { git?: InstallRecord }
  pending: { git?: InstallRecord }
}

export type GitInstallStore = {
  read: () => InstallsRecord
  write: (record: InstallsRecord) => void
}

export type ProgressSink = (progress: GitInstallProgress) => void

/** Everything the install service touches on the machine; tests replace it wholesale. */
export type GitInstallEnv = {
  platform: NodeJS.Platform
  isRoot: boolean
  readOsRelease: () => string | null
  findCommand: (command: string) => Promise<LocalCommandProbe>
  commandOnPath: (command: string) => Promise<boolean>
  readVersion: (binary: string) => Promise<string>
  runQuery: (program: string, args: readonly string[]) => Promise<QueryResult>
  runStep: (step: InstallStep, onLine: (line: string) => void) => Promise<StepRunResult>
  store: GitInstallStore
  now: () => Date
}
