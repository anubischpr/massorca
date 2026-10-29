import type { AgentSessionDeclaredAccess } from '../../shared/agent-session-access-mode'
import { z } from 'zod'
import { isOrcaSessionId } from '../../shared/orca-session-address'
import type { WorkerStartInput } from '../runtime/rpc/methods/orchestration/worker/worker-start-schema'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { OrchestrationSessionCaller } from '../runtime/orchestration/orchestration-caller-identity'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import { resolveOrcaSessionParty } from '../runtime/orchestration/orchestration-party'
import type { RunRow, TaskRow } from '../runtime/orchestration/types'
import { delegationChildAccessMode } from './delegation-access-mode'
import type { DelegationLauncher } from './delegation-launch-types'

const RUN_OBJECTIVE = 'Delegated child sessions'
const WORKTREE_NAME_MAX_CHARS = 40

/** Runs worker-start for a Task the launcher filed; resolves to its receipt. */
export type DelegationWorkerStarter = (input: {
  params: WorkerStartInput
  run: RunRow
  caller: OrchestrationSessionCaller
  task: TaskRow
}) => Promise<unknown>

/** A branch-safe name for the worktree a child that writes code gets, unique per request. */
export function delegationWorktreeName(title: string, requestId: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, WORKTREE_NAME_MAX_CHARS)
    .replace(/-+$/g, '')
  const suffix = requestId.replace(/^deleg_/, '').slice(0, 6)
  return slug.length > 0 ? `${slug}-${suffix}` : `child-${suffix}`
}

const StartReceipt = z.object({
  dispatchId: z.string().optional(),
  state: z.string().optional(),
  lastError: z.string().optional()
})

/** The child's Run, Task and worker-start for one answered request. */
export function createDelegationLauncher(deps: {
  requireDb: () => OrchestrationDb
  startWorker: DelegationWorkerStarter
  /** What the child's agent declares it can run in; see `declaredAccessForStructuredAgent`. */
  declaredAccess: (agent: string) => AgentSessionDeclaredAccess | undefined
}): DelegationLauncher {
  return async ({ request, parent, target, record }) => {
    const db = deps.requireDb()
    const sessionId = parent.sessionId
    if (!isOrcaSessionId(sessionId)) {
      throw new OrchestrationError(
        'delegation_parent_unavailable',
        `${sessionId} is not an Orca session id.`
      )
    }
    const caller: OrchestrationSessionCaller = Object.freeze({
      ...resolveOrcaSessionParty(sessionId, db),
      sessionId,
      workspaceId: parent.workspaceId
    })
    // The parent's current Run when it has one, so a second child lands beside the first.
    const run =
      db.getCurrentRunForCoordinator(caller) ??
      db.createRun({
        objective: RUN_OBJECTIVE,
        coordinatorHandle: caller.terminalHandle,
        coordinatorPaneKey: caller.paneKey,
        coordinatorOrcaSessionId: caller.orcaSessionId
      })
    record({ run_id: run.id })
    const task = db.createTask({
      spec: request.prompt,
      taskTitle: request.title,
      runId: run.id,
      createdByRunGeneration: run.consumer_generation,
      ...(caller.terminalHandle ? { createdByTerminalHandle: caller.terminalHandle } : {}),
      ...(caller.paneKey ? { createdByPaneKey: caller.paneKey } : {})
    })
    record({ task_id: task.id })
    const accessMode = delegationChildAccessMode({
      childAgent: target.agent,
      parentAccessMode: parent.accessMode,
      childDeclaredAccess: deps.declaredAccess(target.agent)
    })
    // A folder has no worktree to branch, so its child always runs in place.
    const newWorktree = target.placement === 'new-child' && request.workspace_kind === 'git'
    const receipt = await deps.startWorker({
      run,
      caller,
      task,
      params: {
        task: task.id,
        from: caller.address,
        agent: target.agent,
        ...(target.model ? { model: target.model } : {}),
        ...(target.model && target.effort ? { effort: target.effort } : {}),
        preferredMode: 'chat',
        ...(accessMode ? { accessMode } : {}),
        worktree: newWorktree ? 'new-child' : 'current',
        ...(newWorktree ? { name: delegationWorktreeName(request.title, request.id) } : {})
      }
    })
    const started = StartReceipt.safeParse(receipt)
    const dispatchId = started.success ? started.data.dispatchId : undefined
    if (!started.success || started.data.state === 'failed' || dispatchId === undefined) {
      throw new OrchestrationError(
        'delegation_start_failed',
        (started.success ? started.data.lastError : undefined) ?? 'The child session did not start.'
      )
    }
    record({ dispatch_id: dispatchId })
    const childSessionId = db.getDispatchContextById(dispatchId)?.assignee_orca_session_id
    if (!childSessionId) {
      throw new OrchestrationError(
        'delegation_start_failed',
        `${target.label} started as a terminal agent, not a chat session, so it cannot be linked under this chat.`
      )
    }
    return { runId: run.id, taskId: task.id, dispatchId, childSessionId }
  }
}
