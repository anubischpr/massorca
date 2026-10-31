import { describe, expect, it } from 'vitest'
import {
  displayBranchName,
  folderNameFromPath,
  getBranchCollisionChips,
  resolveBranchRowLabel,
  type BranchCollisionEntry
} from './branch-row-label'

describe('resolveBranchRowLabel', () => {
  it('labels a git row with its branch, without the refs/heads prefix', () => {
    expect(
      resolveBranchRowLabel({
        workspaceKind: 'git',
        repo: 'orca',
        branch: 'refs/heads/feature/login'
      })
    ).toEqual({ label: 'feature/login', icon: 'branch' })
  })

  it('prefers the row name the user set over the branch', () => {
    expect(
      resolveBranchRowLabel({
        repo: 'orca',
        branch: 'feature/login',
        manualDisplayName: 'Login rework'
      }).label
    ).toBe('Login rework')
  })

  it('ignores a blank row name', () => {
    expect(
      resolveBranchRowLabel({ repo: 'orca', branch: 'feature/login', manualDisplayName: '   ' })
        .label
    ).toBe('feature/login')
  })

  it('falls back to the repo only when there is no branch at all', () => {
    expect(resolveBranchRowLabel({ repo: 'orca', branch: '' })).toEqual({
      label: 'orca',
      icon: 'branch'
    })
  })

  it('labels a folder workspace with its folder name and the folder icon', () => {
    expect(
      resolveBranchRowLabel({
        workspaceKind: 'folder-workspace',
        repo: 'notes',
        branch: '',
        path: '/home/me/notes-folder'
      })
    ).toEqual({ label: 'notes-folder', icon: 'folder' })
  })

  it('takes the folder name from a Windows path', () => {
    expect(
      resolveBranchRowLabel({
        workspaceKind: 'folder-workspace',
        repo: 'docs',
        branch: '',
        path: 'C:\\Users\\me\\Docs\\'
      }).label
    ).toBe('Docs')
  })

  it('falls back to the repo for a folder workspace with no path', () => {
    expect(
      resolveBranchRowLabel({ workspaceKind: 'folder-workspace', repo: 'notes', branch: '' }).label
    ).toBe('notes')
  })

  it('still prefers the row name for a folder workspace', () => {
    expect(
      resolveBranchRowLabel({
        workspaceKind: 'folder-workspace',
        repo: 'notes',
        branch: '',
        path: '/home/me/notes-folder',
        manualDisplayName: 'Notes'
      }).label
    ).toBe('Notes')
  })
})

describe('branch helpers', () => {
  it('strips only the refs/heads prefix', () => {
    expect(displayBranchName('refs/heads/main')).toBe('main')
    expect(displayBranchName('feature/refs/heads-kept')).toBe('feature/refs/heads-kept')
    expect(displayBranchName('')).toBe('')
  })

  it('reads the last non-empty path segment for either separator', () => {
    expect(folderNameFromPath('/a/b/c/')).toBe('c')
    expect(folderNameFromPath('D:\\projects\\massorca')).toBe('massorca')
    expect(folderNameFromPath(undefined)).toBe('')
  })
})

describe('getBranchCollisionChips', () => {
  const entry = (overrides: Partial<BranchCollisionEntry>): BranchCollisionEntry => ({
    key: 'row',
    scope: '',
    branch: 'fix-login',
    repo: 'nexuscare',
    hostKey: 'local',
    ...overrides
  })

  it('names the host when the same branch runs on two hosts of one project', () => {
    const chips = getBranchCollisionChips([
      entry({ key: 'a', hostKey: 'local', hostLabel: 'This device' }),
      entry({ key: 'b', hostKey: 'ssh:pv', hostLabel: 'pv-vps' })
    ])
    expect(chips.get('a')).toBe('This device')
    expect(chips.get('b')).toBe('pv-vps')
  })

  it('names the project when two projects on one host share a branch', () => {
    const chips = getBranchCollisionChips([
      entry({ key: 'a', branch: 'main', repo: 'nexuscare' }),
      entry({ key: 'b', branch: 'main', repo: 'massorca' })
    ])
    expect(chips.get('a')).toBe('nexuscare')
    expect(chips.get('b')).toBe('massorca')
  })

  it('gives no chip to a branch that is unique in its scope', () => {
    const chips = getBranchCollisionChips([
      entry({ key: 'a', branch: 'one' }),
      entry({ key: 'b', branch: 'two' })
    ])
    expect(chips.size).toBe(0)
  })

  it('does not match rows across repo sections', () => {
    const chips = getBranchCollisionChips([
      entry({ key: 'a', scope: 'nexuscare', branch: 'main', repo: 'nexuscare' }),
      entry({ key: 'b', scope: 'massorca', branch: 'main', repo: 'massorca' })
    ])
    expect(chips.size).toBe(0)
  })

  it('ignores folder workspaces and rows with no branch', () => {
    const chips = getBranchCollisionChips([
      entry({ key: 'a', branch: '', repo: 'notes' }),
      entry({ key: 'b', branch: '', repo: 'docs' })
    ])
    expect(chips.size).toBe(0)
  })

  it('shows no host chip when the hosts differ but no host label is known', () => {
    const chips = getBranchCollisionChips([
      entry({ key: 'a', hostKey: 'local' }),
      entry({ key: 'b', hostKey: 'ssh:pv' })
    ])
    expect(chips.size).toBe(0)
  })
})
