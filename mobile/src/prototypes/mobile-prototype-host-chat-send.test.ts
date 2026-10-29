import { describe, expect, it, vi } from 'vitest'
import { structuredSendResultFixture } from '../session/structured-agent-send-result.test-fixture'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import { sendToStructuredSessionOnHost } from './mobile-prototype-host-chat-send'

type Send = RpcClient['sendRequest']

const ok = (result: unknown): RpcResponse => ({ ok: true, result, id: 'rpc-1' })
const failed = (code: string, message = 'nope'): RpcResponse => ({
  ok: false,
  error: { code, message },
  id: 'rpc-1'
})

function historyPage(fence: number | undefined) {
  return {
    ok: true,
    page: {
      sessionId: 'session-1',
      epoch: 'epoch-1',
      ...(fence === undefined ? {} : { fence }),
      direction: 'tail',
      items: [],
      removedItemIds: [],
      submissions: [],
      window: { oldest: null, newest: null, nextCursor: { epoch: 'epoch-1', sequence: 0 } },
      hasOlder: false,
      hasNewer: false
    }
  }
}

/** A host that answers history with `history` and send with `send`; each is a response or a throw. */
function host(answers: { history: RpcResponse | Error; send?: RpcResponse | Error }): {
  client: RpcClient
  sendRequest: ReturnType<typeof vi.fn<Send>>
} {
  const sendRequest = vi.fn<Send>((method) => {
    const answer = method === 'agentSession.history' ? answers.history : answers.send
    if (answer === undefined) {
      return Promise.reject(new Error(`unexpected ${method}`))
    }
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
  })
  const client: RpcClient = {
    sendRequest,
    subscribe: () => () => {},
    updateTerminalSubscriptionViewport: () => {},
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => null,
    onStateChange: () => () => {},
    notifyForeground: () => {},
    close: () => {}
  }
  return { client, sendRequest }
}

const accepted = ok({ ok: true, value: structuredSendResultFixture('accepted') })

describe('sendToStructuredSessionOnHost', () => {
  it('reads the chat fence, then sends the message to that chat through the host', async () => {
    const { client, sendRequest } = host({ history: ok(historyPage(7)), send: accepted })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'Iterate on B.')).toBe(true)

    const [method, params] = sendRequest.mock.calls[1] ?? []
    expect(method).toBe('agentSession.send')
    expect(params).toMatchObject({
      envelope: { sessionId: 'session-1', expectedRuntimeFence: 7 },
      body: { role: 'user', blocks: [{ type: 'text', text: 'Iterate on B.' }] }
    })
  })

  it('takes a send the host holds as a queued draft as sent', async () => {
    const queued = ok({
      ok: true,
      value: { clientMessageId: 'msg-1', queued: { state: 'queued', messageId: 'msg-1' } }
    })
    const { client } = host({ history: ok(historyPage(7)), send: queued })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(true)
  })

  it('does not send when the host names no fence for the chat', async () => {
    const { client, sendRequest } = host({ history: ok(historyPage(undefined)), send: accepted })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(false)
    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('takes the page fence of a reset history before the reset fence, as desktop does', async () => {
    const reset = ok({ ok: false, reset: 'journal_gap', page: historyPage(7).page, fence: 9 })
    const { client, sendRequest } = host({ history: reset, send: accepted })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(true)
    expect(sendRequest.mock.calls[1]?.[1]).toMatchObject({
      envelope: { expectedRuntimeFence: 7 }
    })
  })

  it('takes the fence a reset names when its page names none', async () => {
    const reset = ok({
      ok: false,
      reset: 'journal_gap',
      page: historyPage(undefined).page,
      fence: 9
    })
    const { client, sendRequest } = host({ history: reset, send: accepted })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(true)
    expect(sendRequest.mock.calls[1]?.[1]).toMatchObject({
      envelope: { expectedRuntimeFence: 9 }
    })
  })

  it('reads a refusal as not sent', async () => {
    const refusal = ok({
      ok: false,
      refusal: { code: 'agent_session_not_found', message: 'gone' }
    })
    const { client } = host({ history: ok(historyPage(7)), send: refusal })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(false)
  })

  it('reads a chat the host cannot read as not sent, without sending', async () => {
    const { client, sendRequest } = host({ history: failed('forbidden') })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(false)
    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('reads a transport failure on either call as not sent', async () => {
    const readFails = host({ history: new Error('offline') })
    expect(await sendToStructuredSessionOnHost(readFails.client, 'session-1', 'x')).toBe(false)
    const sendFails = host({ history: ok(historyPage(7)), send: new Error('offline') })
    expect(await sendToStructuredSessionOnHost(sendFails.client, 'session-1', 'x')).toBe(false)
  })

  it('does not call a message sent when the host lost the answer', async () => {
    const lost = ok({
      ok: true,
      value: { ...structuredSendResultFixture('unknown'), clientMessageId: 'msg-1' }
    })
    const { client } = host({ history: ok(historyPage(7)), send: lost })
    expect(await sendToStructuredSessionOnHost(client, 'session-1', 'x')).toBe(false)
  })
})
