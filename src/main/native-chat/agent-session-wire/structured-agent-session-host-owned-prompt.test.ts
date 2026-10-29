// An answer or a Cancel of a host-owned question (a delegated session's agent choice) goes to the
// host's own resolver and never to the provider adapter, whether or not the chat has an agent
// running, and survives a host restart.

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { computeAgentSessionPayloadFingerprint } from '../../../shared/agent-session-mutation-envelope'
import {
  delegationQuestionItemId,
  delegationQuestionRowIdentity
} from '../../../shared/delegated-session-journal'
import type { AgentSessionMutationEnvelope } from '../../../shared/agent-session-wire'
import { hostTestOperationId } from './structured-agent-session-host-test-data'
import { structuredAgentSessionHostRows } from './structured-agent-session-host-rows'
import type {
  StructuredAgentSessionHostOwnedPrompts,
  StructuredAgentSessionHostOwnedPromptOutcome
} from './structured-agent-session-host-owned-prompts'
import type { StructuredAgentSessionHost } from './structured-agent-session-host'
import {
  createRestTestRig,
  foundRestTestChat,
  IDLE_MS,
  REST_TEST_CALLER as CALLER,
  REST_TEST_SESSION as SESSION,
  type RestTestRig
} from './structured-agent-session-rest-test-rig'

const REQUEST = 'deleg_aaaaaaaaaaaa'
const ITEM_ID = delegationQuestionItemId(REQUEST)

type Resolver = {
  answer: Mock<StructuredAgentSessionHostOwnedPrompts['answer']>
  cancel: Mock<StructuredAgentSessionHostOwnedPrompts['cancel']>
  afterCommit: Mock<() => void>
}

function resolver(): Resolver & { prompts: StructuredAgentSessionHostOwnedPrompts } {
  const afterCommit = vi.fn()
  const accepted = async (): Promise<StructuredAgentSessionHostOwnedPromptOutcome> => ({
    ok: true,
    afterCommit
  })
  const answer = vi.fn(accepted)
  const cancel = vi.fn(accepted)
  return { answer, cancel, afterCommit, prompts: { answer, cancel } }
}

let rig: RestTestRig
let owned: ReturnType<typeof resolver>

beforeEach(async () => {
  owned = resolver()
  rig = await createRestTestRig({ hostOwnedPrompts: owned.prompts })
})

afterEach(async () => {
  // Windows holds the SQLite journal open for a moment after the host stops; a temp dir left behind is harmless.
  await rig.dispose().catch((error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes('EBUSY')) {
      throw error
    }
  })
})

function envelope(method: string, fields: Record<string, unknown>): AgentSessionMutationEnvelope {
  return {
    sessionId: SESSION,
    clientOperationId: hostTestOperationId(),
    expectedRuntimeFence: rig.store.getRecord(SESSION)?.lease.runtimeFence ?? 1,
    payloadFingerprint: computeAgentSessionPayloadFingerprint({
      method,
      sessionId: SESSION,
      fields
    })
  }
}

async function postCard(host = rig.host): Promise<number> {
  const posted = await structuredAgentSessionHostRows(host).appendHostRow(
    SESSION,
    delegationQuestionRowIdentity(REQUEST),
    {
      kind: 'question',
      question: 'Which agent should handle this session?',
      options: [
        { id: 'automatic', label: 'Automatic' },
        { id: 'agent:codex', label: 'Codex' }
      ],
      delegation: {
        requestId: REQUEST,
        title: 'Parser audit',
        decision: null,
        agents: [],
        placement: 'current',
        placementWarning: null
      },
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    }
  )
  return posted.revision
}

function answer(
  revision: number,
  optionId: string,
  host: StructuredAgentSessionHost = rig.host
): ReturnType<StructuredAgentSessionHost['respondToPrompt']> {
  const fields = { itemId: ITEM_ID, expectedRevision: revision, optionId }
  return host.respondToPrompt(CALLER, {
    envelope: envelope('agentSession.respondTo:question', fields),
    kind: 'question',
    ...fields
  })
}

function cancel(
  revision: number,
  host: StructuredAgentSessionHost = rig.host
): ReturnType<StructuredAgentSessionHost['cancel']> {
  const fields = { prompt: { itemId: ITEM_ID, expectedRevision: revision } }
  return host.cancel(CALLER, { envelope: envelope('agentSession.cancel', fields), ...fields })
}

async function card(host = rig.host) {
  return (await host.journalSnapshot(SESSION)).items.find((item) => item.itemId === ITEM_ID)
}

/** Puts the chat's agent to rest, as the idle sweep does after the idle window. */
async function restAgent(): Promise<void> {
  rig.clock.now += IDLE_MS + 1
  await vi.waitFor(() => expect(rig.adapter.closeSession).toHaveBeenCalledWith(SESSION))
  await vi.waitFor(() => expect(rig.store.getRecord(SESSION)?.lease.claimStatus).toBe('released'))
}

describe('answering a host-owned question', () => {
  it('resolves it through the host’s resolver and never through the provider adapter', async () => {
    await foundRestTestChat(rig)
    const answerPrompt = vi.spyOn(rig.host.deps.adapter, 'answerPrompt')
    const revision = await postCard()

    const result = await answer(revision, 'agent:codex')

    expect(result).toMatchObject({
      ok: true,
      value: { resolution: { state: 'resolved', selectedOptionId: 'agent:codex' } }
    })
    expect(owned.answer).toHaveBeenCalledWith({
      sessionId: SESSION,
      itemId: ITEM_ID,
      optionId: 'agent:codex'
    })
    expect(answerPrompt).not.toHaveBeenCalled()
    expect((await card())?.body).toMatchObject({
      resolution: { state: 'resolved', selectedOptionId: 'agent:codex' }
    })
  })

  it('keeps the card’s typed payload on the resolved item', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()

    await answer(revision, 'automatic')

    expect((await card())?.body).toMatchObject({
      delegation: { requestId: REQUEST, title: 'Parser audit' }
    })
  })

  it('runs what the answer starts only after its resolution is in the journal', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    let resolvedWhenStarted: string | undefined
    owned.afterCommit.mockImplementation(() => {
      void card().then((item) => {
        resolvedWhenStarted =
          item?.body.kind === 'question' ? item.body.resolution.state : undefined
      })
    })

    await answer(revision, 'automatic')

    expect(owned.afterCommit).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(resolvedWhenStarted).toBe('resolved'))
  })

  it('answers a repeat of the same choice from the resolution, without asking the resolver again', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    const first = await answer(revision, 'agent:codex')

    // The reply was lost, so the client sends the revision it saw.
    const again = await answer(revision, 'agent:codex')

    expect(first.ok && again.ok).toBe(true)
    expect(owned.answer).toHaveBeenCalledOnce()
  })

  it('refuses another choice once one was taken', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    await answer(revision, 'agent:codex')

    const other = await answer(revision, 'automatic')

    expect(other).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_item_revision_stale' }
    })
    expect(owned.answer).toHaveBeenCalledOnce()
  })

  it('refuses an option the card does not carry before the resolver is asked', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()

    const result = await answer(revision, 'agent:grok')

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_invalid' }
    })
    expect(owned.answer).not.toHaveBeenCalled()
  })

  it('leaves the card pending when the resolver refuses', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    owned.answer.mockResolvedValueOnce({
      ok: false,
      reason: 'promptGone',
      message: 'The request was settled.'
    })

    const result = await answer(revision, 'automatic')

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_invalid' }
    })
    expect((await card())?.body).toMatchObject({ resolution: { state: 'pending' } })
    expect(owned.afterCommit).not.toHaveBeenCalled()
  })

  it('is refused, not sent to a provider, by a host that has no resolver', async () => {
    await rig.dispose().catch(() => undefined)
    rig = await createRestTestRig({})
    await foundRestTestChat(rig)
    const answerPrompt = vi.spyOn(rig.host.deps.adapter, 'answerPrompt')
    const revision = await postCard()

    const result = await answer(revision, 'automatic')

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_invalid' }
    })
    expect(answerPrompt).not.toHaveBeenCalled()
    expect((await card())?.body).toMatchObject({ resolution: { state: 'pending' } })
  })

  it('works while the chat’s agent is at rest, and does not start it', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    await restAgent()
    const starts = rig.adapter.acquire.mock.calls.length

    const result = await answer(revision, 'agent:codex')

    expect(result.ok).toBe(true)
    expect(owned.answer).toHaveBeenCalledOnce()
    expect(rig.adapter.acquire).toHaveBeenCalledTimes(starts)
  })

  it('works after the host restarts', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    const restarted = await rig.restart({ hostOwnedPrompts: owned.prompts })

    const result = await answer(revision, 'agent:codex', restarted)

    expect(result).toMatchObject({
      ok: true,
      value: { resolution: { selectedOptionId: 'agent:codex' } }
    })
    expect(owned.answer).toHaveBeenCalledOnce()
    expect((await card(restarted))?.body).toMatchObject({ resolution: { state: 'resolved' } })
  })
})

describe('cancelling a host-owned question', () => {
  it('cancels the card through the resolver and leaves the chat’s turn alone', async () => {
    await foundRestTestChat(rig)
    const cancelTurn = vi.spyOn(rig.host.deps.adapter, 'cancelTurn')
    const revision = await postCard()

    const result = await cancel(revision)

    expect(result).toMatchObject({ ok: true, value: { cancelled: true } })
    expect(owned.cancel).toHaveBeenCalledWith({ sessionId: SESSION, itemId: ITEM_ID })
    expect(cancelTurn).not.toHaveBeenCalled()
    expect((await card())?.body).toMatchObject({ resolution: { state: 'cancelled' } })
  })

  it('works while the chat’s agent is at rest', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    await restAgent()

    const result = await cancel(revision)

    expect(result).toMatchObject({ ok: true, value: { cancelled: true } })
    expect((await card())?.body).toMatchObject({ resolution: { state: 'cancelled' } })
  })

  it('answers a second Cancel quietly', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    await cancel(revision)

    const again = await cancel(revision)

    expect(again).toMatchObject({ ok: true, value: { cancelled: false } })
    expect(owned.cancel).toHaveBeenCalledOnce()
  })

  it('leaves the card pending when the resolver refuses', async () => {
    await foundRestTestChat(rig)
    const revision = await postCard()
    owned.cancel.mockResolvedValueOnce({
      ok: false,
      reason: 'promptGone',
      message: 'Already answered.'
    })

    const result = await cancel(revision)

    expect(result).toMatchObject({ ok: false })
    expect((await card())?.body).toMatchObject({ resolution: { state: 'pending' } })
  })
})
