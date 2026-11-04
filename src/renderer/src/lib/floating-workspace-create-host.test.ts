import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  launchAgentInNewTab: vi.fn(),
  markUsed: vi.fn(),
  showSessionInFloatingWorkspace: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('./launch-agent-in-new-tab', () => ({ launchAgentInNewTab: mocks.launchAgentInNewTab }))
vi.mock('./floating-workspace-host-store', () => ({
  useFloatingWorkspaceHostStore: { getState: () => ({ markUsed: mocks.markUsed }) }
}))
vi.mock('./show-session-in-floating-workspace', () => ({
  showSessionInFloatingWorkspace: mocks.showSessionInFloatingWorkspace,
  awaitNewSessionTab: vi.fn(() => Promise.resolve(null))
}))
vi.mock('./focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('../runtime/web-runtime-terminal-creation', () => ({
  createWebRuntimeSessionTerminal: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ unifiedTabsByWorktree: {} }) }
}))

import { floatingCreateHost } from './floating-workspace-host-session'

describe('the floating "+" menu host', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stays on the floating workspace while This computer is selected', () => {
    expect(floatingCreateHost('local', null)).toBeUndefined()
  })

  it('lists and starts agents in the selected paired host workspace', () => {
    mocks.launchAgentInNewTab.mockReturnValue({
      surface: { kind: 'local-terminal', tabId: 'vps-tab' }
    })
    mocks.showSessionInFloatingWorkspace.mockReturnValue({ ok: true, groupId: 'g' })
    const host = floatingCreateHost('vps-env', 'vps-worktree')
    expect(host?.worktreeId).toBe('vps-worktree')
    host?.launchAgent('claude', 'Claude')
    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'claude', worktreeId: 'vps-worktree', activate: false })
    )
    expect(mocks.markUsed).toHaveBeenCalledWith('vps-env')
    expect(mocks.showSessionInFloatingWorkspace).toHaveBeenCalledWith(
      { worktreeId: 'vps-worktree', tabId: 'vps-tab' },
      expect.anything(),
      {}
    )
  })

  it('follows a paired host that has no workspace yet, and says so when an agent is picked', () => {
    const host = floatingCreateHost('vps-env', null)
    expect(host).toMatchObject({ environmentId: 'vps-env', worktreeId: null })
    host?.launchAgent('claude', 'Claude')
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith('This host has no workspace yet.')
  })
})
