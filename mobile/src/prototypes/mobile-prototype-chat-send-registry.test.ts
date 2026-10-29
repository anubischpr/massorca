import { describe, expect, it, vi } from 'vitest'
import {
  registerMobilePrototypeChatSend,
  sendToMobilePrototypeChat
} from './mobile-prototype-chat-send-registry'

describe('the chats that can take a prototype message', () => {
  it('sends through the chat that is on screen', async () => {
    const send = vi.fn(async (_text: string) => true)
    const unregister = registerMobilePrototypeChatSend('session-a', send)
    expect(await sendToMobilePrototypeChat('session-a', 'Iterate on B.')).toBe(true)
    expect(send).toHaveBeenCalledWith('Iterate on B.')
    unregister()
  })

  it('takes nothing for a chat that is not on screen', async () => {
    expect(await sendToMobilePrototypeChat('session-gone', 'Iterate on B.')).toBe(false)
  })

  it('stops sending once the chat leaves the screen, but not when a newer send replaced it', async () => {
    const first = vi.fn(async (_text: string) => true)
    const second = vi.fn(async (_text: string) => true)
    const leaveFirst = registerMobilePrototypeChatSend('session-b', first)
    const leaveSecond = registerMobilePrototypeChatSend('session-b', second)
    leaveFirst()
    expect(await sendToMobilePrototypeChat('session-b', 'x')).toBe(true)
    expect(second).toHaveBeenCalledTimes(1)
    leaveSecond()
    expect(await sendToMobilePrototypeChat('session-b', 'x')).toBe(false)
  })

  it('reads a send that throws as not sent', async () => {
    const unregister = registerMobilePrototypeChatSend('session-c', async () => {
      throw new Error('boom')
    })
    expect(await sendToMobilePrototypeChat('session-c', 'x')).toBe(false)
    unregister()
  })
})
