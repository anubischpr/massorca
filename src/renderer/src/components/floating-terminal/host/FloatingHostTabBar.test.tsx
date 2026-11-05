// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  tabBarProps: [] as Record<string, unknown>[],
  openCreateChatPage: vi.fn(),
  openFloatingCreateSessionTab: vi.fn()
}))

vi.mock('../create-session/floating-create-session-tab', () => ({
  openFloatingCreateSessionTab: mocks.openFloatingCreateSessionTab
}))

vi.mock('@/components/tab-bar/TabBar', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.tabBarProps.push(props)
    return null
  }
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { openCreateChatPage: () => void }) => unknown) =>
    selector({ openCreateChatPage: mocks.openCreateChatPage })
}))
vi.mock('./use-floating-host-selection', () => ({
  useFloatingHostSelection: () => ({ selectedHost: 'vps-env', remoteWorkspaceId: 'vps-worktree' })
}))
vi.mock('@/lib/floating-workspace-host-session', () => ({
  floatingCreateHost: () => ({ environmentId: 'vps-env', worktreeId: 'vps-worktree' })
}))

import { FloatingHostTabBar } from './FloatingHostTabBar'

describe('the floating tab strip', () => {
  afterEach(() => {
    cleanup()
    mocks.tabBarProps.length = 0
    mocks.openFloatingCreateSessionTab.mockClear()
  })

  it('offers New Session as a floating tab instead of agent rows', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mocked TabBar reads no prop.
    render(<FloatingHostTabBar {...({} as Parameters<typeof FloatingHostTabBar>[0])} />)
    const props = mocks.tabBarProps.at(-1)
    expect(props?.showAgentLaunchItems).toBe(false)
    const onNewSession = props?.onNewSession
    expect(typeof onNewSession).toBe('function')
    if (typeof onNewSession === 'function') {
      onNewSession()
    }
    expect(mocks.openFloatingCreateSessionTab).toHaveBeenCalledExactlyOnceWith('New Session')
    // Why: the main window's create page must not open behind the floating panel.
    expect(mocks.openCreateChatPage).not.toHaveBeenCalled()
  })
})
