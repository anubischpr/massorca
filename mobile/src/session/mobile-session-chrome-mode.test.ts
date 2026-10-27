import { describe, expect, it } from 'vitest'
import {
  resolveMobileSessionChromeMode,
  type MobileSessionChromeModeInput
} from './mobile-session-chrome-mode'

const LOADED: MobileSessionChromeModeInput = {
  showNativeChat: false,
  connected: true,
  tabsLoading: false,
  activeTabType: 'terminal',
  chatResolving: false
}

function modeWith(overrides: Partial<MobileSessionChromeModeInput>) {
  return resolveMobileSessionChromeMode({ ...LOADED, ...overrides })
}

describe('resolveMobileSessionChromeMode', () => {
  it('draws the new controls for a chat that is on screen, from the first render it is known', () => {
    expect(modeWith({ showNativeChat: true, activeTabType: 'agent-session' })).toBe('chat')
    expect(modeWith({ showNativeChat: true, connected: false, tabsLoading: true })).toBe('chat')
  })

  it('draws the classic header for a terminal tab once it is known, and never the new controls', () => {
    expect(modeWith({ activeTabType: 'terminal' })).toBe('terminal')
    expect(modeWith({ activeTabType: 'browser' })).toBe('terminal')
    expect(modeWith({ activeTabType: 'markdown' })).toBe('terminal')
  })

  it('draws the neutral bar while the active tab is not known yet, so no old chrome flashes', () => {
    expect(modeWith({ activeTabType: null, tabsLoading: true })).toBe('pending')
    expect(modeWith({ activeTabType: null, connected: false })).toBe('pending')
  })

  it('keeps an empty session on the header once its tabs are loaded, so Back stays reachable', () => {
    expect(modeWith({ activeTabType: null, tabsLoading: false, connected: true })).toBe('terminal')
  })

  it('draws the neutral bar while an agent session transcript is still resolving', () => {
    expect(modeWith({ activeTabType: 'agent-session', chatResolving: true })).toBe('pending')
  })

  it('shows the header for an agent session whose transcript has settled without a chat', () => {
    expect(modeWith({ activeTabType: 'agent-session', chatResolving: false })).toBe('terminal')
  })
})
