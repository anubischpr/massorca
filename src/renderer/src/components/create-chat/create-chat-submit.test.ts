// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { CreateChatSelection } from './create-chat-selection'

type StoreFixture = {
  repos: Repo[]
  worktreesByRepo: Record<string, { id: string; isMainWorktree: boolean }[]>
  fetchProjectGroupsForAllHosts: ReturnType<typeof vi.fn>
  fetchFolderWorkspacesForAllHosts: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => {
  const store: StoreFixture = {
    repos: [],
    worktreesByRepo: {},
    fetchProjectGroupsForAllHosts: vi.fn(),
    fetchFolderWorkspacesForAllHosts: vi.fn()
  }
  return {
    store,
    getWorkspaceSeedName: vi.fn(),
    activateAndRevealWorkspace: vi.fn(),
    runBackgroundWorktreeCreation: vi.fn(),
    beginStructuredAgentSessionProvisionalLaunch: vi.fn(),
    holdStructuredAgentSessionLaunchPicks: vi.fn()
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
vi.mock('@/lib/agent-session-launch-plan', () => ({
  // Why: the verdict is the plan's data; the launch itself is mocked at its own boundary.
  adoptAgentSessionLaunchVerdict: <T>(verdict: T): T => verdict
}))

import { submitCreateChatDraft, createChatSeedPicks } from './create-chat-submit'

const createWorkspace = vi.fn()

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
    workspaceMode: 'new-worktree',
    agent: 'claude',
    accessMode: 'default',
    ...overrides
  }
}

const projectless = selection({ project: { kind: 'none' } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store.repos = [
    repo({ id: 'repo-1' }),
    repo({ id: 'repo-folder', kind: 'folder' }),
    repo({ id: 'repo-ssh', connectionId: 'devbox' })
  ]
  mocks.store.worktreesByRepo = {
    'repo-1': [
      { id: 'repo-1::D:/projects/repo-1', isMainWorktree: true },
      { id: 'repo-1::D:/projects/repo-1-feature', isMainWorktree: false }
    ],
    'repo-folder': [{ id: 'repo-folder::D:/projects/repo-folder', isMainWorktree: true }]
  }
  mocks.store.fetchProjectGroupsForAllHosts.mockResolvedValue(undefined)
  mocks.store.fetchFolderWorkspacesForAllHosts.mockResolvedValue(undefined)
  mocks.getWorkspaceSeedName.mockReturnValue('fix-login')
  mocks.activateAndRevealWorkspace.mockReturnValue({ primaryTabId: 'tab-1' })
  mocks.beginStructuredAgentSessionProvisionalLaunch.mockReturnValue({
    sessionId: 'session-1',
    tab: { id: 'tab-1' }
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { projectlessChats: { createWorkspace } }
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, 'api')
  vi.restoreAllMocks()
})

describe('submitCreateChatDraft', () => {
  it('creates a projectless folder workspace and launches the chat in it', async () => {
    createWorkspace.mockResolvedValue({
      ok: true,
      workspaceKey: 'folder:f1',
      workspace: {},
      folderPath: 'C:/chats/2026-10-26/fix-login'
    })

    const outcome = await submitCreateChatDraft('Fix login', projectless)

    expect(outcome).toEqual({ started: true })
    expect(createWorkspace).toHaveBeenCalledWith({ title: 'Fix login', connectionId: null })
    expect(mocks.store.fetchProjectGroupsForAllHosts).toHaveBeenCalledWith({
      remoteHosts: 'skip'
    })
    expect(mocks.store.fetchFolderWorkspacesForAllHosts).toHaveBeenCalledWith({
      remoteHosts: 'skip'
    })
    expect(mocks.activateAndRevealWorkspace).toHaveBeenCalledWith('folder:f1', {
      providesInitialSurface: true
    })
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({
          route: 'structured-native-chat',
          agent: 'claude',
          worktreeId: 'folder:f1',
          executionHostId: 'local',
          prompt: 'Fix login',
          promptDelivery: 'auto-submit'
        }),
        target: { worktreeId: 'folder:f1', executionHostId: 'local' },
        activate: true
      })
    )
    expect(mocks.holdStructuredAgentSessionLaunchPicks).toHaveBeenCalledWith('session-1', {
      accessMode: 'default'
    })
    expect(mocks.runBackgroundWorktreeCreation).not.toHaveBeenCalled()
  })

  it('reports the IPC error and keeps the launch and the workspace untouched', async () => {
    createWorkspace.mockResolvedValue({ ok: false, code: 'web_runtime_unsupported' })

    const outcome = await submitCreateChatDraft('Fix login', projectless)

    expect(outcome).toEqual({
      started: false,
      message: 'Projectless chats are not available in this client.'
    })
    expect(mocks.activateAndRevealWorkspace).not.toHaveBeenCalled()
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).not.toHaveBeenCalled()
  })

  it('creates a new worktree named from the draft and hands the chat to the create flow', async () => {
    const outcome = await submitCreateChatDraft('Fix login', selection())

    expect(outcome).toEqual({ started: true })
    expect(mocks.getWorkspaceSeedName).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Fix login', explicitName: '' })
    )
    expect(mocks.runBackgroundWorktreeCreation).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo-1',
        executionHostId: 'local',
        name: 'fix-login',
        setupDecision: 'skip',
        agent: 'claude',
        agentLaunchRoute: 'structured-native-chat',
        quickPrompt: 'Fix login',
        promptDelivery: 'auto-submit',
        structuredSeedPicks: { accessMode: 'default' }
      })
    )
    expect(mocks.activateAndRevealWorkspace).not.toHaveBeenCalled()
  })

  it('creates the new worktree on the SSH host the project lives on', async () => {
    await submitCreateChatDraft(
      'Fix login',
      selection({ executionHostId: 'ssh:devbox', project: { kind: 'repo', repoId: 'repo-ssh' } })
    )

    expect(mocks.runBackgroundWorktreeCreation).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: 'repo-ssh', executionHostId: 'ssh:devbox' })
    )
  })

  it('opens the primary checkout without creating anything for current checkout', async () => {
    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'current-checkout' })
    )

    expect(outcome).toEqual({ started: true })
    expect(mocks.activateAndRevealWorkspace).toHaveBeenCalledWith('repo-1::D:/projects/repo-1', {
      providesInitialSurface: true
    })
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { worktreeId: 'repo-1::D:/projects/repo-1', executionHostId: 'local' }
      })
    )
    expect(mocks.runBackgroundWorktreeCreation).not.toHaveBeenCalled()
  })

  it('uses the primary folder workspace for a folder project and never creates a worktree', async () => {
    const outcome = await submitCreateChatDraft(
      'Notes',
      selection({ project: { kind: 'repo', repoId: 'repo-folder' } })
    )

    expect(outcome).toEqual({ started: true })
    expect(mocks.activateAndRevealWorkspace).toHaveBeenCalledWith(
      'repo-folder::D:/projects/repo-folder',
      { providesInitialSurface: true }
    )
    expect(mocks.runBackgroundWorktreeCreation).not.toHaveBeenCalled()
  })

  it('reports a workspace that cannot be opened and leaves the draft to the view', async () => {
    mocks.activateAndRevealWorkspace.mockReturnValue(false)

    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'current-checkout' })
    )

    expect(outcome).toEqual({
      started: false,
      message: 'Could not open the workspace for this chat. Your draft is kept.'
    })
    expect(mocks.beginStructuredAgentSessionProvisionalLaunch).not.toHaveBeenCalled()
  })

  it('reports a launch that could not begin', async () => {
    mocks.beginStructuredAgentSessionProvisionalLaunch.mockReturnValue(null)

    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'current-checkout' })
    )

    expect(outcome).toEqual({
      started: false,
      message: 'Could not start the session. Your draft is kept.'
    })
  })

  it('reports a project that is no longer in the repo list', async () => {
    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ project: { kind: 'repo', repoId: 'gone' } })
    )

    expect(outcome).toEqual({
      started: false,
      message: 'This project is no longer available. Pick another one.'
    })
    expect(mocks.runBackgroundWorktreeCreation).not.toHaveBeenCalled()
  })

  it('turns an unexpected throw into a failed outcome instead of rejecting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createWorkspace.mockRejectedValue(new Error('ipc down'))

    const outcome = await submitCreateChatDraft('Fix login', projectless)

    expect(outcome).toEqual({
      started: false,
      message: 'Could not start the session. Your draft is kept.'
    })
  })
})

describe('createChatSeedPicks', () => {
  it('carries model and effort only when they were chosen, and always the permission preset', () => {
    expect(createChatSeedPicks(selection())).toEqual({ accessMode: 'default' })
    expect(
      createChatSeedPicks(selection({ model: 'opus', effort: 'high', accessMode: 'accept-edits' }))
    ).toEqual({ model: 'opus', effort: 'high', accessMode: 'accept-edits' })
  })
})
