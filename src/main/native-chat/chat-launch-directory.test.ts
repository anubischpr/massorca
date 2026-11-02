import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { launchDirectoryOfChat, projectDirectoryOfChat } from './chat-launch-directory'

function chatRecord(
  launchDirectory?: string
): Pick<AgentSessionRecord, 'location' | 'launchDirectory'> {
  return {
    location: {
      executionHostId: LOCAL_EXECUTION_HOST_ID,
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree'
    },
    ...(launchDirectory === undefined ? {} : { launchDirectory })
  }
}

describe('launchDirectoryOfChat', () => {
  it('gives the directory a chat launched in, without asking its workspace', async () => {
    const resolveWorkspacePath = vi.fn(async () => '/elsewhere')
    expect(await launchDirectoryOfChat(chatRecord('/repo/launch'), resolveWorkspacePath)).toBe(
      '/repo/launch'
    )
    expect(resolveWorkspacePath).not.toHaveBeenCalled()
  })

  it('falls back to the workspace path for a chat with no launch directory of its own', async () => {
    expect(
      await launchDirectoryOfChat(chatRecord(), async (workspaceId) => `/workspaces/${workspaceId}`)
    ).toBe('/workspaces/workspace-1')
  })

  it('gives no directory when the workspace path cannot be resolved or is not known', async () => {
    expect(
      await launchDirectoryOfChat(chatRecord(), async () => {
        throw new Error('workspace gone')
      })
    ).toBeUndefined()
    expect(await launchDirectoryOfChat(chatRecord(), undefined)).toBeUndefined()
  })
})

describe('projectDirectoryOfChat', () => {
  const gone = async (): Promise<string> => {
    throw new Error('workspace gone')
  }

  it('is the chat directory while its workspace exists, without asking the repository', async () => {
    const resolveRepositoryPath = vi.fn(async () => '/repos/main')
    expect(
      await projectDirectoryOfChat(
        chatRecord(),
        async () => '/workspaces/one',
        resolveRepositoryPath
      )
    ).toBe('/workspaces/one')
    expect(resolveRepositoryPath).not.toHaveBeenCalled()
  })

  it("falls back to the repository's own path once the worktree is removed", async () => {
    expect(await projectDirectoryOfChat(chatRecord(), gone, async () => '/repos/main')).toBe(
      '/repos/main'
    )
  })

  it('gives no directory when neither the workspace nor its repository resolves', async () => {
    expect(await projectDirectoryOfChat(chatRecord(), gone, async () => undefined)).toBeUndefined()
    expect(await projectDirectoryOfChat(chatRecord(), gone, gone)).toBeUndefined()
    expect(await projectDirectoryOfChat(chatRecord(), gone, undefined)).toBeUndefined()
  })
})
