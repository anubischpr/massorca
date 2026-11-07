import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { ALL_RPC_METHODS } from '.'
import { CHAT_RESULTS_METHODS } from './chat-results'
import {
  call,
  clearStructuredHostStub,
  hostCalls,
  installStructuredHostStub,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

function item(body: AgentJournalRenderItem['body'], sequence: number): AgentJournalRenderItem {
  return { itemId: `item-${sequence}`, sequence, revision: 1, observedAt: 100, body }
}

const items: AgentJournalRenderItem[] = [
  item(
    {
      kind: 'diff',
      path: 'src/a.ts',
      patch: { head: '', byteLength: 0, digest: 'd', truncated: false }
    },
    1
  ),
  item(
    {
      kind: 'tool-call',
      name: 'Bash',
      input: { command: 'pnpm dev' },
      state: 'completed',
      output: {
        head: 'ready on http://localhost:5173',
        byteLength: 30,
        digest: 'd',
        truncated: false
      }
    },
    2
  ),
  item(
    {
      kind: 'diff',
      path: 'src/b.ts',
      patch: { head: '', byteLength: 0, digest: 'd', truncated: false }
    },
    3
  ),
  item(
    {
      kind: 'diff',
      path: 'src/a.ts',
      patch: { head: '', byteLength: 0, digest: 'd', truncated: false }
    },
    4
  )
]

describe('chat.results', () => {
  beforeEach(() => {
    installStructuredHostStub()
    hostCalls.history?.mockReturnValue({ ok: true, page: { items, hasOlder: true } })
  })
  afterEach(() => clearStructuredHostStub())

  it('is registered with the runtime', () => {
    expect(ALL_RPC_METHODS.map((method) => method.name)).toContain('chat.results')
  })

  it("returns the session's environment URLs and changed files, newest first", async () => {
    const reply = await call(
      'chat.results',
      { sessionId: SESSION },
      STRUCTURED_CLIENT,
      {},
      CHAT_RESULTS_METHODS
    )
    expect(reply).toMatchObject({
      ok: true,
      result: {
        sessionId: SESSION,
        urls: [
          {
            url: 'http://localhost:5173',
            source: 'tool-output',
            itemId: 'item-2',
            loopback: true,
            previous: false
          }
        ],
        files: ['src/a.ts', 'src/b.ts'],
        hasOlder: true
      }
    })
    expect(hostCalls.history).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, direction: 'tail' }),
      'every-agent'
    )
  })

  it('rejects a call without a session id', async () => {
    const reply = await call('chat.results', {}, STRUCTURED_CLIENT, {}, CHAT_RESULTS_METHODS)
    expect(reply.ok).toBe(false)
  })
})
