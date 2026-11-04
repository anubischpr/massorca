// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  tabBarProps: [] as Record<string, unknown>[],
  openCreateChatPage: vi.fn()
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
  })

  it('offers New Session through the Workspaces create flow instead of agent rows', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mocked TabBar reads no prop.
    render(<FloatingHostTabBar {...({} as Parameters<typeof FloatingHostTabBar>[0])} />)
    const props = mocks.tabBarProps.at(-1)
    expect(props?.showAgentLaunchItems).toBe(false)
    expect(props?.onNewSession).toBe(mocks.openCreateChatPage)
  })
})
