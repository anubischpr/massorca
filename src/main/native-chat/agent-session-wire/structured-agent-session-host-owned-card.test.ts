// A delegated session's agent-choice card is the host's own question: it is written into a real
// chat's journal and must survive what provider questions do not (a child's end, a new child, a
// restart), and must not hold the chat back the way a question a provider waits on does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalRenderItem } from '../../../shared/agent-session-journal-types'
import {
  delegationQuestionItemId,
  delegationQuestionRowIdentity,
  readDelegationCardPayload,
  type DelegationCardPayload
} from '../../../shared/delegated-session-journal'
import {
  collectSubscriber,
  createRestTestRig,
  foundRestTestChat,
  IDLE_MS,
  REST_TEST_CALLER as CALLER,
  REST_TEST_SESSION as SESSION,
  restTestSend,
  sweepOnce,
  type RestTestRig
} from './structured-agent-session-rest-test-rig'
import { structuredAgentSessionHostRows } from './structured-agent-session-host-rows'
import { pendingPromptExists } from './structured-agent-session-queued-messages'

const REQUEST = 'deleg_aaaaaaaaaaaa'

const PAYLOAD: DelegationCardPayload = {
  requestId: REQUEST,
  title: 'Parser audit',
  decision: null,
  agents: [],
  placement: 'current',
  placementWarning: null
}

let rig: RestTestRig

beforeEach(async () => {
  rig = await createRestTestRig()
})

afterEach(async () => {
  // Windows holds the SQLite journal open for a moment after the host stops; a temp dir left behind is harmless.
  await rig.dispose().catch((error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes('EBUSY')) {
      throw error
    }
  })
})

async function postCard(host = rig.host): Promise<void> {
  await structuredAgentSessionHostRows(host).appendHostRow(SESSION, delegationQuestionRowIdentity(REQUEST), {
    kind: 'question',
    question: 'Which agent should handle this session?',
    options: [
      { id: 'automatic', label: 'Automatic' },
      { id: 'agent:codex', label: 'Codex', description: '34% used' }
    ],
    delegation: PAYLOAD,
    resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
  })
}

async function card(host = rig.host): Promise<AgentJournalRenderItem | undefined> {
  const snapshot = await host.journalSnapshot(SESSION)
  return snapshot.items.find((item) => item.itemId === delegationQuestionItemId(REQUEST))
}

describe('the host-owned agent-choice card', () => {
  it('reaches a reader with its options and its typed payload intact', async () => {
    await foundRestTestChat(rig)
    const reader = collectSubscriber()
    await rig.host.subscribe({ id: 'reader', sessionId: SESSION, emit: reader.emit })

    await postCard()

    await vi.waitFor(async () => expect(await card()).toBeDefined())
    const body = (await card())?.body
    expect(body).toMatchObject({
      kind: 'question',
      options: [{ id: 'automatic' }, { id: 'agent:codex', description: '34% used' }],
      resolution: { state: 'pending' }
    })
    expect(body?.kind === 'question' && readDelegationCardPayload(body.delegation)).toMatchObject(
      PAYLOAD
    )
    await vi.waitFor(() => {
      const published = reader.events.flatMap((event) =>
        event.type === 'batch' ? event.batch.items : []
      )
      expect(published.some((item) => item.itemId === delegationQuestionItemId(REQUEST))).toBe(true)
    })
  })

  it('stays pending when the agent is put to rest and a new one starts', async () => {
    await foundRestTestChat(rig)
    await postCard()
    rig.clock.now += IDLE_MS + 1

    await vi.waitFor(() => expect(rig.adapter.closeSession).toHaveBeenCalledWith(SESSION))
    await vi.waitFor(() => expect(rig.store.getRecord(SESSION)?.lease.claimStatus).toBe('released'))
    const sent = await rig.host.send(
      CALLER,
      restTestSend('carry on', rig.store.getRecord(SESSION)?.lease.runtimeFence ?? 1)
    )
    expect(sent.ok).toBe(true)
    await vi.waitFor(() => expect(rig.adapter.acquire).toHaveBeenCalledTimes(2))

    expect((await card())?.body).toMatchObject({ resolution: { state: 'pending' } })
  })

  it('does not keep an otherwise idle agent running', async () => {
    await foundRestTestChat(rig)
    await postCard()
    rig.clock.now += IDLE_MS + 1

    await sweepOnce(rig.host)

    await vi.waitFor(() => expect(rig.adapter.closeSession).toHaveBeenCalledWith(SESSION))
  })

  it('is not a prompt the message queue waits on', async () => {
    await foundRestTestChat(rig)
    await postCard()

    const { journal } = await rig.host.collaboratorsForTests().lifetime.conversation(SESSION)
    expect(pendingPromptExists(journal)).toBe(false)
  })

  it('is still pending, with its payload, after the host restarts', async () => {
    await foundRestTestChat(rig)
    await postCard()

    const restarted = await rig.restart()

    const reopened = await card(restarted)
    expect(reopened?.body).toMatchObject({ kind: 'question', resolution: { state: 'pending' } })
    expect(
      reopened?.body.kind === 'question' && readDelegationCardPayload(reopened.body.delegation)
    ).toMatchObject({ requestId: REQUEST, title: 'Parser audit' })
  })
})
