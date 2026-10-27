// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  makeCreatedAgentWorktree,
  seedEmptyActivatableWorktree
} from '@/lib/worktree-activation-created-agent-test-state'
import type { Worktree } from '../../../../shared/worktree/types'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { CreateChatSelection } from './create-chat-selection'

// Why: the host's answers are the only thing faked; tab creation runs through the real store and
// the real activation and structured-launch code, so a second tab cannot slip past a mock.
vi.mock('@/runtime/structured-agent-session-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callStructuredAgentSession: vi.fn(async (_target: unknown, method: string) =>
    method === 'agentSession.createSupport' ? { supported: true } : {}
  )
}))

import { submitCreateChatDraft } from './create-chat-submit'

const initialAppStoreState = useAppStore.getState()
const SETUP_SCRIPT = { runnerScriptPath: '/tmp/setup.sh', envVars: {} }

function selection(overrides: Partial<CreateChatSelection>): CreateChatSelection {
  return {
    executionHostId: 'local',
    project: { kind: 'repo', repoId: 'repo-1' },
    workspaceMode: 'new-worktree',
    agent: 'claude',
    accessMode: 'default',
    ...overrides
  }
}

function tabKinds(workspaceId: string): string[] {
  const state = useAppStore.getState()
  return (state.unifiedTabsByWorktree[workspaceId] ?? []).map((tab) => tab.contentType)
}

async function settleLaunch(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1_500))
}

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      runtime: { call: vi.fn(async () => ({})) },
      pty: {
        listSessions: vi.fn(async () => []),
        spawn: vi.fn(async () => ({ id: 'pty-setup' })),
        kill: vi.fn(async () => undefined)
      },
      worktreeSetupRuns: { register: vi.fn(async () => ({ ok: true })) },
      projectlessChats: { createWorkspace: vi.fn() }
    }
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, 'api')
  useAppStore.setState(initialAppStoreState, true)
  vi.restoreAllMocks()
})

describe('create-chat opens only the chat tab', () => {
  it('in the current checkout', async () => {
    const primary: Worktree = { ...makeCreatedAgentWorktree(), isMainWorktree: true }
    seedEmptyActivatableWorktree(primary)

    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'current-checkout' })
    )
    await settleLaunch()

    expect(outcome).toEqual({ started: true })
    expect(tabKinds(primary.id)).toEqual(['agent-session'])
    expect(useAppStore.getState().tabsByWorktree[primary.id] ?? []).toHaveLength(0)
  })

  it('in a new projectless folder workspace', async () => {
    seedEmptyActivatableWorktree({ ...makeCreatedAgentWorktree(), isMainWorktree: true })
    const folder: FolderWorkspace = {
      id: 'f1',
      projectGroupId: 'g1',
      name: 'chat',
      folderPath: 'C:/chats/2026-10-26/fix-login',
      linkedTask: null,
      comment: '',
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0,
      createdAt: 0,
      updatedAt: 0
    }
    useAppStore.setState({
      folderWorkspaces: [folder],
      fetchProjectGroupsForAllHosts: vi.fn(async () => undefined),
      fetchFolderWorkspacesForAllHosts: vi.fn(async () => undefined)
    })
    vi.mocked(window.api.projectlessChats.createWorkspace).mockResolvedValue({
      ok: true,
      workspaceKey: 'folder:f1',
      workspace: folder,
      folderPath: folder.folderPath
    })

    const outcome = await submitCreateChatDraft(
      'Fix login',
      selection({ project: { kind: 'none' } })
    )
    await settleLaunch()

    expect(outcome).toEqual({ started: true })
    expect(tabKinds('folder:f1')).toEqual(['agent-session'])
  })

  it('in a new worktree of a repo with a setup script', async () => {
    seedEmptyActivatableWorktree({ ...makeCreatedAgentWorktree(), isMainWorktree: true })
    const created: Worktree = {
      ...makeCreatedAgentWorktree(),
      id: 'repo-1::/workspace/fix-login',
      path: '/workspace/fix-login'
    }
    // The host returns the repo's setup script for a 'run' decision; the chat puts it in a hidden PTY.
    const createWorktree = vi.fn(async (...args: unknown[]) => {
      useAppStore.setState((state) => ({
        worktreesByRepo: {
          ...state.worktreesByRepo,
          'repo-1': [...(state.worktreesByRepo['repo-1'] ?? []), created]
        }
      }))
      // Why: a repo with default tabs returns them too; a chat-first create must not open them.
      return {
        worktree: created,
        ...(args[3] === 'run'
          ? {
              setup: SETUP_SCRIPT,
              defaultTabs: { tabs: [{ title: 'Server', command: 'pnpm dev' }], runCommands: true }
            }
          : {})
      }
    })
    useAppStore.setState({ createWorktree })

    const outcome = await submitCreateChatDraft('Fix login', selection({}))
    await settleLaunch()

    expect(outcome).toEqual({ started: true })
    expect(createWorktree).toHaveBeenCalledOnce()
    // Why: the chat is the only tab; the setup PTY has no tab record at all.
    expect(tabKinds(created.id)).toEqual(['agent-session'])
    expect(useAppStore.getState().tabsByWorktree[created.id] ?? []).toHaveLength(0)
    expect(window.api.pty.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: created.id, cwd: created.path })
    )
    expect(window.api.worktreeSetupRuns.register).toHaveBeenCalledWith({
      ptyId: 'pty-setup',
      worktreeId: created.id
    })
  })

  it('does not throw for a repo that asks each time, because create-chat always decides run', async () => {
    seedEmptyActivatableWorktree({ ...makeCreatedAgentWorktree(), isMainWorktree: true })
    const created: Worktree = {
      ...makeCreatedAgentWorktree(),
      id: 'repo-1::/workspace/ask-policy',
      path: '/workspace/ask-policy'
    }
    const createWorktree = vi.fn(async (...args: unknown[]) => {
      useAppStore.setState((state) => ({
        worktreesByRepo: {
          ...state.worktreesByRepo,
          'repo-1': [...(state.worktreesByRepo['repo-1'] ?? []), created]
        }
      }))
      // Why: the real host throws "Setup decision required" for an 'inherit' create on an ask repo.
      if (args[3] !== 'run') {
        throw new Error('Setup decision required for this repository')
      }
      return { worktree: created, setup: SETUP_SCRIPT }
    })
    useAppStore.setState({ createWorktree })

    const outcome = await submitCreateChatDraft('Fix login', selection({}))
    await settleLaunch()

    expect(outcome).toEqual({ started: true })
    // Why: argument 3 of createWorktree is the setup decision.
    expect(createWorktree.mock.calls[0]?.[3]).toBe('run')
    expect(tabKinds(created.id)).toEqual(['agent-session'])
  })
})
