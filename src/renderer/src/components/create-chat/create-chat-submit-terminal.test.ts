// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { CreateChatSelection } from './create-chat-selection'

type StoreFixture = {
  repos: Repo[]
  worktreesByRepo: Record<string, { id: string; path: string; isMainWorktree: boolean }[]>
  fetchProjectGroupsForAllHosts: ReturnType<typeof vi.fn>
  fetchFolderWorkspacesForAllHosts: ReturnType<typeof vi.fn>
  setTabViewMode: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => {
  const store: StoreFixture = {
    repos: [],
    worktreesByRepo: {},
    fetchProjectGroupsForAllHosts: vi.fn(),
    fetchFolderWorkspacesForAllHosts: vi.fn(),
    setTabViewMode: vi.fn()
  }
  return {
    store,
    getWorkspaceSeedName: vi.fn(),
    activateAndRevealWorkspace: vi.fn(),
    runBackgroundWorktreeCreation: vi.fn(),
    beginStructuredAgentSessionProvisionalLaunch: vi.fn(),
    holdStructuredAgentSessionLaunchPicks: vi.fn(),
    launchAgentInNewTab: vi.fn(),
    buildCreateChatTerminalStartup: vi.fn()
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
vi.mock('@/lib/agent-session-launch-plan', () => ({
  // Why: the verdict is the plan's data; the launch itself is mocked at its own boundary.
  adoptAgentSessionLaunchVerdict: <T>(verdict: T): T => verdict
}))
vi.mock('./create-chat-terminal-startup', () => ({
  buildCreateChatTerminalStartup: mocks.buildCreateChatTerminalStartup
}))

import { submitCreateChatDraft } from './create-chat-submit'

function repo(overrides: Partial<Repo> & Pick<Repo, 'id'>): Repo {
  return {
    path: `D:/projects/${overrides.id}`,
    displayName: overrides.id,
    badgeColor: '#999999',
    addedAt: 1,
    ...overrides
  }
}

function selection(overrides: Partial<CreateChatSelection> = {}): CreateChatSelection {
  return {
    executionHostId: 'local',
    project: { kind: 'repo', repoId: 'repo-1' },
    workspaceMode: 'current-checkout',
    agent: 'claude',
    accessMode: 'default',
    sessionView: 'terminal',
    ...overrides
  }
}

const mainOnly = [{ id: 'wt-main', path: 'D:/projects/repo-1', isMainWorktree: true }]
const withFix = [
  ...mainOnly,
  { id: 'wt-fix', path: 'D:/projects/repo-1-fix', isMainWorktree: false }
]

describe('submitCreateChatDraft in terminal view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.store.repos = [repo({ id: 'repo-1' })]
    mocks.store.worktreesByRepo = { 'repo-1': mainOnly }
    mocks.activateAndRevealWorkspace.mockReturnValue({})
    mocks.launchAgentInNewTab.mockReturnValue({
      surface: { kind: 'local-terminal', tabId: 'tab-1' }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens the agent in a terminal tab on the terminal route instead of a structured chat', async () => {
    const outcome = await submitCreateChatDraft('Fix the login bug', selection())

    expect(outcome).toEqual({ started: true })
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).not.toHaveBeenCalled()
    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'claude',
        worktreeId: 'wt-main',
        prompt: 'Fix the login bug',
        promptDelivery: 'auto-submit',
        agentSessionLaunchPlan: expect.objectContaining({
          route: 'terminal-tui',
          agent: 'claude',
          worktreeId: 'wt-main'
        })
      })
    )
  })

  it('puts the opened terminal tab in terminal view through the tab view mode action', async () => {
    await submitCreateChatDraft('Fix the login bug', selection())

    expect(mocks.store.setTabViewMode).toHaveBeenCalledWith('tab-1', 'terminal')
  })

  it('launches the terminal in the picked existing worktree', async () => {
    mocks.store.worktreesByRepo = { 'repo-1': withFix }

    await submitCreateChatDraft(
      'Fix the login bug',
      selection({ workspaceMode: 'existing-worktree', existingWorktreeId: 'wt-fix' })
    )

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'wt-fix' })
    )
  })

  it('keeps the draft and names the reason when the picked worktree no longer exists', async () => {
    mocks.store.worktreesByRepo = { 'repo-1': mainOnly }

    const outcome = await submitCreateChatDraft(
      'Fix the login bug',
      selection({
        workspaceMode: 'existing-worktree',
        existingWorktreeId: 'wt-gone',
        sessionView: 'chat'
      })
    )

    expect(outcome).toEqual({
      started: false,
      message: 'This worktree is no longer available. Pick another one.'
    })
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).not.toHaveBeenCalled()
  })

  it('keeps the draft and says the session did not start when no terminal opens', async () => {
    mocks.launchAgentInNewTab.mockReturnValueOnce(null)

    const outcome = await submitCreateChatDraft('Fix the login bug', selection())

    expect(outcome).toEqual({
      started: false,
      message: 'Could not start the session. Your draft is kept.'
    })
  })

  it('creates a new worktree whose startup runs the agent in a terminal', async () => {
    const startupPlan = { agent: 'claude', launchCommand: 'claude "Fix the login bug"' }
    const startup = { command: 'claude "Fix the login bug"' }
    mocks.buildCreateChatTerminalStartup.mockReturnValueOnce({
      startupPlan,
      backendStartup: startup,
      telemetry: null
    })

    await submitCreateChatDraft('Fix the login bug', selection({ workspaceMode: 'new-worktree' }))

    expect(mocks.runBackgroundWorktreeCreation).toHaveBeenCalledWith(
      expect.objectContaining({
        agentLaunchRoute: 'terminal-tui',
        quickPrompt: 'Fix the login bug',
        startupPlan,
        startup
      })
    )
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).not.toHaveBeenCalled()
  })
})
