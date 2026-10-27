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
}

/** The route-actions model the surfaces hook reads, with only the fields it touches. */
function scopeFor(options: Options = {}): MobileSessionPanelRouteActionsModel {
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
    visibleTabs: options.tabs ?? [chatTab, terminalTab],
    activeSessionTabId: options.activeTabId === undefined ? chatTab.id : options.activeTabId,
    showChecksAction: options.showChecks ?? false,
    showAgentSessionHistoryAction: options.showAgentHistory ?? false,
    isFolderWorkspaceRoute: options.folderWorkspace ?? false,
    isFloatingWorkspaceRoute: false,
    hostId: 'host-1',
    worktreeId: 'wt-1',
    worktreeName: 'feature',
    router: { push: options.push ?? vi.fn() },
    handlePanelTap: vi.fn()
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

    const history = latest(
      mountSurfaces(scopeFor({ showNativeChat: false, showAgentHistory: true }))
    )
    expect(history.headerMenu.chat).toMatchObject({ agentHistory: true })
    expect(history.showHeaderMoreButton).toBe(true)
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
    expect(surfaces.sessionRows.map((row) => row.status)).toEqual(['idle', 'terminal'])
  })
})
