import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'
import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import {
  delegationQuestionItemId,
  readDelegationNoticePayload
} from '../../shared/delegated-session-journal'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { observeDispatchSettlements } from '../runtime/orchestration/db/dispatch-settlement-observers'
import { createRootDispatch } from '../runtime/orchestration/db/root-dispatch-test-fixture'
import { DelegationAnswerService } from './delegation-answer-service'
import type { DelegationLauncher } from './delegation-launch-types'
import { DelegationRequestService } from './delegation-request-service'
import type {
  DelegationHostDeps,
  DelegationParentSession,
  DelegationRequestDeps
} from './delegation-service-types'

const NOW = 1_800_000_000_000
const PARENT: DelegationParentSession = {
  sessionId: 'session_parent_01',
  agent: 'claude',
  workspaceId: 'repo1::/work/app',
  workspaceKind: 'git',
  accessMode: undefined
}
const AGENTS = [
  { agent: 'claude', label: 'Claude' },
  { agent: 'codex', label: 'Codex' }
]

function usage(provider: 'claude' | 'codex', percent: number): RateLimitState {
  return createEmptyRateLimitState({
    [provider]: {
      provider,
      session: { usedPercent: percent, windowMinutes: 300, resetsAt: null, resetDescription: null },
      weekly: null,
      updatedAt: NOW - 1000,
      error: null,
      status: 'ok'
    }
  })
}

type Row = { sessionId: string; identity: AgentJournalItemIdentity; body: AgentJournalItemBody }

/** A parent chat's journal as the service sees it: rows in, nothing else. */
function fakeRows(rows: Row[]): DelegationHostDeps['rows'] {
  return {
    appendHostRow: vi.fn(async (sessionId, identity, body) => {
      rows.push({ sessionId, identity, body })
      return {
        cursor: { epoch: 'e', sequence: rows.length },
        itemId: agentJournalItemKey(identity),
        revision: 1
      }
    })
  }
}

/** A launcher that files what the real one would, without starting an agent. */
function fakeLauncher(db: OrchestrationDb): DelegationLauncher {
  return vi.fn(async ({ request, record }) => {
    const run = db.createRun({
      objective: 'Delegated child sessions',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    })
    record({ run_id: run.id })
    const task = db.createTask({ spec: request.prompt, runId: run.id })
    const dispatch = createRootDispatch(db, task.id, 'structworker_child')
    return {
      runId: run.id,
      taskId: task.id,
      dispatchId: dispatch.id,
      childSessionId: 'session_child_01'
    }
  })
}

describe('DelegationAnswerService', () => {
  let db: OrchestrationDb
  let rows: Row[]
  let rateLimits: RateLimitState
  let launch: DelegationLauncher
  let host: DelegationHostDeps
  let requests: DelegationRequestService
  let answers: DelegationAnswerService
  let tempDir: string | undefined

  function wire(database: OrchestrationDb): void {
    db = database
    launch = fakeLauncher(db)
    host = {
      getDb: () => db,
      rows: fakeRows(rows),
      readParent: (sessionId) => (sessionId === PARENT.sessionId ? PARENT : null),
      readRateLimits: () => rateLimits,
      now: () => NOW
    }
    const requestDeps: DelegationRequestDeps = {
      ...host,
      requireDb: () => db,
      listAgents: async () => AGENTS
    }
    requests = new DelegationRequestService(requestDeps)
    answers = new DelegationAnswerService({ ...host, launch, warn: vi.fn() })
  }

  beforeEach(() => {
    rows = []
    rateLimits = usage('claude', 40)
    wire(new OrchestrationDb(':memory:'))
  })

  afterEach(() => {
    db.close()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      tempDir = undefined
    }
  })

  const task = {
    parentSessionId: PARENT.sessionId,
    summary: 'Implement the retry helper and add tests',
    prompt: 'Add a retry helper to src/net and cover it with tests.',
    writes: true
  }

  async function filed() {
    const { requestId, questionItemId } = await requests.request(task)
    return { requestId, itemId: questionItemId }
  }

  function noticeRows(): { status: string | undefined; text: string }[] {
    return rows.slice(1).map((row) => ({
      status:
        row.body.kind === 'status'
          ? readDelegationNoticePayload(row.body.delegation)?.status
          : undefined,
      text: row.body.kind === 'status' ? row.body.text : ''
    }))
  }

  it('starts the agent the person picked, with that agent’s model and effort for the task', async () => {
    const { requestId, itemId } = await filed()

    const outcome = await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'agent:codex'
    })
    expect(outcome.ok).toBe(true)
    // The start waits for the resolution to be in the journal.
    expect(launch).not.toHaveBeenCalled()
    if (outcome.ok) {
      outcome.afterCommit()
    }
    await answers.idle()

    expect(launch).toHaveBeenCalledOnce()
    const input = vi.mocked(launch).mock.calls[0]?.[0]
    expect(input?.target).toMatchObject({ agent: 'codex', label: 'Codex', automatic: false })
    expect(input?.target.model).not.toBeNull()
    expect(db.getDelegationRequest(requestId)).toMatchObject({
      status: 'started',
      choice: 'agent:codex',
      child_session_id: 'session_child_01'
    })
    const started = readDelegationNoticePayload(
      rows[1]?.body.kind === 'status' ? rows[1].body.delegation : null
    )
    expect(started).toMatchObject({
      status: 'started',
      agent: 'codex',
      childSessionId: 'session_child_01',
      automatic: false,
      placement: 'new-child'
    })
    expect(rows[1]?.body.kind === 'status' && rows[1].body.text).toMatch(
      /^Started child session “.+” with Codex .*\(Manual\)$/
    )
  })

  it('decides Automatic again at the answer, with the usage read then', async () => {
    const { requestId, itemId } = await filed()
    // Claude led when the card was posted; by the answer Codex has more room.
    expect(JSON.parse(db.getDelegationRequest(requestId)?.decision_json ?? '{}')).toMatchObject({
      agent: 'claude'
    })
    rateLimits = createEmptyRateLimitState({
      claude: usage('claude', 88).claude,
      codex: usage('codex', 10).codex
    })

    const outcome = await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'automatic'
    })
    if (outcome.ok) {
      outcome.afterCommit()
    }
    await answers.idle()

    expect(JSON.parse(db.getDelegationRequest(requestId)?.decision_json ?? '{}')).toMatchObject({
      agent: 'codex'
    })
    expect(vi.mocked(launch).mock.calls[0]?.[0].target).toMatchObject({
      agent: 'codex',
      automatic: true
    })
    expect(noticeRows()[0]?.text).toMatch(/\(Automatic\)$/)
  })

  it('fails an Automatic answer when no agent has headroom any more', async () => {
    const { requestId, itemId } = await filed()
    rateLimits = createEmptyRateLimitState({
      claude: usage('claude', 100).claude,
      codex: usage('codex', 97).codex
    })

    const outcome = await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'automatic'
    })
    if (outcome.ok) {
      outcome.afterCommit()
    }
    await answers.idle()

    expect(launch).not.toHaveBeenCalled()
    expect(db.getDelegationRequest(requestId)).toMatchObject({
      status: 'failed',
      failure: 'No agent has headroom right now.'
    })
    expect(noticeRows()).toEqual([
      {
        status: 'failed',
        text: expect.stringContaining('No agent has headroom right now.')
      }
    ])
  })

  it('answers the same choice again without starting a second child', async () => {
    const { itemId } = await filed()
    const answer = () =>
      answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'agent:codex'
      })

    const first = await answer()
    if (first.ok) {
      first.afterCommit()
    }
    await answers.idle()
    const again = await answer()
    if (again.ok) {
      again.afterCommit()
    }
    await answers.idle()

    expect(first.ok && again.ok).toBe(true)
    expect(launch).toHaveBeenCalledOnce()
    expect(noticeRows().filter((row) => row.status === 'started')).toHaveLength(1)
  })

  it('refuses another choice once one was taken', async () => {
    const { itemId } = await filed()
    await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'agent:codex'
    })

    await expect(
      answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'agent:claude'
      })
    ).resolves.toMatchObject({ ok: false, reason: 'promptGone' })
  })

  it('refuses an option the card did not offer, and a request that is not this chat’s', async () => {
    const { itemId } = await filed()

    for (const optionId of ['agent:grok', 'allow', 'agent:']) {
      await expect(
        answers.hostOwnedPrompts.answer({ sessionId: PARENT.sessionId, itemId, optionId })
      ).resolves.toMatchObject({ ok: false, reason: 'optionRejected' })
    }
    await expect(
      answers.hostOwnedPrompts.answer({
        sessionId: 'session_other_99',
        itemId,
        optionId: 'automatic'
      })
    ).resolves.toMatchObject({ ok: false, reason: 'promptGone' })
    await expect(
      answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId: delegationQuestionItemId('deleg_missing00000'),
        optionId: 'automatic'
      })
    ).resolves.toMatchObject({ ok: false, reason: 'promptGone' })
    expect(db.listDelegationRequestsByStatus('pending')).toHaveLength(1)
  })

  it('offers no Automatic when the card had none', async () => {
    rateLimits = createEmptyRateLimitState({
      claude: usage('claude', 100).claude,
      codex: usage('codex', 97).codex
    })
    const { itemId } = await filed()

    await expect(
      answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'automatic'
      })
    ).resolves.toMatchObject({ ok: false, reason: 'optionRejected' })
  })

  it('cancels the request, and a cancelled request cannot be answered', async () => {
    const { requestId, itemId } = await filed()

    const cancelled = await answers.hostOwnedPrompts.cancel({ sessionId: PARENT.sessionId, itemId })
    const again = await answers.hostOwnedPrompts.cancel({ sessionId: PARENT.sessionId, itemId })

    expect(cancelled.ok && again.ok).toBe(true)
    expect(db.getDelegationRequest(requestId)?.status).toBe('cancelled')
    await expect(
      answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'automatic'
      })
    ).resolves.toMatchObject({ ok: false, reason: 'promptGone' })
    expect(launch).not.toHaveBeenCalled()
  })

  it('refuses to cancel a request that was already answered', async () => {
    const { itemId } = await filed()
    await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'automatic'
    })

    await expect(
      answers.hostOwnedPrompts.cancel({ sessionId: PARENT.sessionId, itemId })
    ).resolves.toMatchObject({ ok: false, reason: 'promptGone' })
  })

  it('answers after a host restart, from the stored request alone', async () => {
    db.close()
    tempDir = mkdtempSync(join(tmpdir(), 'orca-delegation-restart-'))
    const path = join(tempDir, 'orchestration.db')
    wire(new OrchestrationDb(path))
    const { requestId, itemId } = await filed()
    db.close()

    // A new process: new database handle, new services, nothing carried over in memory.
    wire(new OrchestrationDb(path))
    const outcome = await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'agent:claude'
    })
    if (outcome.ok) {
      outcome.afterCommit()
    }
    await answers.idle()

    expect(outcome.ok).toBe(true)
    expect(db.getDelegationRequest(requestId)).toMatchObject({
      status: 'started',
      choice: 'agent:claude'
    })
  })

  describe('when the child cannot start', () => {
    it('fails the request and tells the parent why', async () => {
      const { requestId, itemId } = await filed()
      vi.mocked(launch).mockRejectedValueOnce(new Error('Codex is not signed in'))

      const outcome = await answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'agent:codex'
      })
      if (outcome.ok) {
        outcome.afterCommit()
      }
      await answers.idle()

      expect(db.getDelegationRequest(requestId)).toMatchObject({
        status: 'failed',
        failure: 'Codex is not signed in'
      })
      const failed = rows[1]?.body
      expect(failed?.kind === 'status' && failed.tone).toBe('error')
      expect(failed?.kind === 'status' && readDelegationNoticePayload(failed.delegation)).toEqual({
        requestId,
        title: expect.any(String),
        status: 'failed',
        reason: 'Codex is not signed in'
      })
    })

    it('fails a request a restart interrupted between the answer and the start', async () => {
      const { requestId, itemId } = await filed()
      await answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'agent:codex'
      })
      // The answer was recorded; the process ended before afterCommit started anything.
      expect(db.getDelegationRequest(requestId)?.status).toBe('starting')

      await answers.reconcile()

      expect(db.getDelegationRequest(requestId)?.status).toBe('failed')
      expect(noticeRows().map((row) => row.status)).toEqual(['failed'])
    })
  })

  it('treats a starting request whose dispatch was recorded as started after a restart', async () => {
    const { requestId, itemId } = await filed()
    await answers.hostOwnedPrompts.answer({
      sessionId: PARENT.sessionId,
      itemId,
      optionId: 'agent:codex'
    })
    const launched = await launch({
      request: db.getDelegationRequest(requestId)!,
      parent: PARENT,
      target: {
        agent: 'codex',
        label: 'Codex',
        model: null,
        effort: null,
        placement: 'current',
        automatic: false
      },
      record: (patch) => db.patchDelegationRequest(requestId, patch)
    })
    db.patchDelegationRequest(requestId, { dispatch_id: launched.dispatchId })
    db.updateTaskStatus(launched.taskId, 'completed', 'Done before the restart.')

    await answers.reconcile()

    expect(db.getDelegationRequest(requestId)?.status).toBe('finished')
    expect(noticeRows().map((row) => row.status)).toEqual(['finished'])
  })

  describe('when the child finishes', () => {
    async function startedChild() {
      const { requestId, itemId } = await filed()
      const outcome = await answers.hostOwnedPrompts.answer({
        sessionId: PARENT.sessionId,
        itemId,
        optionId: 'agent:codex'
      })
      if (outcome.ok) {
        outcome.afterCommit()
      }
      await answers.idle()
      const row = db.getDelegationRequest(requestId)
      if (!row?.task_id || !row.dispatch_id) {
        throw new Error('the child did not start')
      }
      return { requestId, taskId: row.task_id, dispatchId: row.dispatch_id }
    }

    it('records the result and tells the parent', async () => {
      const { requestId, taskId, dispatchId } = await startedChild()
      db.updateTaskStatus(taskId, 'completed', 'Found 3 unsafe casts in src/parser.')

      await answers.onDispatchSettled(dispatchId)

      expect(db.getDelegationRequest(requestId)).toMatchObject({
        status: 'finished',
        result: 'Found 3 unsafe casts in src/parser.'
      })
      const finished = rows.at(-1)?.body
      expect(finished?.kind === 'status' && finished.text).toEqual(
        expect.stringMatching(
          /^Child session “.+” finished: Found 3 unsafe casts in src\/parser\.$/
        )
      )
      expect(
        finished?.kind === 'status' && readDelegationNoticePayload(finished.delegation)
      ).toEqual({
        requestId,
        title: expect.any(String),
        status: 'finished',
        outcome: 'succeeded',
        resultSummary: 'Found 3 unsafe casts in src/parser.',
        childSessionId: 'session_child_01',
        durationMs: 0
      })
    })

    it('reports a failed child as failed, with why', async () => {
      const { taskId, dispatchId } = await startedChild()
      db.updateTaskStatus(taskId, 'failed', 'The build never went green.')

      await answers.onDispatchSettled(dispatchId)

      const finished = rows.at(-1)?.body
      expect(finished?.kind === 'status' && finished.tone).toBe('error')
      expect(
        finished?.kind === 'status' && readDelegationNoticePayload(finished.delegation)
      ).toMatchObject({
        status: 'finished',
        outcome: 'failed',
        resultSummary: 'The build never went green.'
      })
    })

    it('finishes once however many times the dispatch is reported settled', async () => {
      const { taskId, dispatchId } = await startedChild()
      db.updateTaskStatus(taskId, 'completed', 'Done.')

      await Promise.all([
        answers.onDispatchSettled(dispatchId),
        answers.onDispatchSettled(dispatchId)
      ])
      await answers.onDispatchSettled(dispatchId)

      expect(noticeRows().filter((row) => row.status === 'finished')).toHaveLength(1)
    })

    it('stays started when the notice cannot be posted, and finishes on a later attempt', async () => {
      const { requestId, taskId, dispatchId } = await startedChild()
      db.updateTaskStatus(taskId, 'completed', 'Done.')
      vi.mocked(host.rows.appendHostRow).mockRejectedValueOnce(new Error('The chat host is down'))

      await answers.onDispatchSettled(dispatchId)
      expect(db.getDelegationRequest(requestId)?.status).toBe('started')

      await answers.reconcile()
      expect(db.getDelegationRequest(requestId)?.status).toBe('finished')
      expect(noticeRows().filter((row) => row.status === 'finished')).toHaveLength(1)
    })

    it('does nothing while the dispatch is still running', async () => {
      const { requestId, dispatchId } = await startedChild()

      await answers.onDispatchSettled(dispatchId)

      expect(db.getDelegationRequest(requestId)?.status).toBe('started')
      expect(noticeRows().filter((row) => row.status === 'finished')).toHaveLength(0)
    })

    it('is told by the database when any path settles the dispatch', async () => {
      const { taskId, dispatchId } = await startedChild()
      const seen = vi.fn()
      const stop = observeDispatchSettlements((raw, id) => {
        if (raw === db.db) {
          seen(id)
        }
      })

      db.updateTaskStatus(taskId, 'completed', 'Done.')

      await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(dispatchId))
      stop()
    })

    it('finishes a request whose dispatch ended while the host was down', async () => {
      const { requestId, taskId } = await startedChild()
      db.updateTaskStatus(taskId, 'completed', 'Done while nobody listened.')

      await answers.reconcile()

      expect(db.getDelegationRequest(requestId)?.status).toBe('finished')
      expect(noticeRows().at(-1)?.status).toBe('finished')
    })
  })
})
