import type {
  GitInstallFailureReason,
  GitInstallManager,
  GitInstallRunResult,
  GitInstallStatus
} from '../../../shared/marketplace-install'
import { planGitInstall, toPlanView } from './git-install-plan'
import { detectGitOwner, meetsGitMinimum, probeGit, type GitProbe } from './git-install-probe'
import type { GitInstallEnv, InstallStep, InternalPlan, ProgressSink } from './git-install-types'

export type GitInstallService = {
  status: () => Promise<GitInstallStatus>
  install: (onProgress: ProgressSink) => Promise<GitInstallRunResult>
  adopt: (onProgress: ProgressSink) => Promise<GitInstallRunResult>
}

/** Git on this computer: detect it, install it with its package manager, verify it, and record what MassOrca did. */
export function createGitInstallService(env: GitInstallEnv): GitInstallService {
  let running = false

  function recordedAt(): string {
    return env.now().toISOString()
  }

  async function status(): Promise<GitInstallStatus> {
    const probe = await probeGit(env)
    switch (probe.kind) {
      case 'unverifiable':
        return { state: 'unverifiable', reason: probe.reason }
      case 'missing': {
        const record = env.store.read()
        if (record.tools.git) {
          env.store.write({ ...record, tools: {} })
        }
        return { state: 'missing', plan: toPlanView(await planGitInstall(env)) }
      }
      case 'broken':
        return {
          state: 'broken',
          path: probe.path,
          owner: await detectGitOwner(env, probe.path),
          plan: toPlanView(await planGitInstall(env))
        }
      case 'found':
        return foundStatus(probe)
    }
  }

  async function foundStatus(
    probe: Extract<GitProbe, { kind: 'found' }>
  ): Promise<GitInstallStatus> {
    const { path, version } = probe
    if (!meetsGitMinimum(version)) {
      return { state: 'too-old', version, path, plan: toPlanView(await planGitInstall(env)) }
    }
    const record = env.store.read()
    if (record.tools.git) {
      return { state: 'installed', version, path, installedBy: 'massorca' }
    }
    const owner = await detectGitOwner(env, path)
    const pending = record.pending.git
    // Why: the offered manual command installed Git through this manager, so it counts as MassOrca's install.
    if (pending && owner === pending.manager) {
      env.store.write({
        version: 1,
        tools: { git: { manager: pending.manager, recordedAt: recordedAt() } },
        pending: {}
      })
      return { state: 'installed', version, path, installedBy: 'massorca' }
    }
    return {
      state: 'outside',
      version,
      path,
      owner,
      plan: toPlanView(await planGitInstall(env))
    }
  }

  function recordPending(manager: GitInstallManager): void {
    const record = env.store.read()
    env.store.write({ ...record, pending: { git: { manager, recordedAt: recordedAt() } } })
  }

  async function failure(
    reason: GitInstallFailureReason,
    plan: InternalPlan
  ): Promise<GitInstallRunResult> {
    // Why not xcode-clt: its owner can never be detected, so a pending record would never match.
    if (plan.manager !== null && plan.manager !== 'xcode-clt' && plan.manualCommand !== null) {
      recordPending(plan.manager)
    }
    return { ok: false, reason, manualCommand: plan.manualCommand, status: await status() }
  }

  async function runStep(step: InstallStep, onProgress: ProgressSink): Promise<boolean> {
    try {
      const result = await env.runStep(step, (logLine) =>
        onProgress({ stepId: step.id, status: 'running', logLine })
      )
      return !result.timedOut && result.code === 0
    } catch {
      return false
    }
  }

  async function runInstall(onProgress: ProgressSink): Promise<GitInstallRunResult> {
    const plan = await planGitInstall(env)
    if (plan.manager === null) {
      return failure('unsupported', plan)
    }
    for (const step of plan.steps) {
      onProgress({ stepId: step.id, status: 'running' })
      if (!(await runStep(step, onProgress))) {
        onProgress({ stepId: step.id, status: 'failed' })
        return failure(step.failure, plan)
      }
      onProgress({ stepId: step.id, status: 'done' })
    }
    onProgress({ stepId: 'verify', status: 'running' })
    const probe = await probeGit(env)
    if (probe.kind === 'found' && meetsGitMinimum(probe.version)) {
      env.store.write({
        version: 1,
        tools: { git: { manager: plan.manager, recordedAt: recordedAt() } },
        pending: {}
      })
      onProgress({ stepId: 'verify', status: 'done' })
      return { ok: true, status: await status() }
    }
    onProgress({ stepId: 'verify', status: 'failed' })
    // Why installer-opened: xcode-select returns at once, and Git only exists after the person finishes Apple's window.
    if (probe.kind === 'found') {
      return failure('too-old', plan)
    }
    return failure(plan.manager === 'xcode-clt' ? 'installer-opened' : 'verify-failed', plan)
  }

  async function install(onProgress: ProgressSink): Promise<GitInstallRunResult> {
    if (running) {
      return { ok: false, reason: 'busy', manualCommand: null, status: await status() }
    }
    running = true
    try {
      return await runInstall(onProgress)
    } finally {
      running = false
    }
  }

  async function adopt(onProgress: ProgressSink): Promise<GitInstallRunResult> {
    if (running) {
      return { ok: false, reason: 'busy', manualCommand: null, status: await status() }
    }
    const probe = await probeGit(env)
    const record = env.store.read()
    if (probe.kind === 'found' && meetsGitMinimum(probe.version) && !record.tools.git) {
      const owner = await detectGitOwner(env, probe.path)
      // Why no reinstall: a package manager that owns the binary already manages its updates and removal.
      if (owner !== 'unknown') {
        env.store.write({
          version: 1,
          tools: { git: { manager: owner, recordedAt: recordedAt() } },
          pending: {}
        })
        return { ok: true, status: await status() }
      }
    }
    return install(onProgress)
  }

  return { status, install, adopt }
}
