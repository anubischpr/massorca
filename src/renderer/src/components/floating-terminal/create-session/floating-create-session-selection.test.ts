import { describe, expect, it } from 'vitest'
import type { CreateChatOptions } from '@/components/create-chat/create-chat-selection'
import { FLOATING_HOST_THIS_COMPUTER } from '@/lib/floating-workspace-host'
import { floatingCreateChatSelection } from './floating-create-session-selection'

const options: CreateChatOptions = {
  hosts: [],
  repos: [
    {
      repoId: 'local-repo',
      displayName: 'local',
      path: 'D:/local',
      hostId: 'local',
      isFolder: false
    },
    {
      repoId: 'vps-repo',
      displayName: 'vps',
      path: '/srv/app',
      hostId: 'runtime:vps-env',
      isFolder: false
    },
    {
      repoId: 'vps-other',
      displayName: 'other',
      path: '/srv/other',
      hostId: 'runtime:vps-env',
      isFolder: false
    }
  ],
  preferredAgent: 'pi',
  projectlessDirectory: '',
  worktrees: [
    {
      worktreeId: 'vps-worktree',
      repoId: 'vps-other',
      hostId: 'runtime:vps-env',
      branch: 'feature',
      sessions: 1
    }
  ]
}

describe('the floating create screen preselection', () => {
  it('preselects the paired host and the workspace it starts sessions in', () => {
    expect(
      floatingCreateChatSelection(options, {
        selectedHost: 'vps-env',
        remoteWorkspaceId: 'vps-worktree'
      })
    ).toEqual({
      executionHostId: 'runtime:vps-env',
      project: { kind: 'repo', repoId: 'vps-other' },
      workspaceMode: 'existing-worktree',
      existingWorktreeId: 'vps-worktree',
      agent: 'pi',
      accessMode: 'default'
    })
  })

  it('preselects only the paired host when its workspace is not offered', () => {
    const picked = floatingCreateChatSelection(options, {
      selectedHost: 'vps-env',
      remoteWorkspaceId: null
    })
    expect(picked.executionHostId).toBe('runtime:vps-env')
    expect(picked.project).toEqual({ kind: 'repo', repoId: 'vps-repo' })
    expect(picked.workspaceMode).toBe('new-worktree')
  })

  it('keeps the composer defaults for This computer', () => {
    const picked = floatingCreateChatSelection(options, {
      selectedHost: FLOATING_HOST_THIS_COMPUTER,
      remoteWorkspaceId: null
    })
    expect(picked.executionHostId).toBe('local')
    expect(picked.project).toEqual({ kind: 'repo', repoId: 'local-repo' })
  })
})
