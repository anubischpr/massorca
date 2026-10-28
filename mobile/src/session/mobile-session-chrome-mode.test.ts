import { describe, expect, it } from 'vitest'
import {
  resolveMobileSessionChromeMode,
  type MobileSessionChromeModeInput,
  type MobileSessionTabType
} from './mobile-session-chrome-mode'

const LOADED: MobileSessionChromeModeInput = {
  showNativeChat: false,
  connected: true,
  tabsLoading: false,
  hasTabs: true,
  activeTabType: 'terminal',
  chatResolving: false
}

function modeWith(overrides: Partial<MobileSessionChromeModeInput>) {
  return resolveMobileSessionChromeMode({ ...LOADED, ...overrides })
}

const NON_CHAT_TYPES: readonly MobileSessionTabType[] = ['terminal', 'browser', 'markdown', 'file']

describe('resolveMobileSessionChromeMode', () => {
  it('draws the new controls for a native chat on screen, whatever the lane state', () => {
    expect(modeWith({ showNativeChat: true, activeTabType: 'agent-session' })).toBe('chat')
    expect(
      modeWith({ showNativeChat: true, connected: false, tabsLoading: true, hasTabs: false })
    ).toBe('chat')
  })

  it('draws the classic header for every non-chat tab type once it is the known active tab', () => {
    for (const activeTabType of NON_CHAT_TYPES) {
      expect(modeWith({ activeTabType })).toBe('terminal')
    }
  })

  it('draws the neutral bar, never the header, while connecting or tabs are loading', () => {
    expect(modeWith({ activeTabType: null, hasTabs: false, tabsLoading: true })).toBe('pending')
    expect(modeWith({ activeTabType: null, hasTabs: false, connected: false })).toBe('pending')
  })

  it('draws the neutral bar when a cached tab list has no active tab, since its kind is unknown', () => {
    expect(modeWith({ activeTabType: null, hasTabs: true, tabsLoading: false })).toBe('pending')
  })

  it('keeps an empty loaded session on the header, so Back and the empty state stay reachable', () => {
    expect(modeWith({ activeTabType: null, hasTabs: false, tabsLoading: false })).toBe('terminal')
  })

  it('draws the neutral bar while an agent session transcript is still resolving', () => {
    expect(modeWith({ activeTabType: 'agent-session', chatResolving: true })).toBe('pending')
  })

  it('shows the header for an agent session whose transcript has settled without a chat', () => {
    expect(modeWith({ activeTabType: 'agent-session', chatResolving: false })).toBe('terminal')
  })

  it('ignores a resolving chat when the active tab is a terminal beside it', () => {
    expect(modeWith({ activeTabType: 'terminal', chatResolving: true })).toBe('terminal')
  })

  it('draws the floating controls, never the header, while the terminal panel holds the body', () => {
    expect(modeWith({ activeTabType: 'terminal', terminalPanelOpen: true })).toBe('chat')
    expect(modeWith({ activeTabType: null, hasTabs: false, terminalPanelOpen: true })).toBe('chat')
  })
})
