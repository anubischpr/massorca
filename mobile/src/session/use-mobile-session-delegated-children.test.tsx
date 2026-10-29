import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { MobileSessionTab } from './mobile-session-route-types'
import { useMobileSessionDelegatedChildren } from './use-mobile-session-delegated-children'

const host = vi.hoisted(() => ({
  refresh: vi.fn(),
  worktrees: new Array<unknown>(),
  openMobileSession: vi.fn()
}))
vi.mock('./use-worktree-agent-rows', () => ({
  useWorktreeAgentRows: () => ({ worktrees: host.worktrees, refresh: host.refresh })
}))
vi.mock('./use-open-mobile-session', () => ({
  useOpenMobileSession: () => host.openMobileSession
}))

const LEAF = '33333333-3333-4333-8333-333333333333'
const parentChat: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-parent',
  title: 'Gentle Shell v5',
  sessionId: 'parent-1',
  agent: 'claude',
  isActive: true
}
const childChat: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-child',
  title: 'Explore Gentle Shell v5',
  sessionId: 'child-1',
  agent: 'codex',
  isActive: false
}

function paneOf(sessionId: string): string {
  return `${structuredAgentSessionTabId(sessionId)}:${LEAF}`
}

type Args = Parameters<typeof useMobileSessionDelegatedChildren>[0]
type Result = ReturnType<typeof useMobileSessionDelegatedChildren>

let result: Result | null = null

function Probe(args: Args) {
  result = useMobileSessionDelegatedChildren(args)
  return null
}

function argsWith(overrides: Partial<Args>): Args {
  return {
    client: null,
    hostId: 'host-1',
    worktreeId: 'wt-a',
    sessionRows: [{ tab: parentChat }, { tab: childChat }],
    sessionsSheetOpen: false,
    switchSessionTab: vi.fn(),
    ...overrides
  }
}

describe('useMobileSessionDelegatedChildren', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    result = null
    host.refresh.mockReset()
    host.openMobileSession.mockReset()
    host.worktrees = []
  })

  function mount(args: Args): void {
    act(() => {
      renderer = create(createElement(Probe, args))
    })
  }

  it('asks the host for rows when the sessions sheet opens', () => {
    mount(argsWith({ sessionsSheetOpen: false }))
    expect(host.refresh).not.toHaveBeenCalled()

    act(() => {
      renderer?.update(createElement(Probe, argsWith({ sessionsSheetOpen: true })))
    })
    expect(host.refresh).toHaveBeenCalledTimes(1)
  })

  it('nests a child chat under the parent chat that spawned its pane in this worktree', () => {
    host.worktrees = [
      {
        worktreeId: 'wt-a',
        agents: [
          { paneKey: paneOf('parent-1'), parentPaneKey: null },
          { paneKey: paneOf('child-1'), parentPaneKey: paneOf('parent-1') }
        ]
      }
    ]
    mount(argsWith({}))

    expect([...(result?.childParentTabIds ?? [])]).toEqual([['tab-child', 'tab-parent']])
  })

  it('opens a child that the host lists in another worktree at its pane', () => {
    host.worktrees = [
      { worktreeId: 'wt-b', agents: [{ paneKey: paneOf('child-9'), parentPaneKey: null }] }
    ]
    mount(argsWith({ sessionRows: [{ tab: parentChat }] }))

    expect(result?.delegatedChildren.hasChild('child-9')).toBe(true)
    result?.delegatedChildren.openChild('child-9')

    expect(host.openMobileSession).toHaveBeenCalledWith({
      hostId: 'host-1',
      worktreeId: 'wt-b',
      paneKey: paneOf('child-9')
    })
  })

  it('switches to a child chat held in this worktree instead of opening it elsewhere', () => {
    const switchSessionTab = vi.fn()
    mount(argsWith({ switchSessionTab }))

    result?.delegatedChildren.openChild('child-1')

    expect(switchSessionTab).toHaveBeenCalledWith(childChat)
    expect(host.openMobileSession).not.toHaveBeenCalled()
  })
})
