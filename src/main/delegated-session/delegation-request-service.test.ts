import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'
import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import { isAdmissibleAgentJournalItemBody } from '../../shared/agent-session-journal-schemas'
import {
  delegationQuestionItemId,
  isHostOwnedDelegationQuestion,
  readDelegationCardPayload
} from '../../shared/delegated-session-journal'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { DelegationRequestService } from './delegation-request-service'
import type { DelegationParentSession, DelegationRequestDeps } from './delegation-service-types'

const NOW = 1_800_000_000_000
const PARENT: DelegationParentSession = {
  sessionId: 'session_parent_01',
  agent: 'claude',
  workspaceId: 'repo1::/work/app',
  workspaceKind: 'git',
  accessMode: 'accept-edits'
}

type Appended = {
  sessionId: string
  identity: AgentJournalItemIdentity
  body: AgentJournalItemBody
}

describe('DelegationRequestService.request', () => {
  let db: OrchestrationDb
  let appended: Appended[]
  let deps: DelegationRequestDeps

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    appended = []
    deps = {
      getDb: () => db,
      requireDb: () => db,
      rows: {
        appendHostRow: vi.fn(async (sessionId, identity, body) => {
          appended.push({ sessionId, identity, body })
          return {
            cursor: { epoch: 'e', sequence: 1 },
            itemId: agentJournalItemKey(identity),
            revision: 1
          }
        })
      },
      readParent: (sessionId) => (sessionId === PARENT.sessionId ? PARENT : null),
      listAgents: async () => [
        { agent: 'claude', label: 'Claude' },
        { agent: 'codex', label: 'Codex' }
      ],
      readRateLimits: () => createEmptyRateLimitState({}),
      now: () => NOW
    }
  })

  afterEach(() => {
    db.close()
  })

  const input = {
    parentSessionId: PARENT.sessionId,
    summary: 'Read only audit of the parser module',
    prompt: 'Read src/parser and list every unsafe cast with file and line.',
    writes: false
  }

  it('files the request and returns without waiting for a choice', async () => {
    const receipt = await new DelegationRequestService(deps).request(input)

    expect(receipt).toEqual({
      requestId: expect.stringMatching(/^deleg_/),
      status: 'awaiting_choice',
      questionItemId: delegationQuestionItemId(receipt.requestId)
    })
    expect(db.getDelegationRequest(receipt.requestId)).toMatchObject({
      status: 'pending',
      parent_session_id: PARENT.sessionId,
      title: input.summary,
      prompt: input.prompt,
      writes: 0,
      workspace_kind: 'git',
      question_item_id: receipt.questionItemId
    })
  })

  it('posts one question an older client draws as it is, plus the typed payload', async () => {
    const { requestId } = await new DelegationRequestService(deps).request({
      ...input,
      title: 'Parser audit'
    })

    expect(appended).toHaveLength(1)
    const [card] = appended
    expect(card?.sessionId).toBe(PARENT.sessionId)
    expect(card?.identity).toEqual({ provider: 'orca', clientMessageId: `delegation:${requestId}` })
    const body = card?.body
    if (body?.kind !== 'question') {
      throw new Error('expected a question')
    }
    // What an older client reads: a question, its options, a pending resolution.
    expect(body.question).toBe('Which agent should handle this session?')
    expect(body.options.map((option) => option.label)).toEqual(['Automatic', 'Claude', 'Codex'])
    expect(body.resolution).toEqual({
      state: 'pending',
      selectedOptionId: null,
      resolvedBy: null,
      resolvedAt: null
    })
    expect(body.questions).toBeUndefined()
    expect(isAdmissibleAgentJournalItemBody(body)).toBe(true)
    // What a newer one reads.
    expect(isHostOwnedDelegationQuestion(body)).toBe(true)
    expect(readDelegationCardPayload(body.delegation)).toMatchObject({
      requestId,
      title: 'Parser audit',
      placement: 'current',
      decision: { agent: 'claude' }
    })
  })

  it('stores what Automatic would pick and the agents offered, for the answer to use later', async () => {
    const rateLimits = createEmptyRateLimitState({
      codex: {
        provider: 'codex',
        session: { usedPercent: 12, windowMinutes: 300, resetsAt: null, resetDescription: null },
        weekly: null,
        updatedAt: NOW - 1000,
        error: null,
        status: 'ok'
      }
    })
    const { requestId } = await new DelegationRequestService({
      ...deps,
      readRateLimits: () => rateLimits
    }).request(input)

    const row = db.getDelegationRequest(requestId)
    expect(JSON.parse(row?.decision_json ?? 'null')).toMatchObject({ agent: 'codex' })
    expect(JSON.parse(row?.options_json ?? 'null')).toEqual({
      agents: [
        { agent: 'claude', label: 'Claude' },
        { agent: 'codex', label: 'Codex' }
      ]
    })
  })

  it('places a child that writes code in a new worktree, or warns for a folder workspace', async () => {
    const service = new DelegationRequestService(deps)
    await service.request({ ...input, writes: true })
    const folder = new DelegationRequestService({
      ...deps,
      readParent: () => ({ ...PARENT, workspaceKind: 'folder' })
    })
    await folder.request({ ...input, writes: true })

    const payloads = appended.map(({ body }) =>
      body.kind === 'question' ? readDelegationCardPayload(body.delegation) : null
    )
    expect(payloads[0]).toMatchObject({ placement: 'new-child', placementWarning: null })
    expect(payloads[1]).toMatchObject({
      placement: 'current',
      placementWarning: 'folder-workspace-writes'
    })
  })

  it('refuses a chat this host does not hold, with no effects', async () => {
    await expect(
      new DelegationRequestService(deps).request({ ...input, parentSessionId: 'session_other' })
    ).rejects.toMatchObject({
      code: 'delegation_parent_unavailable',
      data: { effectsApplied: false }
    })
    expect(appended).toHaveLength(0)
  })

  it('refuses when no agent can start a chat in the workspace', async () => {
    await expect(
      new DelegationRequestService({ ...deps, listAgents: async () => [] }).request(input)
    ).rejects.toMatchObject({ code: 'delegation_no_agent', data: { effectsApplied: false } })
    expect(db.listDelegationRequestsByStatus('pending')).toEqual([])
  })

  it('fails the request when the card cannot be posted, so no half-open request is left', async () => {
    const failing: DelegationRequestDeps = {
      ...deps,
      rows: {
        ...deps.rows,
        appendHostRow: vi.fn(async () => {
          throw new Error('journal closed')
        })
      }
    }

    await expect(new DelegationRequestService(failing).request(input)).rejects.toThrow(
      'journal closed'
    )
    expect(db.listDelegationRequestsByStatus('pending')).toEqual([])
    expect(db.listDelegationRequestsByStatus('failed')).toHaveLength(1)
  })
})
