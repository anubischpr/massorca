import { describe, expect, it } from 'vitest'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { getSessionWorktreeRemoval } from './worktree-card-one-line-session-worktree-submenu'

describe('getSessionWorktreeRemoval', () => {
  it('deletes a linked git worktree', () => {
    expect(getSessionWorktreeRemoval({ id: 'repo::/wt', isMainWorktree: false })).toEqual({
      kind: 'worktree'
    })
  })

  it('offers no removal for a main checkout, which would remove the whole project', () => {
    expect(getSessionWorktreeRemoval({ id: 'repo::/main', isMainWorktree: true })).toBeNull()
  })

  it('removes a folder workspace through its own flow', () => {
    expect(
      getSessionWorktreeRemoval({
        id: folderWorkspaceKey('folder-1'),
        isMainWorktree: false
      })
    ).toEqual({ kind: 'folder', folderWorkspaceId: 'folder-1' })
  })
})
