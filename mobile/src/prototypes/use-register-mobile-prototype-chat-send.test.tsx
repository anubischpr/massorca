import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { sendToMobilePrototypeChat } from './mobile-prototype-chat-send-registry'
import {
  sendThroughLatestChat,
  useRegisterMobilePrototypeChatSend
} from './use-register-mobile-prototype-chat-send'

type Chat = { sessionId: string; send: (text: string) => Promise<boolean> } | null

function Chat({ chat }: { chat: Chat }) {
  useRegisterMobilePrototypeChatSend(chat)
  return null
}

function sender(accepts: boolean) {
  return vi.fn((_text: string) => Promise.resolve(accepts))
}

function render(chat: Chat): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(createElement(Chat, { chat }))
  })
  if (renderer === undefined) {
    throw new Error('the chat did not mount')
  }
  return renderer
}

function update(renderer: ReactTestRenderer, chat: Chat): void {
  act(() => {
    renderer.update(createElement(Chat, { chat }))
  })
}

describe('the chat on screen takes the Prototypes sends', () => {
  it('sends through the chat it is registered for, and the latest send of that chat', async () => {
    const first = sender(true)
    const second = sender(false)
    const renderer = render({ sessionId: 'session-1', send: first })
    update(renderer, { sessionId: 'session-1', send: second })

    await expect(sendToMobilePrototypeChat('session-1', 'Iterate on B.')).resolves.toBe(false)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('Iterate on B.')
  })

  it('never delivers a send registered for one session to another session’s chat', async () => {
    const other = sender(true)
    await expect(
      sendThroughLatestChat({ sessionId: 'session-2', send: other }, 'session-1', 'x')
    ).resolves.toBe(false)
    expect(other).not.toHaveBeenCalled()
    await expect(sendThroughLatestChat(null, 'session-1', 'x')).resolves.toBe(false)
    const own = sender(true)
    await expect(
      sendThroughLatestChat({ sessionId: 'session-1', send: own }, 'session-1', 'x')
    ).resolves.toBe(true)
    expect(own).toHaveBeenCalledWith('x')
  })

  it('takes nothing for a chat that is no longer on screen, and for none after unmount', async () => {
    const send = sender(true)
    const renderer = render({ sessionId: 'session-1', send })
    update(renderer, null)
    await expect(sendToMobilePrototypeChat('session-1', 'x')).resolves.toBe(false)
    expect(send).not.toHaveBeenCalled()

    update(renderer, { sessionId: 'session-2', send })
    await expect(sendToMobilePrototypeChat('session-2', 'x')).resolves.toBe(true)
    act(() => {
      renderer.unmount()
    })
    await expect(sendToMobilePrototypeChat('session-2', 'x')).resolves.toBe(false)
  })
})
