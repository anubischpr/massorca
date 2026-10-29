import { describe, expect, it } from 'vitest'
import {
  environmentHostLabel,
  environmentTiles,
  environmentWorktreeFromRow,
  folderNameFromPath,
  type MobileChatEnvironmentWorktree
} from './mobile-chat-environment'

const GIT_ROW = {
  worktreeId: 'w1',
  repoId: 'r1',
  repo: 'massorca',
  branch: 'feat/summary',
  path: 'D:\\projects\\massorca\\.claude\\worktrees\\summary',
  workspaceKind: 'git',
  hostId: 'local'
}

const WORKTREE: MobileChatEnvironmentWorktree = {
  repoId: 'r1',
  repo: 'massorca',
  branch: 'feat/summary',
  path: '/home/me/notes',
  folder: false,
  hostId: null,
  hostContextLabel: null
}

describe('environmentWorktreeFromRow', () => {
  it('reads the fields the tiles show from the matching row', () => {
    expect(environmentWorktreeFromRow('w1', GIT_ROW)).toEqual({
      repoId: 'r1',
      repo: 'massorca',
      branch: 'feat/summary',
      path: 'D:\\projects\\massorca\\.claude\\worktrees\\summary',
      folder: false,
      hostId: 'local',
      hostContextLabel: null
    })
  })

  it('answers null for another worktree or a row missing its repo', () => {
    expect(environmentWorktreeFromRow('w2', GIT_ROW)).toBeNull()
    expect(environmentWorktreeFromRow('w1', { ...GIT_ROW, repo: undefined })).toBeNull()
    expect(environmentWorktreeFromRow('w1', 'not a row')).toBeNull()
  })

  it('marks a folder workspace and keeps no branch for it', () => {
    const row = environmentWorktreeFromRow('w1', {
      ...GIT_ROW,
      workspaceKind: 'folder-workspace',
      branch: ''
    })
    expect(row?.folder).toBe(true)
    expect(row?.branch).toBe('')
  })
})

describe('environmentHostLabel', () => {
  it('names an SSH host by its target', () => {
    expect(environmentHostLabel({ ...WORKTREE, hostId: 'ssh:devbox' })).toBe('devbox')
  })

  it('prefers the catalog label when one is given', () => {
    expect(
      environmentHostLabel({ ...WORKTREE, hostId: 'ssh:devbox', hostContextLabel: 'Build box' })
    ).toBe('Build box')
  })

  it('says This computer for the paired computer', () => {
    expect(environmentHostLabel(WORKTREE)).toBe('This computer')
    expect(environmentHostLabel({ ...WORKTREE, hostId: 'local' })).toBe('This computer')
  })
})

describe('folderNameFromPath', () => {
  it('takes the last segment across both separators', () => {
    expect(folderNameFromPath('D:\\work\\notes\\')).toBe('notes')
    expect(folderNameFromPath('/home/me/notes')).toBe('notes')
    expect(folderNameFromPath('notes')).toBe('notes')
  })
})

describe('environmentTiles', () => {
  it('shows the GitHub account, project, branch and host for a git worktree', () => {
    expect(
      environmentTiles({
        worktree: WORKTREE,
        ghAccount: { host: 'github.com', user: 'octocat' }
      }).map((tile) => [tile.key, tile.value])
    ).toEqual([
      ['account', 'octocat'],
      ['project', 'massorca'],
      ['branch', 'feat/summary'],
      ['host', 'This computer']
    ])
  })

  it('hides the GitHub tile when no account is bound or the host predates the field', () => {
    expect(
      environmentTiles({ worktree: WORKTREE, ghAccount: null }).map((tile) => tile.key)
    ).toEqual(['project', 'branch', 'host'])
  })

  it('shows the folder name instead of a branch for a folder workspace', () => {
    const tiles = environmentTiles({
      worktree: { ...WORKTREE, folder: true, branch: '' },
      ghAccount: null
    })
    expect(tiles.find((tile) => tile.key === 'folder')?.value).toBe('notes')
    expect(tiles.some((tile) => tile.key === 'branch')).toBe(false)
  })
})
