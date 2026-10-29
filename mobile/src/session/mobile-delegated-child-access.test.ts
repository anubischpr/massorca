import { describe, expect, it, vi } from 'vitest'
import type { MobileSessionTab } from './mobile-session-route-types'
import { mobileDelegatedChildAccess } from './mobile-delegated-child-access'

const chat: MobileSessionTab = {
  type: 'agent-session',
  id: 'structured-agent-session-child-1',
  title: 'Explore Gentle Shell v5',
  sessionId: 'child-1',
  agent: 'codex',
  isActive: false
}

const terminal: MobileSessionTab = {
  type: 'terminal',
  id: 'terminal-1',
  title: 'Terminal 1',
  terminal: 'terminal-1',
  isActive: false
}

describe('mobileDelegatedChildAccess', () => {
  it('opens a child only while its chat tab is one of this worktree tabs', () => {
    const switchTab = vi.fn()
    const access = mobileDelegatedChildAccess(() => [terminal, chat], switchTab)

    expect(access.hasChild('child-1')).toBe(true)
    expect(access.hasChild('child-2')).toBe(false)

    access.openChild('child-1')
    expect(switchTab).toHaveBeenCalledWith(chat)

    access.openChild('child-2')
    expect(switchTab).toHaveBeenCalledTimes(1)
  })

  it('never takes a terminal tab for a child chat', () => {
    const access = mobileDelegatedChildAccess(() => [terminal], vi.fn())

    expect(access.hasChild('terminal-1')).toBe(false)
  })

  it('reads the tabs when asked, so a child opened later is found', () => {
    let tabs: readonly MobileSessionTab[] = []
    const access = mobileDelegatedChildAccess(() => tabs, vi.fn())
    expect(access.hasChild('child-1')).toBe(false)

    tabs = [chat]
    expect(access.hasChild('child-1')).toBe(true)
  })

  it('opens a child that the host lists in another worktree, at its pane', () => {
    const switchTab = vi.fn()
    const open = vi.fn()
    const location = { worktreeId: 'wt-child', paneKey: 'structured-agent-session-child-2:pane' }
    const access = mobileDelegatedChildAccess(() => [terminal], switchTab, {
      locate: (id) => (id === 'child-2' ? location : null),
      open,
      refresh: vi.fn()
    })

    expect(access.hasChild('child-2')).toBe(true)
    access.openChild('child-2')

    expect(open).toHaveBeenCalledWith(location)
    expect(switchTab).not.toHaveBeenCalled()
  })

  it('prefers the tab here over a host row for the same child', () => {
    const open = vi.fn()
    const access = mobileDelegatedChildAccess(() => [chat], vi.fn(), {
      locate: () => ({ worktreeId: 'wt-other', paneKey: 'k:p' }),
      open,
      refresh: vi.fn()
    })

    access.openChild('child-1')

    expect(open).not.toHaveBeenCalled()
  })

  it('offers no refresh without host rows, and asks the host through the one it is given', () => {
    expect(mobileDelegatedChildAccess(() => [], vi.fn()).refreshAgentRows).toBeUndefined()

    const refresh = vi.fn()
    const access = mobileDelegatedChildAccess(() => [], vi.fn(), {
      locate: () => null,
      open: vi.fn(),
      refresh
    })
    access.refreshAgentRows?.()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(access.hasChild('child-1')).toBe(false)
  })
})
