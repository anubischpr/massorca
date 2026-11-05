// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { CreateChatSelection } from './create-chat-selection'

const mocks = vi.hoisted(() => {
  const store = {
    repos: [] as Repo[],
    worktreesByRepo: {} as Record<string, { id: string; path: string; isMainWorktree: boolean }[]>,
    unifiedTabsByWorktree: {} as Record<string, { id: string }[]>,
    setTabViewMode: vi.fn(),
    setActiveView: vi.fn(),
    setActiveWorktree: vi.fn()
  }
  return {
    store,
    getWorkspaceSeedName: vi.fn(),
    activateAndRevealWorkspace: vi.fn(),
    runBackgroundWorktreeCreation: vi.fn(),
    beginStructuredAgentSessionProvisionalLaunch: vi.fn(),
    holdStructuredAgentSessionLaunchPicks: vi.fn(),
    launchAgentInNewTab: vi.fn(),
    showHostSessionInFloating: vi.fn(),
    showWhenHostPublishes: vi.fn(),
    toastInfo: vi.fn()
  }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.store } }))
vi.mock('@/lib/new-workspace', () => ({ getWorkspaceSeedName: mocks.getWorkspaceSeedName }))
vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorkspace: mocks.activateAndRevealWorkspace
}))
vi.mock('@/lib/worktree-creation-flow', () => ({
  runBackgroundWorktreeCreation: mocks.runBackgroundWorktreeCreation
}))
vi.mock('@/lib/structured-agent-session-provisional-tab', () => ({
  beginStructuredAgentSessionProvisionalLaunch: mocks.beginStructuredAgentSessionProvisionalLaunch
}))
vi.mock('@/lib/structured-agent-session-launch-options', () => ({
  holdStructuredAgentSessionLaunchPicks: mocks.holdStructuredAgentSessionLaunchPicks
}))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: mocks.launchAgentInNewTab
}))
vi.mock('@/lib/floating-workspace-host-session', () => ({
  showHostSessionInFloating: mocks.showHostSessionInFloating,
  showWhenHostPublishes: mocks.showWhenHostPublishes,
  knownSessionTabIds: (worktreeId: string) =>
    new Set((mocks.store.unifiedTabsByWorktree[worktreeId] ?? []).map((tab) => tab.id))
}))
vi.mock('@/lib/agent-session-launch-plan', () => ({
  // Why: the verdict is the plan's data; the launch itself is mocked at its own boundary.
  adoptAgentSessionLaunchVerdict: <T>(verdict: T): T => verdict
}))
vi.mock('sonner', () => ({ toast: { info: mocks.toastInfo } }))

import { submitCreateChatDraft } from './create-chat-submit'
import { EMPTY_RETIRED_NAME_REGISTRY } from '../../../../shared/worktree/retired-name-registry'
import { structuredAgentSessionTabId } from '../../../../shared/structured-agent-session-projection'

function selection(overrides: Partial<CreateChatSelection> = {}): CreateChatSelection {
  return {
    executionHostId: 'local',
    project: { kind: 'repo', repoId: 'repo-1' },
    workspaceMode: 'existing-worktree',
    existingWorktreeId: 'wt-fix',
    agent: 'claude',
    accessMode: 'default',
    ...overrides
  }
}

function expectMainWindowUntouched(): void {
  expect(mocks.activateAndRevealWorkspace).not.toHaveBeenCalled()
  expect(mocks.store.setActiveView).not.toHaveBeenCalled()
  expect(mocks.store.setActiveWorktree).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store.repos = [
    {
      id: 'repo-1',
      path: 'D:/projects/repo-1',
      displayName: 'repo-1',
      badgeColor: '#999',
      addedAt: 1
    }
  ]
  mocks.store.worktreesByRepo = {
    'repo-1': [
      { id: 'wt-main', path: 'D:/projects/repo-1', isMainWorktree: true },
      { id: 'wt-fix', path: 'D:/projects/repo-1-fix', isMainWorktree: false }
    ]
  }
  mocks.store.unifiedTabsByWorktree = { 'wt-fix': [{ id: 'old-tab' }] }
  mocks.getWorkspaceSeedName.mockReturnValue('fix-login')
  mocks.activateAndRevealWorkspace.mockReturnValue({ primaryTabId: 'tab-1' })
  mocks.beginStructuredAgentSessionProvisionalLaunch.mockImplementation(
    (args: { onOpened?: (sessionId: string) => void }) => {
      args.onOpened?.('session-1')
      return { sessionId: 'session-1' }
    }
  )
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { worktrees: { listRetiredNames: vi.fn(async () => EMPTY_RETIRED_NAME_REGISTRY) } }
  })
})

describe('create chat submitted from the floating workspace', () => {
  it('starts the chat in the background and shows it in the floating workspace', async () => {
    const outcome = await submitCreateChatDraft('Fix login', selection(), 'floating-workspace')

    expect(outcome).toEqual({ started: true })
    expectMainWindowUntouched()
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        activate: false,
        target: { worktreeId: 'wt-fix', executionHostId: 'local' }
      })
    )
    await vi.waitFor(() =>
      expect(mocks.showHostSessionInFloating).toHaveBeenCalledWith(
        'wt-fix',
        structuredAgentSessionTabId('session-1')
      )
    )
  })

  it('starts a terminal session in the background and shows its tab in the floating workspace', async () => {
    mocks.launchAgentInNewTab.mockReturnValue({
      surface: { kind: 'local-terminal', tabId: 'tab-9' }
    })

    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ sessionView: 'terminal' }),
      'floating-workspace'
    )

    expect(outcome).toEqual({ started: true })
    expectMainWindowUntouched()
    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'wt-fix', activate: false })
    )
    expect(mocks.store.setTabViewMode).toHaveBeenCalledWith('tab-9', 'terminal')
    await vi.waitFor(() =>
      expect(mocks.showHostSessionInFloating).toHaveBeenCalledWith('wt-fix', 'tab-9')
    )
  })

  it('waits for a host-published terminal tab that is not yet in the workspace', async () => {
    mocks.launchAgentInNewTab.mockReturnValue({ surface: { kind: 'host-published' } })

    await submitCreateChatDraft(
      'Fix login',
      selection({ sessionView: 'terminal' }),
      'floating-workspace'
    )

    await vi.waitFor(() =>
      expect(mocks.showWhenHostPublishes).toHaveBeenCalledWith('wt-fix', new Set(['old-tab']))
    )
  })

  it('creates a new worktree without revealing its creation surface in the main window', async () => {
    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'new-worktree', existingWorktreeId: undefined }),
      'floating-workspace'
    )

    expect(outcome).toEqual({ started: true })
    expect(mocks.runBackgroundWorktreeCreation).toHaveBeenCalledWith(
      expect.objectContaining({ agentLaunchRoute: 'structured-native-chat' }),
      { revealCreationSurface: false }
    )
    expect(mocks.toastInfo).toHaveBeenCalledOnce()
  })
})

describe('create chat submitted from the main window', () => {
  it('still opens and reveals the workspace and activates the chat tab', async () => {
    await submitCreateChatDraft('Fix login', selection())

    expect(mocks.activateAndRevealWorkspace).toHaveBeenCalledWith('wt-fix', {
      providesInitialSurface: true
    })
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ activate: true })
    )
    expect(mocks.showHostSessionInFloating).not.toHaveBeenCalled()
  })

  it('still reveals a new worktree creation in the main window', async () => {
    await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'new-worktree', existingWorktreeId: undefined })
    )

    expect(mocks.runBackgroundWorktreeCreation).toHaveBeenCalledWith(
      expect.objectContaining({ agentLaunchRoute: 'structured-native-chat' })
    )
    expect(mocks.runBackgroundWorktreeCreation.mock.calls[0]).toHaveLength(1)
  })
})
