import { describe, expect, it, vi } from 'vitest'
import { resolveLayoutEntryAction } from './mobile-session-layout-entry'
import { getMobileNativeChatToggleActions } from './mobile-native-chat-toggle-action'

vi.mock('lucide-react-native', () => ({
  MessageSquare: {},
  SquareTerminal: {}
}))

const ENTERING = {
  legacyViews: false,
  tabsLoaded: true,
  alreadyEntered: false,
  activeTabType: 'terminal',
  activePanel: null
} as const

describe('resolveLayoutEntryAction', () => {
  it('opens the Terminal panel for a terminal that was active when the user left', () => {
    expect(resolveLayoutEntryAction(ENTERING)).toBe('open-terminal-panel')
  })

  it('sends a file or markdown tab to the Files panel', () => {
    expect(resolveLayoutEntryAction({ ...ENTERING, activeTabType: 'file' })).toBe('open-files')
    expect(resolveLayoutEntryAction({ ...ENTERING, activeTabType: 'markdown' })).toBe('open-files')
  })

  it('leaves chats and unplaceable tabs alone', () => {
    expect(resolveLayoutEntryAction({ ...ENTERING, activeTabType: 'agent-session' })).toBe('none')
    expect(resolveLayoutEntryAction({ ...ENTERING, activeTabType: 'browser' })).toBe('none')
  })

  it('waits for the tabs and never acts twice or over an open panel', () => {
    expect(resolveLayoutEntryAction({ ...ENTERING, tabsLoaded: false })).toBe('none')
    expect(resolveLayoutEntryAction({ ...ENTERING, activeTabType: null })).toBe('none')
    expect(resolveLayoutEntryAction({ ...ENTERING, alreadyEntered: true })).toBe('none')
    expect(resolveLayoutEntryAction({ ...ENTERING, activePanel: 'files' })).toBe('none')
  })

  it('keeps the old behavior with the kill switch on', () => {
    expect(resolveLayoutEntryAction({ ...ENTERING, legacyViews: true })).toBe('none')
  })
})

describe('getMobileNativeChatToggleActions kill switch', () => {
  const tab = {
    id: 't1',
    terminal: 'h1',
    type: 'terminal' as const,
    launchAgent: 'claude'
  }
  const args = {
    terminalHandle: 'h1',
    tabs: [tab],
    isTabChatView: () => false,
    nativeChatTranscriptIsLocalReadable: true,
    onClose: () => {},
    onToggle: () => {}
  }

  it('hides the terminal/chat switch when legacy views are off', () => {
    expect(getMobileNativeChatToggleActions({ ...args, legacyViews: false })).toEqual([])
  })
})
