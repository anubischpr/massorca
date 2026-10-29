import { describe, expect, it } from 'vitest'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'

const none = {
  hasChatSession: false,
  showAgentHistory: false,
  hasSourceControl: false,
  showChecks: false
}

describe('resolveMobileSessionHeaderMenu', () => {
  it('offers the same chat items with a chat and without one, so every pane shows one menu', () => {
    const chatItems = {
      agentHistory: false,
      plan: true,
      summary: true,
      artifacts: true,
      prototypes: true,
      quickCommands: true
    }
    expect(resolveMobileSessionHeaderMenu({ ...none, hasChatSession: true }).chat).toEqual(
      chatItems
    )
    expect(resolveMobileSessionHeaderMenu(none).chat).toEqual(chatItems)
  })

  it('keeps the ⋯ button, since the chat items always apply', () => {
    expect(resolveMobileSessionHeaderMenu(none).showButton).toBe(true)
  })

  it('reports whether Plan, Summary and Artifacts have a chat to act on', () => {
    expect(resolveMobileSessionHeaderMenu({ ...none, hasChatSession: true }).hasChatSession).toBe(
      true
    )
    expect(resolveMobileSessionHeaderMenu(none).hasChatSession).toBe(false)
  })

  it('offers agent history only where the worktree has no chat', () => {
    // Beside a chat the Sessions sheet holds the resume row, so the menu stays the same in every pane.
    expect(
      resolveMobileSessionHeaderMenu({ ...none, showAgentHistory: true }).chat.agentHistory
    ).toBe(true)
    expect(
      resolveMobileSessionHeaderMenu({ ...none, hasChatSession: true, showAgentHistory: true }).chat
        .agentHistory
    ).toBe(false)
  })

  it('offers Branch only in git worktrees and Checks only when the hosted action applies', () => {
    expect(resolveMobileSessionHeaderMenu({ ...none, hasSourceControl: true }).environment).toEqual(
      { branch: true, checks: false }
    )
    expect(resolveMobileSessionHeaderMenu({ ...none, showChecks: true }).environment).toEqual({
      branch: false,
      checks: true
    })
  })
})
