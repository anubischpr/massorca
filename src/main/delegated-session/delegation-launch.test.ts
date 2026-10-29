import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agentSessionDeclaredAccess,
  type AgentSessionDeclaredAccess
} from '../../shared/agent-session-access-mode'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { createRootDispatch } from '../runtime/orchestration/db/root-dispatch-test-fixture'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import {
  createDelegationLauncher,
  delegationWorktreeName,
  type DelegationWorkerStarter
} from './delegation-launch'
import type { DelegationLaunchTarget } from './delegation-launch-types'
import type { DelegationParentSession } from './delegation-service-types'

const PARENT: DelegationParentSession = {
  sessionId: 'session_parent_01',
  agent: 'claude',
  workspaceId: 'repo1::/work/app',
  workspaceKind: 'git',
  accessMode: undefined
}

const FULL = agentSessionDeclaredAccess({
  supportedAccessModes: ['default', 'full-access'],
  supportedPermissionPresets: ['plan', 'read-only']
})

const DECLARED: Record<string, AgentSessionDeclaredAccess | undefined> = {
  claude: FULL,
  pi: FULL,
  // A protocol-driven agent declares no explicit mode at all.
  grok: undefined
}

const TARGET: DelegationLaunchTarget = {
  agent: 'claude',
  label: 'Claude',
  model: 'sonnet',
  effort: 'medium',
  placement: 'current',
  automatic: false
}

describe('createDelegationLauncher', () => {
  let db: OrchestrationDb
  let request: DelegationRequestRow
  const record = vi.fn()

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    request = db.createDelegationRequest({
      parentSessionId: PARENT.sessionId,
      title: 'Parser audit',
      summary: 'Read only audit of the parser',
      prompt: 'Read src/parser and list every unsafe cast.',
      writes: false,
      workspaceKind: 'git',
      optionsJson: '{"agents":[]}',
      decisionJson: null
    })
    record.mockClear()
  })

  afterEach(() => {
    db.close()
  })

  /** A worker-start that files a Dispatch for the chat it starts, as the real one does. */
  function fakeStart(
    receipt: (dispatchId: string) => unknown = (dispatchId) => ({ dispatchId, state: 'ready' }),
    assignee: string | null = 'session_child_01'
  ) {
    return vi.fn<DelegationWorkerStarter>(async ({ task }) => {
      const dispatch = createRootDispatch(db, task.id, 'structworker_child')
      db.db
        .prepare('UPDATE dispatch_contexts SET assignee_orca_session_id = ? WHERE id = ?')
        .run(assignee, dispatch.id)
      // The next launch in a test needs the same worker handle free again.
      db.db
        .prepare('UPDATE dispatch_contexts SET assignee_handle = ? WHERE id = ?')
        .run(`structworker_${dispatch.id}`, dispatch.id)
      return receipt(dispatch.id)
    })
  }

  function launcher(startWorker = fakeStart()) {
    const launch = createDelegationLauncher({
      requireDb: () => db,
      declaredAccess: (agent) => DECLARED[agent],
      startWorker
    })
    return { startWorker, launch }
  }

  function run(
    launch: ReturnType<typeof launcher>['launch'],
    overrides: {
      parent?: Partial<DelegationParentSession>
      target?: Partial<DelegationLaunchTarget>
      request?: Partial<DelegationRequestRow>
    } = {}
  ) {
    return launch({
      request: { ...request, ...overrides.request },
      parent: { ...PARENT, ...overrides.parent },
      target: { ...TARGET, ...overrides.target },
      record
    })
  }

  it('files a Run the parent chat coordinates and a Task holding the prompt', async () => {
    const { launch, startWorker } = launcher()

    const result = await run(launch)

    const input = startWorker.mock.calls[0]?.[0]
    expect(input).toMatchObject({
      run: { id: result.runId, coordinator_orca_session_id: PARENT.sessionId },
      task: {
        id: result.taskId,
        spec: request.prompt,
        task_title: 'Parser audit',
        run_id: result.runId
      },
      caller: {
        orcaSessionId: PARENT.sessionId,
        workspaceId: PARENT.workspaceId,
        address: `orca_session_id:${PARENT.sessionId}`
      }
    })
    expect(result).toMatchObject({ childSessionId: 'session_child_01' })
    expect(record).toHaveBeenCalledWith({ run_id: result.runId })
    expect(record).toHaveBeenCalledWith({ task_id: result.taskId })
    expect(record).toHaveBeenCalledWith({ dispatch_id: result.dispatchId })
  })

  it('starts the child as a chat on the chosen agent, model and effort', async () => {
    const { launch, startWorker } = launcher()

    await run(launch)

    expect(startWorker.mock.calls[0]?.[0].params).toEqual({
      task: expect.stringMatching(/^task_/),
      from: `orca_session_id:${PARENT.sessionId}`,
      agent: 'claude',
      model: 'sonnet',
      effort: 'medium',
      preferredMode: 'chat',
      worktree: 'current'
    })
  })

  it('files a second child under the Run the first one made', async () => {
    const { launch } = launcher()

    const first = await run(launch)
    const second = await run(launch)

    expect(second.runId).toBe(first.runId)
    expect(second.taskId).not.toBe(first.taskId)
  })

  it('puts a child that writes code in a new worktree named for it', async () => {
    const { launch, startWorker } = launcher()

    await run(launch, { target: { placement: 'new-child' }, request: { writes: 1 } })

    expect(startWorker.mock.calls[0]?.[0].params).toMatchObject({
      worktree: 'new-child',
      name: delegationWorktreeName('Parser audit', request.id)
    })
  })

  it('keeps a child in a folder workspace in place, since a folder has no worktree to branch', async () => {
    const { launch, startWorker } = launcher()

    await run(launch, {
      target: { placement: 'new-child' },
      request: { workspace_kind: 'folder', writes: 1 }
    })

    const { params } = startWorker.mock.calls[0]?.[0] ?? {}
    expect(params).toMatchObject({ worktree: 'current' })
    expect(params).not.toHaveProperty('name')
  })

  it('asks for no effort where it names no model, which worker-start refuses', async () => {
    const { launch, startWorker } = launcher()

    await run(launch, { target: { agent: 'grok', model: null, effort: 'medium' } })

    const { params } = startWorker.mock.calls[0]?.[0] ?? {}
    expect(params).not.toHaveProperty('model')
    expect(params).not.toHaveProperty('effort')
  })

  describe('the access mode the child asks for', () => {
    async function accessModeFor(
      accessMode: string | undefined,
      agent = 'claude'
    ): Promise<unknown> {
      const { launch, startWorker } = launcher()
      await run(launch, { parent: { accessMode }, target: { agent, model: null, effort: null } })
      return startWorker.mock.calls[0]?.[0].params.accessMode
    }

    it('is the parent’s own, never a wider one', async () => {
      expect(await accessModeFor('read-only')).toBe('read-only')
      expect(await accessModeFor('plan')).toBe('plan')
      expect(await accessModeFor('full-access')).toBe('full-access')
    })

    it('is not asked for when the parent follows the global setting', async () => {
      expect(await accessModeFor(undefined)).toBeUndefined()
    })

    it('is not asked for from an ACP agent, which refuses an explicit mode', async () => {
      expect(await accessModeFor('read-only', 'grok')).toBeUndefined()
    })

    it('skips default for Pi', async () => {
      expect(await accessModeFor('default', 'pi')).toBeUndefined()
      expect(await accessModeFor('read-only', 'pi')).toBe('read-only')
    })
  })

  describe('when the child does not start', () => {
    it('throws the reason a failed start gave', async () => {
      const { launch } = launcher(
        fakeStart((dispatchId) => ({
          dispatchId,
          state: 'failed',
          lastError: 'Claude is not signed in'
        }))
      )

      await expect(run(launch)).rejects.toMatchObject({
        code: 'delegation_start_failed',
        message: 'Claude is not signed in'
      })
    })

    it('throws when the receipt names no dispatch', async () => {
      const { launch } = launcher(fakeStart(() => ({ state: 'ready' })))

      await expect(run(launch)).rejects.toThrow('The child session did not start.')
    })

    it('throws when the agent ran as a terminal and so cannot be linked under the chat', async () => {
      const { launch } = launcher(fakeStart(undefined, null))

      await expect(run(launch)).rejects.toThrow('Claude started as a terminal agent')
    })

    it('throws what worker-start throws', async () => {
      const { launch } = launcher(
        vi.fn().mockRejectedValue(new Error('New worktrees require --name.'))
      )

      await expect(run(launch)).rejects.toThrow('New worktrees require --name.')
    })
  })
})

describe('delegationWorktreeName', () => {
  it('is a branch-safe slug of the title with a suffix from the request', () => {
    expect(delegationWorktreeName('Fix the “Retry” helper!', 'deleg_a1b2c3d4e5f6')).toBe(
      'fix-the-retry-helper-a1b2c3'
    )
  })

  it('falls back to a plain name when the title has nothing to slug', () => {
    expect(delegationWorktreeName('日本語', 'deleg_a1b2c3d4e5f6')).toBe('child-a1b2c3')
  })

  it('is bounded', () => {
    expect(
      delegationWorktreeName('x'.repeat(200), 'deleg_a1b2c3d4e5f6').length
    ).toBeLessThanOrEqual(47)
  })
})
