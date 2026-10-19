// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'

const toggleTabViewMode = vi.hoisted(() => vi.fn())

function workspaceWithTerminal(worktreeId: string) {
  const tabId = `${worktreeId}-tab`
  return {
    groups: [{ id: `${worktreeId}-group`, activeTabId: tabId }],
    tabs: [{ id: tabId, entityId: `${worktreeId}-terminal`, contentType: 'terminal' }],
    terminals: [{ id: `${worktreeId}-terminal`, title: 'zsh' }]
  }
}

const state = vi.hoisted(() => ({ activeWorktreeId: 'wt-main' }))
vi.mock('../../store', () => {
  const main = workspaceWithTerminal('wt-main')
  const floating = workspaceWithTerminal(FLOATING_TERMINAL_WORKTREE_ID)
  return {
    useAppStore: {
      getState: () => ({
        activeWorktreeId: state.activeWorktreeId,
        structuredChatTerminalLinksByTabId: chatLinks.links,
        activeGroupIdByWorktree: {
          'wt-main': main.groups[0].id,
          [FLOATING_TERMINAL_WORKTREE_ID]: floating.groups[0].id
        },
        groupsByWorktree: {
          'wt-main': main.groups,
          [FLOATING_TERMINAL_WORKTREE_ID]: floating.groups
        },
        unifiedTabsByWorktree: {
          'wt-main': main.tabs,
          [FLOATING_TERMINAL_WORKTREE_ID]: floating.tabs
        },
        tabsByWorktree: {
          'wt-main': main.terminals,
          [FLOATING_TERMINAL_WORKTREE_ID]: floating.terminals
        },
        terminalLayoutsByTabId: {},
        agentStatusByPaneKey: {},
        settings: { experimentalNativeChat: true },
        toggleTabViewMode
      })
    }
  }
})
vi.mock('./native-chat-shortcut', () => ({
  isMacPlatform: () => true,
  matchesNativeChatToggleShortcut: () => true
}))
vi.mock('./native-chat-availability', () => ({ canToggleNativeChat: () => true }))
vi.mock('@/lib/native-chat-transcript-readability', () => ({
  isNativeChatTranscriptLocalReadable: () => true
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionIdFromState: () => null }))

import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'
import { useNativeChatToggleShortcut } from './use-native-chat-toggle-shortcut'

const chatLinks: { links: Record<string, StructuredChatTerminalLink> } = vi.hoisted(() => ({
  links: {}
}))
const returnToStructuredChat = vi.hoisted(() => vi.fn())
vi.mock('./structured-chat-terminal-return', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  returnTerminalToStructuredChat: returnToStructuredChat
}))

function pressToggleFrom(target: HTMLElement): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
}

// The floating panel and the main window mount the same surface side by side; one key press
// must toggle only the surface it came from.
describe('native chat toggle with the floating panel on screen', () => {
  afterEach(() => {
    cleanup()
    toggleTabViewMode.mockClear()
    returnToStructuredChat.mockClear()
    chatLinks.links = {}
    document.body.replaceChildren()
  })

  function mountBothSurfaces(): { panelButton: HTMLElement; mainButton: HTMLElement } {
    renderHook(() => useNativeChatToggleShortcut('wt-main', true))
    renderHook(() => useNativeChatToggleShortcut(FLOATING_TERMINAL_WORKTREE_ID, true))
    const panel = document.createElement('div')
    panel.setAttribute('data-floating-terminal-panel', '')
    const panelButton = document.createElement('button')
    panel.append(panelButton)
    const mainButton = document.createElement('button')
    document.body.append(panel, mainButton)
    return { panelButton, mainButton }
  }

  it('toggles only the floating tab for a key press inside the panel', () => {
    const { panelButton } = mountBothSurfaces()

    pressToggleFrom(panelButton)

    expect(toggleTabViewMode.mock.calls).toEqual([[`${FLOATING_TERMINAL_WORKTREE_ID}-tab`]])
  })

  it('toggles only the main window tab for a key press outside the panel', () => {
    const { mainButton } = mountBothSurfaces()

    pressToggleFrom(mainButton)

    expect(toggleTabViewMode.mock.calls).toEqual([['wt-main-tab']])
  })

  it('returns a terminal the structured chat opened to that chat instead of toggling the legacy view', () => {
    const link: StructuredChatTerminalLink = {
      agent: 'claude',
      providerSessionId: 'session-1',
      worktreeId: 'wt-main',
      structuredSessionId: 'claude-chat-1'
    }
    chatLinks.links = { 'wt-main-terminal': link }
    const { mainButton } = mountBothSurfaces()

    pressToggleFrom(mainButton)

    expect(returnToStructuredChat.mock.calls).toEqual([[{ tabId: 'wt-main-terminal', link }]])
    expect(toggleTabViewMode).not.toHaveBeenCalled()
  })
})
