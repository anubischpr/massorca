import { describe, expect, it } from 'vitest'
import {
  beginChatTransition,
  chatTransitionKeyForSession,
  chatTransitionKeyForTerminalTab,
  isChatTransitionPending,
  runChatTransition
} from './structured-chat-transition-guard'

describe('chat transition guard', () => {
  it('refuses a second switch for a key until the first is released', () => {
    const key = chatTransitionKeyForSession('chat-a')
    const release = beginChatTransition([key])

    expect(release).not.toBeNull()
    expect(isChatTransitionPending(key)).toBe(true)
    expect(beginChatTransition([key])).toBeNull()

    release?.()
    release?.()
    expect(isChatTransitionPending(key)).toBe(false)
    expect(beginChatTransition([key])).not.toBeNull()
  })

  it('takes every key or none', () => {
    const chat = chatTransitionKeyForSession('chat-b')
    const tab = chatTransitionKeyForTerminalTab('tab-b')
    const release = beginChatTransition([chat])

    expect(beginChatTransition([tab, chat])).toBeNull()
    expect(isChatTransitionPending(tab)).toBe(false)
    release?.()
  })

  it('runs one of several simultaneous switches and releases after a throw', async () => {
    const key = chatTransitionKeyForSession('chat-c')
    let runs = 0
    let finish: () => void = () => {}
    const first = runChatTransition([key], () => {
      runs += 1
      return new Promise<void>((resolve) => {
        finish = resolve
      })
    })

    await expect(runChatTransition([key], async () => (runs += 1))).resolves.toBeUndefined()
    finish()
    await first
    expect(runs).toBe(1)

    await expect(
      runChatTransition([key], async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(isChatTransitionPending(key)).toBe(false)
  })
})
