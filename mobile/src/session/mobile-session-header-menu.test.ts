import { describe, expect, it } from 'vitest'
import { resolveMobileSessionHeaderMenu } from './mobile-session-header-menu'

const none = {
  showNativeChat: false,
  hasSourceControl: false,
  showChecks: false,
  hasPlan: false
}

describe('resolveMobileSessionHeaderMenu', () => {
  it('hides the ⋯ button when no item applies', () => {
    expect(resolveMobileSessionHeaderMenu(none).showButton).toBe(false)
  })

  it('offers the chat items in a folder workspace, where there is no source control', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, showNativeChat: true })
    expect(menu.showButton).toBe(true)
    expect(menu.chat).toEqual({ sessions: true, plan: false, summary: true, artifacts: true })
    expect(menu.environment).toEqual({ branch: false, checks: false })
  })

  it('shows the plan item only when the chat has a plan', () => {
    const menu = resolveMobileSessionHeaderMenu({
      ...none,
      showNativeChat: true,
      hasPlan: true
    })
    expect(menu.chat.plan).toBe(true)
  })

  it('keeps the environment items on a git terminal without a chat', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, hasSourceControl: true })
    expect(menu.showButton).toBe(true)
    expect(menu.chat).toEqual({ sessions: false, plan: false, summary: false, artifacts: false })
    expect(menu.environment).toEqual({ branch: true, checks: false })
  })

  it('keeps Checks with its own rule, and only Checks, when it applies alone', () => {
    const menu = resolveMobileSessionHeaderMenu({ ...none, showChecks: true })
    expect(menu.showButton).toBe(true)
    expect(menu.environment).toEqual({ branch: false, checks: true })
  })
})
