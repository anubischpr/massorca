// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  detectionTargetFor: vi.fn((worktreeId: string) => ({ kind: 'worktree', worktreeId })),
  useDetectedAgents: vi.fn(() => ({ detectedIds: ['claude'] }))
}))

vi.mock('@/hooks/useAgentDetectionTarget', () => ({
  useAgentDetectionTargetForWorktree: mocks.detectionTargetFor
}))
vi.mock('@/hooks/useDetectedAgents', () => ({ useDetectedAgents: mocks.useDetectedAgents }))

import { useTabBarRuntimeModel } from './use-tab-bar-runtime-model'
import { withHostAgentLaunch } from './tab-bar-host-agent-launch'

describe('a tab strip whose "+" menu follows another host', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('detects agents on the host workspace, not on its own workspace', () => {
    renderHook(() =>
      useTabBarRuntimeModel({ worktreeId: 'floating', hostWorktreeId: 'vps-worktree' })
    )
    expect(mocks.detectionTargetFor).toHaveBeenLastCalledWith('vps-worktree')
  })

  it('keeps detecting on its own workspace without a host', () => {
    renderHook(() => useTabBarRuntimeModel({ worktreeId: 'floating' }))
    expect(mocks.detectionTargetFor).toHaveBeenLastCalledWith('floating')
  })

  it('starts a picked agent on the host instead of in its own workspace', () => {
    const launchAgent = vi.fn()
    const ownLaunch = vi.fn()
    const { result: runtime } = renderHook(() =>
      useTabBarRuntimeModel({ worktreeId: 'floating', hostWorktreeId: 'vps-worktree' })
    )
    const createMenu = withHostAgentLaunch(
      { launchAgentFromNewTabEntry: ownLaunch },
      { worktreeId: 'vps-worktree', launchAgent },
      runtime.current.agentLaunchOptions
    )
    createMenu.launchAgentFromNewTabEntry('claude')
    expect(launchAgent).toHaveBeenCalledWith('claude', expect.any(String))
    expect(ownLaunch).not.toHaveBeenCalled()
  })

  it("keeps the menu's own launch without a host", () => {
    const ownLaunch = vi.fn()
    const createMenu = withHostAgentLaunch({ launchAgentFromNewTabEntry: ownLaunch }, undefined, [])
    createMenu.launchAgentFromNewTabEntry('claude')
    expect(ownLaunch).toHaveBeenCalledWith('claude')
  })
})
