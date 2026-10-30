import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { launchDirectoryOfChat } from './chat-launch-directory'

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
