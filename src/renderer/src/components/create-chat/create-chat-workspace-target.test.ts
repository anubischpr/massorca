import { describe, expect, it } from 'vitest'
import {
  canSubmitCreateChat,
  chooseCreateChatLocation,
  chooseCreateChatProject,
  createChatTerminalBlock,
  type CreateChatRepoOption,
  type CreateChatSelection,
  type CreateChatWorktreeOption
} from './create-chat-selection'

const localRepo: CreateChatRepoOption = {
  repoId: 'repo-local',
  displayName: 'massorca',
  path: 'D:/projects/massorca',
  hostId: 'local',
  isFolder: false
}
const otherLocalRepo: CreateChatRepoOption = {
  repoId: 'repo-other',
  displayName: 'notes-app',
  path: 'D:/projects/notes-app',
  hostId: 'local',
  isFolder: false
}
const sshRepo: CreateChatRepoOption = {
  repoId: 'repo-ssh',
  displayName: 'remote-app',
  path: '/srv/app',
  hostId: 'ssh:devbox',
  isFolder: false
}
const fixWorktree: CreateChatWorktreeOption = {
  worktreeId: 'wt-fix',
  repoId: 'repo-local',
  hostId: 'local',
  branch: 'fix-login-redirect',
  sessions: 2
}
const picked: CreateChatSelection = {
  executionHostId: 'local',
  project: { kind: 'repo', repoId: 'repo-local' },
  workspaceMode: 'existing-worktree',
  existingWorktreeId: 'wt-fix',
  agent: 'claude',
  accessMode: 'default'
}

describe('existing worktree target', () => {
  it('submits only into a verifiable existing worktree on the selected host', () => {
    expect(canSubmitCreateChat('Fix the login bug', picked, [localRepo], [fixWorktree])).toBe(true)
    expect(
      canSubmitCreateChat(
        'Fix the login bug',
        picked,
        [localRepo],
        [{ ...fixWorktree, sessions: null }]
      )
    ).toBe(false)
    expect(canSubmitCreateChat('Fix the login bug', picked, [localRepo], [])).toBe(false)
  })

  it('drops the pick when the location moves the project to another host', () => {
    const moved = chooseCreateChatLocation(picked, 'ssh:devbox', [localRepo, sshRepo])

    expect(moved.workspaceMode).toBe('new-worktree')
    expect(moved.existingWorktreeId).toBeUndefined()
  })

  it('drops the pick when another project is chosen', () => {
    const next = chooseCreateChatProject(picked, { kind: 'repo', repoId: otherLocalRepo.repoId })

    expect(next.workspaceMode).toBe('new-worktree')
    expect(next.existingWorktreeId).toBeUndefined()
  })

  it('keeps the pick when the same project is chosen again', () => {
    expect(chooseCreateChatProject(picked, { kind: 'repo', repoId: localRepo.repoId })).toEqual(
      picked
    )
  })
})

describe('terminal view availability', () => {
  it('blocks Terminal with the existing agent reason only for an agent without a terminal', () => {
    expect(createChatTerminalBlock('claude')).toBeNull()
    expect(createChatTerminalBlock('not-a-terminal-agent')).toBe('agent')
  })
})
