import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionStatusSummary } from '../../shared/agent-session-wire'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { Repo } from '../../shared/repo-types'
import type { Store } from '../persistence'

const {
  gitExecFileAsyncMock,
  generateBranchNameMock,
  resolveTextGenerationParamsMock,
  prepareLocalEnvMock
} = vi.hoisted(() => ({
  gitExecFileAsyncMock: vi.fn(),
  generateBranchNameMock: vi.fn(),
  resolveTextGenerationParamsMock: vi.fn(),
  prepareLocalEnvMock: vi.fn(async () => ({ ok: true as const }))
}))

vi.mock('../git/runner', () => ({ gitExecFileAsync: gitExecFileAsyncMock }))
vi.mock('../git/git-username', () => ({
  getSshGitUsername: vi.fn(async () => 'palominoc'),
  resolveLocalGitUsername: vi.fn(async () => 'palominoc')
}))
vi.mock('../providers/ssh-git-dispatch', () => ({ getSshGitProvider: vi.fn(() => undefined) }))
vi.mock('../text-generation/commit-message-text-generation', () => ({
  generateBranchNameFromContext: generateBranchNameMock,
  resolveTextGenerationParams: resolveTextGenerationParamsMock
}))
vi.mock('../text-generation/commit-message-agent-environment', () => ({
  prepareLocalCommitMessageAgentEnv: prepareLocalEnvMock
}))
vi.mock('../ipc/worktree-logic', () => ({
  computeBranchName: (leaf: string) => `palominoc/${leaf}`,
  getConfiguredBranchPrefix: () => 'palominoc'
}))

import { maybeAutoRenameWorkspaceOnFirstStructuredTurn } from './first-work-structured-session-rename'
import { firstWorkRenameDeps } from './first-work-rename-runtime'
import { resetFirstWorkBranchRenameState } from './first-work-branch-rename'
import { gitResponder } from './first-work-branch-rename-test-harness'
import { WORKTREE_ID_SEPARATOR } from '../../shared/worktree/id'

const REPO_ID = 'repo-phone'
const WORKTREE_ID = `${REPO_ID}${WORKTREE_ID_SEPARATOR}/work/cisco`

/** A worktree as `worktree.create` leaves it for a phone create: runtime-stamped, generated name. */
function phoneCreatedStore(meta: Record<string, unknown>) {
  const settings = { autoRenameBranchFromWork: true } as unknown as GlobalSettings
  const repo = { id: REPO_ID, path: '/work/repo', connectionId: undefined } as unknown as Repo
  const setWorktreeMeta = vi.fn()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the rename deps read only these four members of the store.
  const store = {
    getSettings: () => settings,
    getRepo: () => repo,
    getWorktreeMeta: () => meta,
    setWorktreeMeta,
    getWorktreeIdForTab: () => undefined
  } as unknown as Store
  return { store, setWorktreeMeta }
}

function runtimeStub() {
  return {
    getCommitMessageAgentEnvironmentResolvers: () => undefined,
    notifyFolderWorkspaceChanged: vi.fn(),
    notifyBranchRenamed: vi.fn(),
    notifyWorktreeFolderRenamed: vi.fn()
  }
}

/** The status the structured host publishes once the launch prompt starts the first turn. */
function firstTurn(latestPrompt: string): AgentSessionStatusSummary {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the structured rename reads only status, workspaceId and latestPrompt.
  return { status: 'working', workspaceId: WORKTREE_ID, latestPrompt } as AgentSessionStatusSummary
}

describe('the first-work rename of a chat created from the phone', () => {
  beforeEach(() => {
    resetFirstWorkBranchRenameState()
    vi.clearAllMocks()
    resolveTextGenerationParamsMock.mockReturnValue({
      ok: true,
      params: { agentId: 'claude', model: 'm' }
    })
    generateBranchNameMock.mockResolvedValue({ success: true, slug: 'fix-auth' })
    gitExecFileAsyncMock.mockImplementation(
      gitResponder({ currentBranch: 'palominoc/cisco', hasUpstream: false })
    )
  })

  it('renames the branch and the display name from the first message', async () => {
    const { store, setWorktreeMeta } = phoneCreatedStore({
      orcaCreationSource: 'runtime',
      displayName: 'cisco'
    })
    const runtime = runtimeStub()
    await maybeAutoRenameWorkspaceOnFirstStructuredTurn(
      firstTurn('Fix the auth bug'),
      { replay: false },
      firstWorkRenameDeps(store, runtime)
    )
    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(
      ['branch', '-m', 'palominoc/fix-auth'],
      expect.anything()
    )
    expect(setWorktreeMeta).toHaveBeenCalledWith(
      WORKTREE_ID,
      expect.objectContaining({ displayName: 'Fix auth', displayNameIsPinned: true })
    )
    expect(runtime.notifyBranchRenamed).toHaveBeenCalledWith(REPO_ID)
  })

  it('also renames a create that left no display name at all', async () => {
    const { store, setWorktreeMeta } = phoneCreatedStore({ orcaCreationSource: 'runtime' })
    await maybeAutoRenameWorkspaceOnFirstStructuredTurn(
      firstTurn('Fix the auth bug'),
      { replay: false },
      firstWorkRenameDeps(store, runtimeStub())
    )
    expect(setWorktreeMeta).toHaveBeenCalledWith(
      WORKTREE_ID,
      expect.objectContaining({ displayName: 'Fix auth' })
    )
  })

  it.each([
    ['a create the host did not stamp as its own', { displayName: 'cisco' }],
    [
      'a worktree the user asked to keep',
      { orcaCreationSource: 'runtime', preserveBranchOnDelete: true }
    ]
  ])('leaves %s alone', async (_name, meta) => {
    const { store, setWorktreeMeta } = phoneCreatedStore(meta)
    await maybeAutoRenameWorkspaceOnFirstStructuredTurn(
      firstTurn('Fix the auth bug'),
      { replay: false },
      firstWorkRenameDeps(store, runtimeStub())
    )
    expect(gitExecFileAsyncMock).not.toHaveBeenCalledWith(
      expect.arrayContaining(['branch', '-m']),
      expect.anything()
    )
    expect(setWorktreeMeta).not.toHaveBeenCalledWith(
      WORKTREE_ID,
      expect.objectContaining({ displayName: expect.any(String) })
    )
  })

  it('keeps a name the user typed on the phone', async () => {
    const { store, setWorktreeMeta } = phoneCreatedStore({
      orcaCreationSource: 'runtime',
      displayName: 'Login rewrite'
    })
    await maybeAutoRenameWorkspaceOnFirstStructuredTurn(
      firstTurn('Fix the auth bug'),
      { replay: false },
      firstWorkRenameDeps(store, runtimeStub())
    )
    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(
      ['branch', '-m', 'palominoc/fix-auth'],
      expect.anything()
    )
    expect(setWorktreeMeta).not.toHaveBeenCalledWith(
      WORKTREE_ID,
      expect.objectContaining({ displayName: expect.any(String) })
    )
  })

  it('does nothing without a first message', async () => {
    const { store } = phoneCreatedStore({ orcaCreationSource: 'runtime', displayName: 'cisco' })
    await maybeAutoRenameWorkspaceOnFirstStructuredTurn(
      firstTurn('   '),
      { replay: false },
      firstWorkRenameDeps(store, runtimeStub())
    )
    expect(generateBranchNameMock).not.toHaveBeenCalled()
  })
})
