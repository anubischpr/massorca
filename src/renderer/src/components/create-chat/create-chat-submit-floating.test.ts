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
    showFloatingCreateLaunch: vi.fn(),
    showFloatingNewWorktreeLaunch: vi.fn(),
    clearFloatingCreateLaunch: vi.fn()
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
vi.mock('@/lib/floating-workspace-create-launch', () => ({
  showFloatingCreateLaunch: mocks.showFloatingCreateLaunch,
  showFloatingNewWorktreeLaunch: mocks.showFloatingNewWorktreeLaunch,
  clearFloatingCreateLaunch: mocks.clearFloatingCreateLaunch
}))
vi.mock('@/lib/agent-session-launch-plan', () => ({
  // Why: the verdict is the plan's data; the launch itself is mocked at its own boundary.
  adoptAgentSessionLaunchVerdict: <T>(verdict: T): T => verdict
}))

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

/** The floating placement, naming the New Session tab the session replaces, if one waits on it. */
function floating(createTabId: string | null = null) {
  return { kind: 'floating-workspace' as const, createTabId }
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
      return {
        sessionId: 'session-1',
        tab: null,
        settlement: new Promise(() => undefined),
        cancel: () => undefined
      }
    }
  )
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { worktrees: { listRetiredNames: vi.fn(async () => EMPTY_RETIRED_NAME_REGISTRY) } }
  })
})

describe('create chat submitted from the floating workspace', () => {
  it('starts the chat in the background and shows it in the floating workspace', async () => {
    const outcome = await submitCreateChatDraft('Fix login', selection(), floating())

    expect(outcome).toEqual({ started: true })
    expectMainWindowUntouched()
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        activate: false,
        target: { worktreeId: 'wt-fix', executionHostId: 'local' }
      })
    )
    await vi.waitFor(() =>
      expect(mocks.showFloatingCreateLaunch).toHaveBeenCalledWith({
        worktreeId: 'wt-fix',
        tabId: structuredAgentSessionTabId('session-1'),
        knownTabIds: new Set(['old-tab']),
        createTabId: null
      })
    )
  })

  it('hands the session to the New Session tab that started it', async () => {
    await submitCreateChatDraft('Fix login', selection(), floating('create-1'))

    await vi.waitFor(() =>
      expect(mocks.showFloatingCreateLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ createTabId: 'create-1' })
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
      floating('create-1')
    )

    expect(outcome).toEqual({ started: true })
    expectMainWindowUntouched()
    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'wt-fix', activate: false })
    )
    expect(mocks.store.setTabViewMode).toHaveBeenCalledWith('tab-9', 'terminal')
    await vi.waitFor(() =>
      expect(mocks.showFloatingCreateLaunch).toHaveBeenCalledWith({
        worktreeId: 'wt-fix',
        tabId: 'tab-9',
        knownTabIds: new Set(['old-tab']),
        createTabId: 'create-1'
      })
    )
  })

  it('waits for a host-published terminal tab that is not yet in the workspace', async () => {
    mocks.launchAgentInNewTab.mockReturnValue({ surface: { kind: 'host-published' } })

    await submitCreateChatDraft('Fix login', selection({ sessionView: 'terminal' }), floating())

    await vi.waitFor(() =>
      expect(mocks.showFloatingCreateLaunch).toHaveBeenCalledWith({
        worktreeId: 'wt-fix',
        tabId: null,
        knownTabIds: new Set(['old-tab']),
        createTabId: null
      })
    )
  })

  it('shows the terminal that a host-declined chat opened, since no chat tab will appear', async () => {
    mocks.beginStructuredAgentSessionProvisionalLaunch.mockImplementation(() => ({
      sessionId: null,
      tab: null,
      settlement: Promise.resolve({ kind: 'terminal' }),
      cancel: () => undefined
    }))

    await submitCreateChatDraft('Fix login', selection(), floating('create-3'))

    await vi.waitFor(() =>
      expect(mocks.showFloatingCreateLaunch).toHaveBeenCalledWith({
        worktreeId: 'wt-fix',
        tabId: null,
        knownTabIds: new Set(['old-tab']),
        createTabId: 'create-3'
      })
    )
  })

  it('ends the New Session tab wait when the chat launch never starts', async () => {
    mocks.beginStructuredAgentSessionProvisionalLaunch.mockImplementation(() => ({
      sessionId: null,
      tab: null,
      settlement: Promise.resolve({ kind: 'cancelled', sessionId: null }),
      cancel: () => undefined
    }))

    await submitCreateChatDraft('Fix login', selection(), floating('create-4'))

    await vi.waitFor(() => expect(mocks.clearFloatingCreateLaunch).toHaveBeenCalledWith('create-4'))
    expect(mocks.showFloatingCreateLaunch).not.toHaveBeenCalled()
  })

  it('creates a new worktree without revealing its creation surface in the main window', async () => {
    mocks.runBackgroundWorktreeCreation.mockReturnValue('creation-1')

    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'new-worktree', existingWorktreeId: undefined }),
      floating('create-2')
    )

    expect(outcome).toEqual({ started: true })
    expectMainWindowUntouched()
    expect(mocks.runBackgroundWorktreeCreation).toHaveBeenCalledWith(
      expect.objectContaining({ agentLaunchRoute: 'structured-native-chat' }),
      { revealCreationSurface: false }
    )
    await vi.waitFor(() =>
      expect(mocks.showFloatingNewWorktreeLaunch).toHaveBeenCalledWith({
        repoId: 'repo-1',
        knownWorktreeIds: new Set(['wt-main', 'wt-fix']),
        creationId: 'creation-1',
        createTabId: 'create-2'
      })
    )
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
    expect(mocks.showFloatingCreateLaunch).not.toHaveBeenCalled()
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
