import type {
  GitInstallFailureReason,
  GitInstallPlanView,
  GitInstallProgress,
  GitInstallRunResult,
  GitInstallStatus,
  GitInstallStepStatus,
  GitInstallStepView,
  GitOwner
} from '../../../../shared/marketplace-install'

const MAX_LOG_LINES = 200

export type GitInstallStepRow = GitInstallStepView & { status: 'pending' | GitInstallStepStatus }

export type GitInstallRun =
  | { phase: 'idle' }
  | { phase: 'running'; steps: GitInstallStepRow[]; log: string[] }
  | {
      phase: 'failed'
      reason: GitInstallFailureReason
      manualCommand: string | null
      status: GitInstallStatus | null
    }

export type GitInstallState = {
  /** Null while loading, or when the check itself could not run. */
  status: GitInstallStatus | null
  statusFailed: boolean
  run: GitInstallRun
}

export const initialGitInstallState: GitInstallState = {
  status: null,
  statusFailed: false,
  run: { phase: 'idle' }
}

export type GitInstallAction =
  | { type: 'status-loaded'; status: GitInstallStatus }
  | { type: 'status-failed' }
  | { type: 'run-started'; plan: GitInstallPlanView | null }
  | { type: 'progress'; progress: GitInstallProgress }
  | { type: 'run-finished'; result: GitInstallRunResult }
  | { type: 'run-crashed' }

function planOf(status: GitInstallStatus | null): GitInstallPlanView | null {
  if (status === null || status.state === 'installed' || status.state === 'unverifiable') {
    return null
  }
  return status.plan
}

/** The plan a run is about to execute, read from the last status the screen holds. */
export function planForRun(state: GitInstallState): GitInstallPlanView | null {
  return planOf(state.status)
}

export function gitInstallReducer(
  state: GitInstallState,
  action: GitInstallAction
): GitInstallState {
  switch (action.type) {
    case 'status-loaded':
      return { ...state, status: action.status, statusFailed: false }
    case 'status-failed':
      return { ...state, statusFailed: true }
    case 'run-started':
      return {
        ...state,
        run: {
          phase: 'running',
          steps: (action.plan?.steps ?? []).map((step) => ({ ...step, status: 'pending' })),
          log: []
        }
      }
    case 'progress':
      return state.run.phase === 'running'
        ? { ...state, run: applyProgress(state.run, action.progress) }
        : state
    case 'run-finished':
      if (action.result.ok) {
        return { ...state, status: action.result.status, run: { phase: 'idle' } }
      }
      return {
        ...state,
        status: action.result.status,
        run: {
          phase: 'failed',
          reason: action.result.reason,
          manualCommand: action.result.manualCommand,
          status: action.result.status
        }
      }
    case 'run-crashed':
      return {
        ...state,
        run: {
          phase: 'failed',
          reason: 'step-failed',
          manualCommand: manualOf(state),
          status: state.status
        }
      }
  }
}

function manualOf(state: GitInstallState): string | null {
  const plan = planOf(state.status)
  return plan?.manualCommand ?? null
}

function applyProgress(
  run: Extract<GitInstallRun, { phase: 'running' }>,
  progress: GitInstallProgress
): GitInstallRun {
  const known = run.steps.some((step) => step.id === progress.stepId)
  const steps: GitInstallStepRow[] = known
    ? run.steps.map((step) =>
        step.id === progress.stepId ? { ...step, status: progress.status } : step
      )
    : [
        ...run.steps,
        { id: progress.stepId, label: progress.stepId, elevation: 'none', status: progress.status }
      ]
  const log =
    progress.logLine === undefined ? run.log : [...run.log, progress.logLine].slice(-MAX_LOG_LINES)
  return { phase: 'running', steps, log }
}

export type GitInstallView =
  | { kind: 'checking' }
  | { kind: 'unavailable' }
  | { kind: 'before'; plan: GitInstallPlanView }
  | { kind: 'installing'; steps: GitInstallStepRow[]; log: string[] }
  | { kind: 'installed'; version: string; path: string }
  | { kind: 'outside'; version: string; path: string; owner: GitOwner; plan: GitInstallPlanView }
  | { kind: 'broken'; path: string; owner: GitOwner; plan: GitInstallPlanView }
  | { kind: 'too-old'; version: string; path: string; plan: GitInstallPlanView }
  | { kind: 'unverifiable' }
  | { kind: 'failed'; reason: GitInstallFailureReason; manualCommand: string | null }

/** Which board the screen shows. A failed run still shows Installed when the re-check finds Git. */
export function deriveGitInstallView(state: GitInstallState): GitInstallView {
  const { run, status } = state
  if (run.phase === 'running') {
    return { kind: 'installing', steps: run.steps, log: run.log }
  }
  if (run.phase === 'failed' && run.status?.state !== 'installed') {
    return { kind: 'failed', reason: run.reason, manualCommand: run.manualCommand }
  }
  if (status === null) {
    return state.statusFailed ? { kind: 'unavailable' } : { kind: 'checking' }
  }
  switch (status.state) {
    case 'missing':
      return { kind: 'before', plan: status.plan }
    case 'installed':
      return { kind: 'installed', version: status.version, path: status.path }
    case 'outside':
      return {
        kind: 'outside',
        version: status.version,
        path: status.path,
        owner: status.owner,
        plan: status.plan
      }
    case 'broken':
      return { kind: 'broken', path: status.path, owner: status.owner, plan: status.plan }
    case 'too-old':
      return { kind: 'too-old', version: status.version, path: status.path, plan: status.plan }
    case 'unverifiable':
      return { kind: 'unverifiable' }
  }
}
