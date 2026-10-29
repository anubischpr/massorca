import { describe, expect, it } from 'vitest'
import { chatSessionTargetOf } from './mobile-chat-session-target'
import type { MobileSessionTab } from './mobile-session-route-types'

function chat(id: string): MobileSessionTab {
  return {
    type: 'agent-session',
    id,
    title: 'Fix the parser',
    sessionId: `session-${id}`,
    agent: 'claude',
    isActive: false
  }
}

function shell(id: string): MobileSessionTab {
  return { type: 'terminal', id, title: 'zsh', terminal: `handle-${id}`, isActive: false }
}

describe('chatSessionTargetOf', () => {
  it('is the active chat when a chat is the active tab', () => {
    expect(chatSessionTargetOf([shell('t1'), chat('c1'), chat('c2')], chat('c2'))?.id).toBe('c2')
  })

  it('is the first chat from another pane, as the Chat segment returns to', () => {
    expect(chatSessionTargetOf([shell('t1'), chat('c1'), chat('c2')], shell('t1'))?.id).toBe('c1')
    expect(chatSessionTargetOf([shell('t1'), chat('c1')], null)?.id).toBe('c1')
  })

  it('is null when the worktree has no chat', () => {
    expect(chatSessionTargetOf([shell('t1')], shell('t1'))).toBeNull()
  })
})
