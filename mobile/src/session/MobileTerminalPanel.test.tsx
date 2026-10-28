import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBackClaim } from '../navigation/use-back-claim'
import type { MobileSessionTab } from './mobile-session-route-types'
import { MobileTerminalPanel } from './MobileTerminalPanel'
import type { MobileSessionController } from './use-mobile-session-controller'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFillObject: {}, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Plus: 'Plus',
  SquareTerminal: 'SquareTerminal',
  X: 'X'
}))
vi.mock('../navigation/use-back-claim', () => ({ useBackClaim: vi.fn() }))
// A function stub draws nothing, so the controller it receives stays out of the rendered tree.
vi.mock('./MobileTerminalPaneStack', () => ({ MobileTerminalPaneStack: () => null }))

function terminal(id: string): MobileSessionTab {
  return { type: 'terminal', id, title: 'zsh', terminal: `handle-${id}`, isActive: false }
}

function chat(id: string): MobileSessionTab {
  return {
    type: 'agent-session',
    id,
    title: 'Fix login',
    sessionId: `session-${id}`,
    agent: 'claude',
    isActive: false
  }
}

/** The controller fields the panel reads; the worktree id is a folder path, the name is the display name. */
function controllerFor(overrides: Record<string, unknown> = {}): MobileSessionController {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the panel reads only the fields set here; the rest of the controller is never touched.
  return {
    visibleTabs: [terminal('t1')],
    activeSessionTabId: 't1',
    switchSessionTab: vi.fn(),
    handleCreateTerminal: vi.fn(() => Promise.resolve()),
    handleCloseSessionTab: vi.fn(() => Promise.resolve()),
    showLoadingState: false,
    keyboardLift: 0,
    returnToChat: vi.fn(),
    notifyTerminalFrame: vi.fn(),
    worktreeId: 'repo-1::/home/me/orca/workspaces/dolphin',
    worktreeName: 'Fix parser',
    ...overrides
  } as unknown as MobileSessionController
}

let renderer: ReactTestRenderer | null = null

afterEach(() => {
  act(() => renderer?.unmount())
  renderer = null
})

function render(controller: MobileSessionController): ReactTestRenderer {
  if (renderer === null) {
    renderer = create(createElement('View'))
  }
  const mounted = renderer
  act(() => {
    mounted.update(createElement(MobileTerminalPanel, { controller, topInset: 0 }))
  })
  return mounted
}

function pressLabelled(mounted: ReactTestRenderer, label: string): void {
  const target = mounted.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  )[0]
  if (!target) {
    throw new Error(`no pressable labelled "${label}"`)
  }
  act(() => target.props.onPress())
}

function treeOf(mounted: ReactTestRenderer): string {
  return JSON.stringify(mounted.toJSON())
}

/** The Back-key claim the panel registered on its last render. */
function lastBackClaim(): (() => boolean) | null {
  const claim = vi.mocked(useBackClaim).mock.lastCall?.[0]
  if (claim === undefined) {
    throw new Error('the panel did not claim the Back key')
  }
  return claim
}

describe('MobileTerminalPanel', () => {
  it('names the header with the worktree display name, not its folder', () => {
    const tree = treeOf(render(controllerFor()))

    expect(tree).toContain('TERMINALS · 1 in Fix parser')
    expect(tree).not.toContain('dolphin')
  })

  it('draws no Back to chat row, and the new marker replaces the ready line', () => {
    const mounted = render(controllerFor())
    expect(treeOf(mounted)).not.toContain('Back to chat')

    pressLabelled(mounted, 'New terminal')
    render(
      controllerFor({
        visibleTabs: [terminal('t1'), terminal('t2')],
        activeSessionTabId: 't2'
      })
    )

    const tree = treeOf(mounted)
    expect(tree).toContain('"new"')
    expect(tree).not.toContain('Ready in')
    expect(tree).not.toContain('type a command')
    expect(tree).not.toContain('Back to chat')
  })

  it('returns the Back key to the chat when the worktree has a chat to return to', () => {
    const returnToChat = vi.fn()
    render(controllerFor({ visibleTabs: [terminal('t1'), chat('c1')], returnToChat }))

    expect(lastBackClaim()?.()).toBe(true)
    expect(returnToChat).toHaveBeenCalledTimes(1)
  })

  it('hands the Back key back to the system when the worktree has no chat, so it leaves the session', () => {
    const returnToChat = vi.fn()
    render(controllerFor({ returnToChat }))

    expect(lastBackClaim()?.()).toBe(false)
    expect(returnToChat).not.toHaveBeenCalled()
  })
})
