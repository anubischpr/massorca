import { describe, expect, it, vi } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../src/shared/native-chat-visual-annotate'
import { splitPrototypeHiddenInstruction } from '../../../src/shared/prototype-hidden-instruction'
import {
  createSetState,
  editSelected,
  pickElement,
  setNote,
  setPrompt,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import {
  beginSend,
  draftOf,
  sendRefused,
  sendSucceeded
} from '../../../src/shared/prototype-set-view'
import { registerMobilePrototypeChatSend } from './mobile-prototype-chat-send-registry'
import { sendMobilePrototypeIteration } from './mobile-prototype-iteration-send'
import { structuredSendResultFixture } from '../session/structured-agent-send-result.test-fixture'
import type { RpcClient } from '../transport/rpc-client'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const SET = listedSet({ requestId: 'req-1', sessionId: 'session-1' })
const CTA: NativeChatVisualPickedElement = {
  selector: 'button.cta',
  label: 'pay button',
  rect: { x: 10, y: 20, width: 120, height: 40 },
  state: {
    text: 'Pay now',
    color: '#ffffff',
    bg: '#171717',
    width: { value: 100, unit: '%' },
    height: { value: 48, unit: 'px' },
    fontSize: 14
  }
}
const PROMPT = 'Fold email into the card step.'

function draftedState(): PrototypeSetState {
  let state = pickElement(createSetState(['A', 'B', 'C']), CTA)
  state = editSelected(state, { bg: '#1d4ed8', height: { value: 40, unit: 'px' } })
  state = setNote(state, 'Make it pulse.')
  return setPrompt(state, PROMPT)
}

function hostClient(): {
  client: RpcClient
  sendRequest: ReturnType<typeof vi.fn<RpcClient['sendRequest']>>
} {
  const sendRequest = vi.fn<RpcClient['sendRequest']>(async (method) => {
    if (method === 'agentSession.history') {
      return {
        ok: true,
        id: '1',
        result: {
          ok: true,
          page: {
            sessionId: 'session-1',
            epoch: 'e',
            fence: 4,
            direction: 'tail',
            items: [],
            removedItemIds: [],
            submissions: [],
            window: { oldest: null, newest: null, nextCursor: { epoch: 'e', sequence: 0 } },
            hasOlder: false,
            hasNewer: false
          }
        }
      }
    }
    return {
      ok: true,
      id: '2',
      result: { ok: true, value: structuredSendResultFixture('dispatched') }
    }
  })
  return {
    sendRequest,
    client: {
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
  }
}

describe('sendMobilePrototypeIteration', () => {
  it('sends the whole draft to the chat as one message, with the hidden instruction for the next file', async () => {
    const send = vi.fn(async (_text: string) => true)
    const unregister = registerMobilePrototypeChatSend('session-1', send)
    const outcome = await sendMobilePrototypeIteration(draftedState(), SET, null)
    unregister()

    expect(outcome.sent).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const [text = ''] = send.mock.calls[0] ?? []
    const split = splitPrototypeHiddenInstruction(text)
    expect(split.visibleText).toBe(outcome.visibleMessage)
    expect(split.hidden).toEqual({ kind: 'iteration', requestId: 'req-1', letter: 'A' })
    expect(outcome.visibleMessage).toContain('Iterate on A.')
    expect(outcome.visibleMessage).toContain('fill: #171717 → #1d4ed8')
    expect(outcome.visibleMessage).toContain('note: Make it pulse.')
    expect(outcome.visibleMessage).toContain(PROMPT)
    expect(outcome.visibleMessage).not.toContain('screenshot:')
    expect(text).toContain('A-v2.html')
  })

  it('sends to the own chat of the set through the host when that chat is not on screen', async () => {
    const { client, sendRequest } = hostClient()
    const outcome = await sendMobilePrototypeIteration(draftedState(), SET, client)
    expect(outcome.sent).toBe(true)
    const send = sendRequest.mock.calls.find(([method]) => method === 'agentSession.send')
    expect(send?.[1]).toMatchObject({
      envelope: { sessionId: 'session-1', expectedRuntimeFence: 4 }
    })
    expect(JSON.stringify(send?.[1])).toContain('Iterate on A.')
  })

  it('prefers the chat on screen over the host, so the message goes once', async () => {
    const { client, sendRequest } = hostClient()
    const send = vi.fn(async (_text: string) => true)
    const unregister = registerMobilePrototypeChatSend('session-1', send)
    const outcome = await sendMobilePrototypeIteration(draftedState(), SET, client)
    unregister()
    expect(outcome.sent).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(sendRequest).not.toHaveBeenCalled()
  })

  it('keeps the draft and reports a real failure when the host refuses the chat', async () => {
    const { client, sendRequest } = hostClient()
    sendRequest.mockResolvedValue({
      ok: false,
      id: '3',
      error: { code: 'forbidden', message: 'no' }
    })
    const before = draftedState()
    const outcome = await sendMobilePrototypeIteration(before, SET, client)
    expect(outcome.sent).toBe(false)
    expect(sendRefused(beginSend(before)).sendFailed).toBe(true)
  })

  it('keeps the draft when the chat is not on screen', async () => {
    const before = draftedState()
    const outcome = await sendMobilePrototypeIteration(before, SET, null)
    expect(outcome.sent).toBe(false)
    const after = sendRefused(beginSend(before))
    expect(after.sendFailed).toBe(true)
    expect(draftOf(after).itemCount).toBe(draftOf(before).itemCount)
    expect(after.prompt).toBe(PROMPT)
  })

  it('clears the draft and shows what went out once the chat took it', async () => {
    const unregister = registerMobilePrototypeChatSend('session-1', async () => true)
    const before = draftedState()
    const outcome = await sendMobilePrototypeIteration(before, SET, null)
    unregister()
    const after = sendSucceeded(beginSend(before), outcome.visibleMessage)
    expect(draftOf(after).itemCount).toBe(0)
    expect(after.sentMessage).toBe(outcome.visibleMessage)
    expect(after.sendFailed).toBe(false)
  })

  it('does not send a set that has no folder on the host', async () => {
    const send = vi.fn(async (_text: string) => true)
    const unregister = registerMobilePrototypeChatSend('session-1', send)
    const outcome = await sendMobilePrototypeIteration(
      draftedState(),
      {
        ...SET,
        folderPath: undefined
      },
      null
    )
    unregister()
    expect(outcome.sent).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
})
