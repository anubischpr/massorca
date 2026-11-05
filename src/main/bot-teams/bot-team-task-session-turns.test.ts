import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  host: null as unknown,
  outcome: { kind: 'sent', clientMessageId: 'm1', submission: { dispatchState: 'accepted' } } as {
    kind: string
    submission?: { dispatchState: string }
  },
  sends: [] as unknown[]
}))

vi.mock('../native-chat/agent-session-wire/structured-agent-session-registry', () => ({
  getStructuredAgentSessionHost: () => state.host
}))
vi.mock('../runtime/orchestration/send-agent-turn', () => ({
  sendAgentTurn: async (send: unknown) => {
    state.sends.push(send)
    return state.outcome
  }
}))

import { readBotTeamSessionReply, sendBotTeamTaskFollowUp } from './bot-team-task-session-turns'

function fakeHost(fence: number | undefined) {
  return {
    journalSnapshot: async () => ({
      items: [
        {
          itemId: 'a',
          revision: 1,
          sequence: 1,
          observedAt: 1,
          body: {
            kind: 'message',
            role: 'assistant',
            blocks: [{ type: 'text', text: 'Which tab?' }]
          }
        }
      ]
    }),
    deps: {
      store: {
        getRecord: () => (fence === undefined ? undefined : { lease: { runtimeFence: fence } })
      }
    }
  }
}

describe('a bot task’s session turns', () => {
  beforeEach(() => {
    state.sends = []
    state.outcome = { kind: 'sent', submission: { dispatchState: 'accepted' } }
    state.host = fakeHost(4)
  })

  it('reads the last reply of the bot from the host that holds the session', async () => {
    expect(await readBotTeamSessionReply('s1')).toBe('Which tab?')
    state.host = null
    expect(await readBotTeamSessionReply('s1')).toBeNull()
  })

  it('sends the answer as the session’s next turn, on its current fence', async () => {
    expect(await sendBotTeamTaskFollowUp('s1', 'This one')).toBe(true)

    expect(state.sends).toHaveLength(1)
    expect(state.sends[0]).toMatchObject({
      kind: 'structured-session',
      sessionId: 's1',
      turn: { expectedRuntimeFence: 4, delivery: 'queue' }
    })
  })

  it('reports the answer as not taken when the host refuses it or holds no such session', async () => {
    state.outcome = { kind: 'refused' }
    expect(await sendBotTeamTaskFollowUp('s1', 'This one')).toBe(false)

    state.outcome = { kind: 'sent', submission: { dispatchState: 'rejected' } }
    expect(await sendBotTeamTaskFollowUp('s1', 'This one')).toBe(false)

    state.host = fakeHost(undefined)
    expect(await sendBotTeamTaskFollowUp('s1', 'This one')).toBe(false)

    state.host = null
    expect(await sendBotTeamTaskFollowUp('s1', 'This one')).toBe(false)
  })
})
