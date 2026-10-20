import {
  captureRuntimeEnvironmentRequestRevision,
  getRuntimeEnvironmentRevision
} from '@/runtime/runtime-environment-revision'
import type { AppState } from '../types'
import { callRuntimeRpc, ensureRuntimeEnvironmentCompatible } from '@/runtime/runtime-rpc-client'
import { resolveTerminalWorktreeRoute } from '@/lib/terminal-worktree-route'
import {
  classifyTerminalRetirementWorktree,
  type TerminalTabRetirementPlan
} from '../slices/terminal-tab-retirement'

export function startTerminalTabProviderRetirement({
  localPtyTeardownOwnedExternally,
  remoteCloseOwnedByHost,
  retirementPlan,
  state,
  tabId,
  canRetireRuntimeTerminal
}: {
  localPtyTeardownOwnedExternally: boolean
  remoteCloseOwnedByHost: boolean
  retirementPlan: TerminalTabRetirementPlan
  state: AppState
  tabId: string
  canRetireRuntimeTerminal?: () => boolean
}): void {
  const fallbackWorktreeRoute = fallbackRuntimeRouteFor(state, retirementPlan)
  const retirementTasks: Promise<unknown>[] = localPtyTeardownOwnedExternally
    ? []
    : retirementPlan.localOrSshPtyIds.map(async (ptyId) => window.api.pty.kill(ptyId))
  const localOrSshTaskCount = retirementTasks.length
  if (!remoteCloseOwnedByHost) {
    for (const terminal of retirementPlan.runtimeTerminals) {
      if (!terminal.environmentId && !fallbackWorktreeRoute) {
        continue
      }
      const environmentId = terminal.environmentId ?? fallbackWorktreeRoute?.runtimeEnvironmentId
      retirementTasks.push(
        retireRuntimeTerminal(environmentId, terminal.handle, canRetireRuntimeTerminal)
      )
    }
  }
  if (retirementPlan.unroutablePtyIds.length > 0) {
    // Log the worktree shape, never its id, because worktree ids embed absolute paths.
    console.warn('[terminal-retirement] skipped PTYs with no resolvable owner', {
      tabId,
      worktreeKind: classifyTerminalRetirementWorktree(retirementPlan.worktreeId),
      count: retirementPlan.unroutablePtyIds.length
    })
  }
  // Close remains synchronous; provider failures cannot block ownership revocation.
  void Promise.allSettled(retirementTasks).then((results) => {
    const localOrSshFailures = results
      .slice(0, localOrSshTaskCount)
      .filter((result) => result.status === 'rejected').length
    const runtimeFailures = results
      .slice(localOrSshTaskCount)
      .filter((result) => result.status === 'rejected').length
    if (localOrSshFailures > 0 || runtimeFailures > 0) {
      console.warn('[terminal-retirement] provider teardown failed', {
        tabId,
        localOrSshFailures,
        runtimeFailures
      })
    }
  })
}

/**
 * The awaited variant of `startTerminalTabProviderRetirement` over the same plan. Resolves true only
 * when every process the plan reaches confirmed its exit. A PTY this plan cannot reach (shared with
 * another tab, no owner, no route) keeps its process alive, so it counts as unconfirmed.
 */
export function startConfirmedTerminalTabProviderRetirement({
  canRetireRuntimeTerminal,
  retirementPlan,
  state
}: {
  canRetireRuntimeTerminal?: () => boolean
  retirementPlan: TerminalTabRetirementPlan
  state: AppState
}): Promise<boolean> {
  const fallbackWorktreeRoute = fallbackRuntimeRouteFor(state, retirementPlan)
  let unreachableCount = retirementPlan.sharedPtyIds.length + retirementPlan.unroutablePtyIds.length
  const confirmations: Promise<boolean>[] = retirementPlan.localOrSshPtyIds.map((ptyId) =>
    confirmLocalPtyStopped(ptyId)
  )
  for (const terminal of retirementPlan.runtimeTerminals) {
    if (!terminal.environmentId && !fallbackWorktreeRoute) {
      unreachableCount += 1
      continue
    }
    const environmentId = terminal.environmentId ?? fallbackWorktreeRoute?.runtimeEnvironmentId
    confirmations.push(
      confirmRuntimeTerminalStopped(environmentId, terminal.handle, canRetireRuntimeTerminal)
    )
  }
  return Promise.all(confirmations).then(
    (results) => unreachableCount === 0 && results.length > 0 && results.every(Boolean)
  )
}

/** The route a runtime PTY falls back to when its own id names no environment. */
function fallbackRuntimeRouteFor(state: AppState, retirementPlan: TerminalTabRetirementPlan) {
  return retirementPlan.worktreeId
    ? resolveTerminalWorktreeRoute(state, retirementPlan.worktreeId)
    : { runtimeEnvironmentId: null }
}

async function confirmLocalPtyStopped(ptyId: string): Promise<boolean> {
  try {
    const result = await window.api.pty.kill(ptyId, { confirmExit: true })
    return result.exitConfirmed === true
  } catch {
    return false
  }
}

/** `terminal.close` answers `{ close }`; a reply that is the close itself is read the same way. */
function replyConfirmsExit(reply: unknown): boolean {
  if (typeof reply !== 'object' || reply === null) {
    return false
  }
  if ('close' in reply) {
    return replyConfirmsExit(reply.close)
  }
  return 'ptyExitConfirmed' in reply && reply.ptyExitConfirmed === true
}

async function confirmRuntimeTerminalStopped(
  environmentId: string | null | undefined,
  handle: string,
  canRetire?: () => boolean
): Promise<boolean> {
  try {
    // Why: a close the host did not confirm, and every older host that omits the field, stay unconfirmed.
    const reply = await retireRuntimeTerminal(environmentId, handle, canRetire)
    return replyConfirmsExit(reply)
  } catch {
    return false
  }
}

async function retireRuntimeTerminal(
  environmentId: string | null | undefined,
  handle: string,
  canRetire?: () => boolean
): Promise<unknown> {
  const target = environmentId
    ? { kind: 'environment' as const, environmentId }
    : { kind: 'local' as const }
  if (!canRetire) {
    return callRuntimeRpc<unknown>(target, 'terminal.close', { terminal: handle })
  }
  const revision = environmentId
    ? captureRuntimeEnvironmentRequestRevision(environmentId)
    : undefined
  if (environmentId) {
    await ensureRuntimeEnvironmentCompatible(environmentId, {
      expectedEnvironmentPairingRevision: revision
    })
  }
  if (
    (environmentId && getRuntimeEnvironmentRevision(environmentId) !== revision) ||
    !canRetire()
  ) {
    return undefined
  }
  // Compatibility was checked above; recheck pane ownership at the actual dispatch boundary.
  return callRuntimeRpc<unknown>(
    target,
    'terminal.close',
    { terminal: handle },
    {
      skipCompatibilityCheck: true,
      expectedEnvironmentPairingRevision: revision
    }
  )
}
