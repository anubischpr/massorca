import { describe, expect, it } from 'vitest'
import type { GitInstallPlanView, GitInstallStatus } from '../../../../shared/marketplace-install'
import {
  deriveGitInstallView,
  gitInstallReducer,
  initialGitInstallState,
  planForRun,
  type GitInstallState
} from './GitInstallState'

const plan: GitInstallPlanView = {
  manager: 'homebrew',
  command: 'brew install git',
  manualCommand: 'brew install git',
  steps: [
    { id: 'install', label: 'Install Git with Homebrew', elevation: 'none' },
    { id: 'verify', label: 'Check that Git works', elevation: 'none' }
  ]
}

const missing: GitInstallStatus = { state: 'missing', plan }
const installed: GitInstallStatus = {
  state: 'installed',
  version: '2.45.0',
  path: '/opt/homebrew/bin/git',
  installedBy: 'massorca'
}

function loaded(status: GitInstallStatus): GitInstallState {
  return gitInstallReducer(initialGitInstallState, { type: 'status-loaded', status })
}

describe('git install view', () => {
  it('shows checking until a status arrives, then the matching board', () => {
    expect(deriveGitInstallView(initialGitInstallState)).toEqual({ kind: 'checking' })
    expect(deriveGitInstallView(loaded(missing))).toEqual({ kind: 'before', plan })
    expect(deriveGitInstallView(loaded(installed))).toEqual({
      kind: 'installed',
      version: '2.45.0',
      path: '/opt/homebrew/bin/git'
    })
  })

  it('shows unavailable when the check itself failed', () => {
    const state = gitInstallReducer(initialGitInstallState, { type: 'status-failed' })
    expect(deriveGitInstallView(state)).toEqual({ kind: 'unavailable' })
  })

  it('streams progress into the installing board with the plan steps', () => {
    let state = gitInstallReducer(loaded(missing), { type: 'run-started', plan })
    state = gitInstallReducer(state, {
      type: 'progress',
      progress: { stepId: 'install', status: 'running', logLine: 'Pouring bottle' }
    })
    state = gitInstallReducer(state, {
      type: 'progress',
      progress: { stepId: 'install', status: 'done' }
    })
    const view = deriveGitInstallView(state)
    expect(view).toMatchObject({ kind: 'installing', log: ['Pouring bottle'] })
    if (view.kind === 'installing') {
      expect(view.steps.map((step) => [step.id, step.status])).toEqual([
        ['install', 'done'],
        ['verify', 'pending']
      ])
    }
  })

  it('shows the failed board with its reason and manual command after a failed run', () => {
    let state = gitInstallReducer(loaded(missing), { type: 'run-started', plan })
    state = gitInstallReducer(state, {
      type: 'run-finished',
      result: {
        ok: false,
        reason: 'verify-failed',
        manualCommand: 'brew install git',
        status: missing
      }
    })
    expect(deriveGitInstallView(state)).toEqual({
      kind: 'failed',
      reason: 'verify-failed',
      manualCommand: 'brew install git'
    })
  })

  it('shows Installed when the re-check after a failed run finds Git', () => {
    let state = gitInstallReducer(loaded(missing), { type: 'run-started', plan })
    state = gitInstallReducer(state, {
      type: 'run-finished',
      result: { ok: false, reason: 'installer-opened', manualCommand: null, status: installed }
    })
    expect(deriveGitInstallView(state)).toEqual({
      kind: 'installed',
      version: '2.45.0',
      path: '/opt/homebrew/bin/git'
    })
  })

  it('returns to idle with the installed status after a successful run', () => {
    let state = gitInstallReducer(loaded(missing), { type: 'run-started', plan })
    state = gitInstallReducer(state, {
      type: 'run-finished',
      result: { ok: true, status: installed }
    })
    expect(state.run.phase).toBe('idle')
    expect(deriveGitInstallView(state).kind).toBe('installed')
  })

  it('treats a crashed run as a failed step with the plan manual command', () => {
    let state = gitInstallReducer(loaded(missing), { type: 'run-started', plan })
    state = gitInstallReducer(state, { type: 'run-crashed' })
    expect(deriveGitInstallView(state)).toEqual({
      kind: 'failed',
      reason: 'step-failed',
      manualCommand: 'brew install git'
    })
  })

  it('reads the run plan from the last status', () => {
    expect(planForRun(loaded(missing))).toEqual(plan)
    expect(planForRun(loaded(installed))).toBeNull()
  })
})
