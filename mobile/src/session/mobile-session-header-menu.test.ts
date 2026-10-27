import { describe, expect, it } from 'vitest'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'

const none = {
  showNativeChat: false,
  showAgentHistory: false,
  hasSourceControl: false,
  showChecks: false
}

describe('resolveMobileSessionHeaderMenu', () => {
  it('hides the ⋯ button when no item applies', () => {
    expect(resolveMobileSessionHeaderMenu(none).showButton).toBe(false)
  })

  it('offers the chat items in a folder workspace, where there is no source control', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, showNativeChat: true })
    expect(menu.showButton).toBe(true)
    expect(menu.chat).toEqual({
      sessions: true,
      agentHistory: false,
      plan: true,
      summary: true,
      artifacts: true
    })
    expect(menu.environment).toEqual({ branch: false, checks: false })
  })

  it('offers the plan beside any native chat, so the sheet can say no plan exists yet', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, showNativeChat: true })
    expect(menu.chat.plan).toBe(true)
  })

  it('never offers the plan without a native chat', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, hasSourceControl: true })
    expect(menu.chat.plan).toBe(false)
  })

  it('keeps the environment items on a git terminal without a chat', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, hasSourceControl: true })
    expect(menu.showButton).toBe(true)
    expect(menu.chat).toEqual({
      sessions: false,
      agentHistory: false,
      plan: false,
      summary: false,
      artifacts: false
    })
    expect(menu.environment).toEqual({ branch: true, checks: false })
  })

  it('offers agent history without a native chat, where the Sessions sheet cannot open', () => {
    const menu = resolveMobileSessionHeaderMenu({
      ...none,
      hasSourceControl: true,
      showAgentHistory: true
    })
    expect(menu.showButton).toBe(true)
    expect(menu.chat).toEqual({
      sessions: false,
      agentHistory: true,
      plan: false,
      summary: false,
      artifacts: false
    })
  })

  it('leaves agent history to the Sessions sheet beside a native chat', () => {
    const menu = resolveMobileSessionHeaderMenu({
      ...none,
      showNativeChat: true,
      hasSourceControl: true,
      showAgentHistory: true
    })
    expect(menu.chat.sessions).toBe(true)
    expect(menu.chat.agentHistory).toBe(false)
  })

  it('keeps Checks with its own rule, and only Checks, when it applies alone', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, showChecks: true })
    expect(menu.showButton).toBe(true)
    expect(menu.environment).toEqual({ branch: false, checks: true })
  })
})
