import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { MobileSessionTab } from './mobile-session-route-types'
import { useMobileSessionChatSurfaces } from './use-mobile-session-chat-surfaces'
import type { MobileSessionPanelRouteActionsModel } from './use-mobile-session-panel-route-actions'

type Surfaces = ReturnType<typeof useMobileSessionChatSurfaces>

const chatTab: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-chat',
  title: 'Fix login',
  sessionId: 'session-1',
  agent: 'claude',
  isActive: true
}
const terminalTab: MobileSessionTab = {
  type: 'terminal',
  id: 'tab-term',
  title: 'npm test',
  terminal: 'term-1',
  isActive: false
}

type Options = {
  showNativeChat?: boolean
  working?: boolean
  waiting?: boolean
  messages?: NativeChatMessage[]
  activeTabId?: string | null
  tabs?: MobileSessionTab[]
  folderWorkspace?: boolean
  showChecks?: boolean
  showAgentHistory?: boolean
  push?: ReturnType<typeof vi.fn>
  switchSessionTab?: ReturnType<typeof vi.fn>
  setActivePanel?: ReturnType<typeof vi.fn>
  activePanel?: 'files' | null
}

/** The route-actions model the surfaces hook reads, with only the fields it touches. */
function scopeFor(options: Options = {}): MobileSessionPanelRouteActionsModel {
  const visibleTabs = options.tabs ?? [chatTab, terminalTab]
  const activeTabId = options.activeTabId === undefined ? chatTab.id : options.activeTabId
  return {
    nativeChatController: {
      showNativeChat: options.showNativeChat ?? true,
      nativeChatAgentWorking: options.working ?? false,
      nativeChatPermission: options.waiting ? { kind: 'permission' } : null,
      nativeChatQuestion: null,
      nativeChatAsk: null,
      nativeChatSession: { messages: options.messages ?? [] },
      nativeChatAgent: 'claude',
      nativeChatWorkingStartedAt: null,
      nativeChatVisualSource: null
    },
    visibleTabs,
    activeSessionTabId: activeTabId,
    activeSessionTab: visibleTabs.find((tab) => tab.id === activeTabId) ?? null,
    activePanel: options.activePanel ?? null,
    showChecksAction: options.showChecks ?? false,
    showAgentSessionHistoryAction: options.showAgentHistory ?? false,
    isFolderWorkspaceRoute: options.folderWorkspace ?? false,
    isFloatingWorkspaceRoute: false,
    hostId: 'host-1',
    worktreeId: 'wt-1',
    worktreeName: 'feature',
    router: { push: options.push ?? vi.fn() },
    handlePanelTap: vi.fn(),
    setActivePanel: options.setActivePanel ?? vi.fn(),
    switchSessionTab: options.switchSessionTab ?? vi.fn()
  } as unknown as MobileSessionPanelRouteActionsModel
}

function Probe({
  scope,
  onSurfaces
}: {
  scope: MobileSessionPanelRouteActionsModel
  onSurfaces: (surfaces: Surfaces) => void
}) {
  onSurfaces(useMobileSessionChatSurfaces(scope))
  return null
}

function todoWrite(todos: unknown[]): NativeChatMessage {
  return {
    id: 'todo',
    role: 'assistant',
    timestamp: null,
    source: 'transcript',
    blocks: [
      { type: 'tool-call', name: 'TodoWrite', input: { todos }, callId: 't1', state: 'completed' }
    ]
  }
}

function fileWrite(path: string): NativeChatMessage[] {
  return [
    {
      id: 'write-call',
      role: 'assistant',
      timestamp: null,
      source: 'transcript',
      blocks: [
        {
          type: 'tool-call',
          name: 'write_file',
          input: { Path: path },
          callId: 'w1',
          state: 'completed'
        }
      ]
    },
    {
      id: 'write-result',
      role: 'assistant',
      timestamp: null,
      source: 'transcript',
      blocks: [{ type: 'tool-result', output: 'ok', callId: 'w1', isError: false }]
    }
  ]
}

describe('useMobileSessionChatSurfaces', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  /** Mounts the hook and returns a box holding the latest surfaces it produced. */
  function mountSurfaces(scope: MobileSessionPanelRouteActionsModel): { current: Surfaces | null } {
    const box: { current: Surfaces | null } = { current: null }
    act(() => renderer?.unmount())
    act(() => {
      renderer = create(
        createElement(Probe, { scope, onSurfaces: (surfaces) => (box.current = surfaces) })
      )
    })
    return box
  }

  function latest(box: { current: Surfaces | null }): Surfaces {
    if (!box.current) {
      throw new Error('the surfaces hook did not render')
    }
    return box.current
  }

  /** Re-renders the mounted hook with a new scope, as the session screen does when its chat changes. */
  function renderWith(
    box: { current: Surfaces | null },
    scope: MobileSessionPanelRouteActionsModel
  ) {
    act(() => {
      renderer?.update(
        createElement(Probe, { scope, onSurfaces: (surfaces) => (box.current = surfaces) })
      )
    })
  }

  it('shows the switcher only while a native chat is on screen with tabs', () => {
    expect(latest(mountSurfaces(scopeFor({ showNativeChat: true }))).showSessionSwitcherChip).toBe(
      true
    )
    expect(latest(mountSurfaces(scopeFor({ showNativeChat: false }))).showSessionSwitcherChip).toBe(
      false
    )
    expect(latest(mountSurfaces(scopeFor({ tabs: [] }))).showSessionSwitcherChip).toBe(false)
  })

  it('reads the chat state into the active row, waiting ahead of working', () => {
    const status = (options: Options) =>
      latest(mountSurfaces(scopeFor(options))).activeSessionRow?.status
    expect(status({ working: true })).toBe('working')
    expect(status({ working: true, waiting: true })).toBe('waiting')
    // The live state describes the chat on screen only, so a hidden chat reads as idle.
    expect(status({ showNativeChat: false, working: true })).toBe('idle')
  })

  it('offers the plan only when it has at least one step', () => {
    expect(latest(mountSurfaces(scopeFor({ messages: [todoWrite([])] }))).planSteps).toBeNull()
    const surfaces = latest(
      mountSurfaces(
        scopeFor({
          messages: [
            todoWrite([
              { content: 'Read the spec', status: 'completed', activeForm: 'Reading' },
              { content: 'Run the tests', status: 'pending', activeForm: 'Running' }
            ])
          ]
        })
      )
    )
    expect(surfaces.planSteps?.tasks).toHaveLength(2)
    expect(surfaces.planProgress).toEqual({ done: 1, total: 2 })
  })

  it('opens the summary and artifacts for the chat on the active tab', () => {
    const push = vi.fn()
    const surfaces = latest(mountSurfaces(scopeFor({ push })))
    surfaces.openSummary()
    surfaces.openArtifacts()
    expect(push.mock.calls).toEqual([
      ['/h/host-1/chat-summary/wt-1?name=feature&tab=tab-chat'],
      ['/h/host-1/chat-artifacts/wt-1?name=feature&tab=tab-chat']
    ])
  })

  it('opens the summary without a tab when no tab is active', () => {
    const push = vi.fn()
    latest(mountSurfaces(scopeFor({ push, activeTabId: null }))).openSummary()
    expect(push).toHaveBeenCalledWith('/h/host-1/chat-summary/wt-1?name=feature')
  })

  it('builds the header menu from the workspace, its checks, and its agent history', () => {
    const chat = latest(mountSurfaces(scopeFor({ showChecks: true })))
    expect(chat.headerMenu.environment).toEqual({ branch: true, checks: true })
    expect(chat.headerMenu.chat).not.toHaveProperty('sessions')
    expect(chat.showHeaderMoreButton).toBe(true)

    const folder = latest(mountSurfaces(scopeFor({ folderWorkspace: true })))
    expect(folder.headerMenu.environment.branch).toBe(false)

    // A worktree with no chat keeps agent history in the menu; beside a chat, Sessions holds it.
    const history = latest(
      mountSurfaces(
        scopeFor({
          tabs: [terminalTab],
          activeTabId: terminalTab.id,
          showNativeChat: false,
          showAgentHistory: true
        })
      )
    )
    expect(history.headerMenu.chat).toMatchObject({ agentHistory: true })
    expect(history.showHeaderMoreButton).toBe(true)
  })

  it('offers the same chat items from a terminal pane, disabled only when the worktree has no chat', () => {
    const terminalPane = latest(
      mountSurfaces(scopeFor({ showNativeChat: false, activeTabId: terminalTab.id }))
    )
    expect(terminalPane.headerMenu.hasChatSession).toBe(true)
    expect(terminalPane.headerMenu.chat).toMatchObject({
      plan: true,
      summary: true,
      artifacts: true,
      quickCommands: true
    })

    const noChat = latest(
      mountSurfaces(
        scopeFor({ tabs: [terminalTab], showNativeChat: false, activeTabId: terminalTab.id })
      )
    )
    expect(noChat.headerMenu.hasChatSession).toBe(false)
    expect(noChat.headerMenu.chat.plan).toBe(true)
  })

  it('counts the files the chat changed only while the chat is on screen', () => {
    expect(
      latest(mountSurfaces(scopeFor({ messages: fileWrite('src/a.ts') }))).recordedFileCount
    ).toBe(1)
    expect(
      latest(mountSurfaces(scopeFor({ showNativeChat: false, messages: fileWrite('src/a.ts') })))
        .recordedFileCount
    ).toBe(0)
  })

  it('stays inert on a route with no chat on screen', () => {
    const surfaces = latest(mountSurfaces(scopeFor({ showNativeChat: false, messages: [] })))
    expect(surfaces.planSteps).toBeNull()
    expect(surfaces.recordedFileCount).toBe(0)
    expect(surfaces.showSessionSwitcherChip).toBe(false)
    expect(surfaces.headerMenu.chat).not.toHaveProperty('sessions')
    expect(surfaces.sessionRows.map((row) => row.status)).toEqual(['idle'])
  })

  it('lists only chats in the chip and the Sessions sheet, and the chip keeps naming the chat beside a terminal', () => {
    const terminalPane = latest(
      mountSurfaces(scopeFor({ showNativeChat: false, activeTabId: terminalTab.id }))
    )
    expect(terminalPane.sessionRows.map((row) => row.tab.type)).toEqual(['agent-session'])
    expect(terminalPane.activeSessionRow?.tab.id).toBe(chatTab.id)

    const chatPane = latest(mountSurfaces(scopeFor({ activeTabId: chatTab.id })))
    expect(chatPane.sessionRows.map((row) => row.tab.id)).toEqual([chatTab.id])
    expect(chatPane.activeSessionRow?.isActive).toBe(true)
  })

  it('draws the Terminal panel over an active terminal, whichever panel docks beside it', () => {
    const docked = latest(
      mountSurfaces(
        scopeFor({ showNativeChat: false, activeTabId: terminalTab.id, activePanel: 'files' })
      )
    )
    expect(docked.terminalPanelOpen).toBe(true)
    expect(docked.showFloatingChrome).toBe(true)
  })

  it('switches to the chat first when Plan is asked for from a terminal pane, then opens the sheet', () => {
    const switchSessionTab = vi.fn()
    const setActivePanel = vi.fn()
    const box = mountSurfaces(
      scopeFor({
        showNativeChat: false,
        activeTabId: terminalTab.id,
        switchSessionTab,
        setActivePanel
      })
    )

    act(() => latest(box).openPlanSheet())
    expect(setActivePanel).toHaveBeenCalledWith(null)
    expect(switchSessionTab).toHaveBeenCalledWith(chatTab)
    expect(latest(box).planSheetOpen).toBe(false)

    renderWith(box, scopeFor({ activeTabId: chatTab.id }))
    expect(latest(box).planSheetOpen).toBe(true)
  })

  it('opens the summary for the chat once it is on screen, not for the terminal that was active', () => {
    const push = vi.fn()
    const box = mountSurfaces(
      scopeFor({ showNativeChat: false, activeTabId: terminalTab.id, push })
    )

    act(() => latest(box).openSummary())
    expect(push).not.toHaveBeenCalled()

    renderWith(box, scopeFor({ activeTabId: chatTab.id, push }))
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/h/host-1/chat-summary/wt-1?name=feature&tab=tab-chat')
  })

  it('does nothing from a terminal pane when the worktree has no chat to act on', () => {
    const switchSessionTab = vi.fn()
    const setActivePanel = vi.fn()
    const box = mountSurfaces(
      scopeFor({
        tabs: [terminalTab],
        showNativeChat: false,
        activeTabId: terminalTab.id,
        switchSessionTab,
        setActivePanel
      })
    )

    act(() => latest(box).openPlanSheet())
    expect(switchSessionTab).not.toHaveBeenCalled()
    expect(setActivePanel).not.toHaveBeenCalled()
    expect(latest(box).planSheetOpen).toBe(false)
  })

  it('drops the request when the user moves to another tab before the chat comes on screen', () => {
    const otherTab: MobileSessionTab = {
      type: 'terminal',
      id: 'tab-other',
      title: 'vitest',
      terminal: 'term-2',
      isActive: false
    }
    const tabs = [chatTab, terminalTab, otherTab]
    const box = mountSurfaces(
      scopeFor({ tabs, showNativeChat: false, activeTabId: terminalTab.id })
    )

    act(() => latest(box).openPlanSheet())
    renderWith(box, scopeFor({ tabs, showNativeChat: false, activeTabId: otherTab.id }))
    renderWith(box, scopeFor({ tabs, activeTabId: chatTab.id }))
    expect(latest(box).planSheetOpen).toBe(false)
  })
})
