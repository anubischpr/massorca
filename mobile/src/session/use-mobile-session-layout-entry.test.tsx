import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MobileSessionTab } from './mobile-session-route-types'
import type { MobileSessionChatSurfacesModel } from './use-mobile-session-chat-surfaces'
import { useMobileSessionLayoutEntry } from './use-mobile-session-layout-entry'

const chatTab: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-chat',
  title: 'Fix login',
  sessionId: 'session-1',
  agent: 'claude',
  isActive: false
}
const terminalTab: MobileSessionTab = {
  type: 'terminal',
  id: 'tab-term',
  title: 'zsh',
  terminal: 'term-1',
  isActive: false
}
const laterTerminalTab: MobileSessionTab = {
  type: 'terminal',
  id: 'tab-term-2',
  title: 'vitest',
  terminal: 'term-2',
  isActive: false
}

type Options = {
  activeTab: MobileSessionTab
  activePanel?: 'files' | null
  setActivePanel?: ReturnType<typeof vi.fn>
}

type Entry = ReturnType<typeof useMobileSessionLayoutEntry>

/** The fields the layout-entry hook reads from the surfaces model, for a session with its tabs loaded. */
function scopeFor({ activeTab, activePanel = null, setActivePanel = vi.fn() }: Options) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the fields set here; the rest of the surfaces model is never touched.
  return {
    showLoadingState: false,
    showEmptyState: false,
    connState: 'connected',
    activeSessionTab: activeTab,
    activeSessionTabId: activeTab.id,
    activeSessionTabTypeRef: { current: activeTab.type },
    visibleTabs: [chatTab, terminalTab, laterTerminalTab],
    activePanel,
    setActivePanel,
    handlePanelTap: vi.fn(),
    nativeChatController: { showNativeChat: false, nativeChatSession: { status: 'ready' } },
    // The surfaces model draws the panel over an active terminal, whichever panel is stored.
    terminalPanelOpen: activeTab.type === 'terminal'
  } as unknown as MobileSessionChatSurfacesModel
}

function Probe({
  scope,
  onEntry
}: {
  scope: MobileSessionChatSurfacesModel
  onEntry: (entry: Entry) => void
}) {
  onEntry(useMobileSessionLayoutEntry(scope))
  return null
}

describe('useMobileSessionLayoutEntry', () => {
  let renderer: ReactTestRenderer | null = null
  let entry: Entry | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    entry = null
  })

  function renderWith(scope: MobileSessionChatSurfacesModel): void {
    const onEntry = (next: Entry) => {
      entry = next
    }
    act(() => {
      if (renderer === null) {
        renderer = create(createElement(Probe, { scope, onEntry }))
      } else {
        renderer.update(createElement(Probe, { scope, onEntry }))
      }
    })
  }

  function latest(): Entry {
    if (entry === null) {
      throw new Error('the layout-entry hook did not render')
    }
    return entry
  }

  it('opens the Terminal panel when a terminal is the active tab on entry', () => {
    const setActivePanel = vi.fn()
    renderWith(scopeFor({ activeTab: terminalTab, setActivePanel }))

    expect(setActivePanel).toHaveBeenCalledWith('terminal')
  })

  it('opens the Terminal panel on a later switch to a terminal, not only on entry', () => {
    const setActivePanel = vi.fn()
    renderWith(scopeFor({ activeTab: chatTab, setActivePanel }))
    expect(setActivePanel).not.toHaveBeenCalled()

    renderWith(scopeFor({ activeTab: terminalTab, setActivePanel }))
    expect(setActivePanel).toHaveBeenCalledTimes(1)

    renderWith(scopeFor({ activeTab: chatTab, setActivePanel }))
    renderWith(scopeFor({ activeTab: laterTerminalTab, setActivePanel }))
    expect(setActivePanel).toHaveBeenCalledTimes(2)
  })

  it('leaves a docked panel alone while a terminal is the active tab', () => {
    const setActivePanel = vi.fn()
    renderWith(scopeFor({ activeTab: terminalTab, activePanel: 'files', setActivePanel }))

    expect(setActivePanel).not.toHaveBeenCalled()
  })

  it('never names a selected terminal as unsupported, so no notice replaces the panel', () => {
    renderWith(scopeFor({ activeTab: chatTab }))
    renderWith(scopeFor({ activeTab: laterTerminalTab }))

    expect(latest().chromeMode).toBe('chat')
    expect(latest().showUnsupportedNotice).toBe(false)
  })
})
