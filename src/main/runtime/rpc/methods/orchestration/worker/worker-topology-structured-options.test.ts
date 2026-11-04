import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../../../orchestration/db/orchestration-db'

const { createStructuredWorkerSession } = vi.hoisted(() => ({
  createStructuredWorkerSession: vi.fn()
}))

vi.mock('../../orchestration-structured-worker-session', () => ({ createStructuredWorkerSession }))

import { createStructuredWorkerSessionForWorktree, type WorkerEffect } from './worker-topology'

const runtime = { notifyStructuredSessionJournalActivity: vi.fn() }
let db: OrchestrationDb

const start = (
  overrides: Partial<Parameters<typeof createStructuredWorkerSessionForWorktree>[0]> = {}
) =>
  createStructuredWorkerSessionForWorktree({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mocked session factory never reads the runtime.
    runtime: runtime as never,
    worktreeId: 'wt-1',
    agent: 'grok',
    dispatchId: 'dispatch-1',
    db,
    effects: [],
    ...overrides
  })

describe('structured worker topology', () => {
  afterEach(() => db.close())
  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    createStructuredWorkerSession.mockReset()
    createStructuredWorkerSession.mockResolvedValue({
      identity: { handle: 'structworker_1' },
      host: {},
      fence: 1
    })
  })

  it('accepts a registered agent that is not Claude or Codex, forwarding model, effort and access', async () => {
    const effects: WorkerEffect[] = []
    await start({
      effects,
      launchPreferences: { model: 'grok-code', effort: 'high' },
      accessMode: 'default'
    })
    expect(createStructuredWorkerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'grok',
        worktreeId: 'wt-1',
        dispatchId: 'dispatch-1',
        accessMode: 'default',
        options: { model: 'grok-code', effort: 'high', accessMode: 'default' }
      })
    )
    expect(effects).toEqual([
      expect.objectContaining({ kind: 'terminal', role: 'agent', id: 'structworker_1' })
    ])
  })

  it('forwards a resolved preset to the session, which narrows it for the host-typed create', async () => {
    await start({ agent: 'claude', accessMode: 'accept-edits' })
    expect(createStructuredWorkerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessMode: 'accept-edits',
        options: { accessMode: 'accept-edits' }
      })
    )
  })

  it('seeds no access mode when none was resolved, so the chat keeps its own default', async () => {
    await start({ agent: 'codex', launchPreferences: { model: 'gpt-6-luna' } })
    const call = createStructuredWorkerSession.mock.calls[0]?.[0]
    expect(call.options).toEqual({ model: 'gpt-6-luna' })
    expect(call).not.toHaveProperty('accessMode')
  })

  it('refuses an agent with no structured registration before any session is created', async () => {
    await expect(start({ agent: 'cursor' })).rejects.toThrow(
      /cursor has no structured session on this host/
    )
    expect(createStructuredWorkerSession).not.toHaveBeenCalled()
  })

  describe('a bot teammate hand-over', () => {
    /** A dispatch for the part a delegator handed to the team's second bot. */
    function handOver() {
      const team = db.createBotTeam({
        name: 'Marketing',
        purpose: '',
        character: 'circle',
        workspacesEnabled: false,
        bots: [
          { name: 'Ann', job: '', agent: 'claude' },
          { name: 'Bob', job: '', agent: 'codex' }
        ]
      })
      const request = db.createDelegationRequest({
        parentSessionId: 'ann-session',
        title: 'Part',
        summary: 'Part',
        prompt: 'Part',
        writes: false,
        workspaceKind: 'folder',
        optionsJson: '{}',
        decisionJson: null
      })
      const part = db.createBotTeamTask({
        teamId: team.id,
        title: 'Part',
        prompt: 'Part',
        ownerBotId: team.bots[1].id
      })
      db.linkBotTeamTaskDelegation(part.id, request.id)
      const task = db.createTask({ runId: 'run_legacy_local', spec: 'Part' })
      db.patchDelegationRequest(request.id, { task_id: task.id })
      const dispatch = db.createDispatchContext({
        taskId: task.id,
        assigneeHandle: 'term_child',
        creator: { kind: 'system' } as never,
        maxDepth: 5
      })
      return { team, dispatch }
    }

    it("starts the child as the teammate's run, not the delegator's, beside its model", async () => {
      const { team, dispatch } = handOver()
      await start({ dispatchId: dispatch.id, launchPreferences: { model: 'gpt-6-luna' } })
      expect(createStructuredWorkerSession.mock.calls[0]?.[0].options).toEqual({
        model: 'gpt-6-luna',
        botTeamBotId: team.bots[1].id,
        botTeamId: team.id
      })
    })

    it('seeds the marker even when the dispatch asked for nothing else', async () => {
      const { team, dispatch } = handOver()
      await start({ dispatchId: dispatch.id })
      expect(createStructuredWorkerSession.mock.calls[0]?.[0].options).toEqual({
        botTeamBotId: team.bots[1].id,
        botTeamId: team.id
      })
    })

    it('leaves any other delegation exactly as it was', async () => {
      handOver()
      const task = db.createTask({ runId: 'run_legacy_local', spec: 'Plain' })
      const plain = db.createDispatchContext({
        taskId: task.id,
        assigneeHandle: 'term_plain',
        creator: { kind: 'system' } as never,
        maxDepth: 5
      })
      await start({ dispatchId: plain.id, launchPreferences: { model: 'gpt-6-luna' } })
      const call = createStructuredWorkerSession.mock.calls[0]?.[0]
      expect(call.options).toEqual({ model: 'gpt-6-luna' })
      await start({ dispatchId: plain.id })
      expect(createStructuredWorkerSession.mock.calls[1]?.[0]).not.toHaveProperty('options')
    })
  })
})
