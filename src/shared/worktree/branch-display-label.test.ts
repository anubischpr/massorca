import { describe, expect, it } from 'vitest'
import {
  getBranchDisplayLabels,
  getOwnBranchPrefix,
  normalizeManualDisplayName,
  resolveOneLineRowLabel,
  stripOwnBranchPrefix
} from './branch-display-label'

describe('own branch prefix', () => {
  it('uses the git username when the strategy asks for it', () => {
    expect(getOwnBranchPrefix({ branchPrefix: 'git-username' }, ' alice ')).toBe('alice')
  })

  it('uses the custom prefix without surrounding slashes', () => {
    expect(
      getOwnBranchPrefix({ branchPrefix: 'custom', branchPrefixCustom: '/team/fe/' }, null)
    ).toBe('team/fe')
  })

  it('has no prefix when none is configured or the setting is unreachable', () => {
    expect(getOwnBranchPrefix({ branchPrefix: 'none' }, 'alice')).toBeNull()
    expect(getOwnBranchPrefix({ branchPrefix: 'git-username' }, undefined)).toBeNull()
    expect(getOwnBranchPrefix(null, 'alice')).toBeNull()
    // A partial settings object (no strategy at all) must not throw.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
    expect(getOwnBranchPrefix({} as never, 'alice')).toBeNull()
  })

  it('ignores a prefix git would reject', () => {
    expect(
      getOwnBranchPrefix({ branchPrefix: 'custom', branchPrefixCustom: 'a b' }, null)
    ).toBeNull()
  })
})

describe('stripOwnBranchPrefix', () => {
  it('hides only the user prefix', () => {
    expect(stripOwnBranchPrefix('alice/fix-login', 'alice')).toBe('fix-login')
    expect(stripOwnBranchPrefix('bob/fix-login', 'alice')).toBe('bob/fix-login')
    expect(stripOwnBranchPrefix('alicegreen/fix', 'alice')).toBe('alicegreen/fix')
  })

  it('keeps the full branch when nothing would remain or no prefix applies', () => {
    expect(stripOwnBranchPrefix('alice/', 'alice')).toBe('alice/')
    expect(stripOwnBranchPrefix('alice/fix', null)).toBe('alice/fix')
  })
})

describe('getBranchDisplayLabels', () => {
  it('strips the prefix when the short label is unique', () => {
    const labels = getBranchDisplayLabels([
      { key: 'a', branch: 'alice/fix', scope: 'p', ownPrefix: 'alice' },
      { key: 'b', branch: 'main', scope: 'p', ownPrefix: 'alice' }
    ])
    expect(labels.get('a')).toBe('fix')
    expect(labels.get('b')).toBe('main')
  })

  it('shows full names when two different branches would share one short label', () => {
    const labels = getBranchDisplayLabels([
      { key: 'a', branch: 'alice/fix', scope: 'p', ownPrefix: 'alice' },
      { key: 'b', branch: 'fix', scope: 'p', ownPrefix: 'alice' }
    ])
    expect(labels.get('a')).toBe('alice/fix')
    expect(labels.get('b')).toBe('fix')
  })

  it('does not compare across scopes', () => {
    const labels = getBranchDisplayLabels([
      { key: 'a', branch: 'alice/fix', scope: 'p1', ownPrefix: 'alice' },
      { key: 'b', branch: 'fix', scope: 'p2', ownPrefix: 'alice' }
    ])
    expect(labels.get('a')).toBe('fix')
  })

  it('keeps the same branch on two hosts under one short label', () => {
    const labels = getBranchDisplayLabels([
      { key: 'a', branch: 'alice/fix', scope: 'p', ownPrefix: 'alice' },
      { key: 'b', branch: 'alice/fix', scope: 'p', ownPrefix: 'alice' }
    ])
    expect(labels.get('a')).toBe('fix')
    expect(labels.get('b')).toBe('fix')
  })
})

describe('manual row name', () => {
  it('trims a set name and reads blank, null, or absent as no name', () => {
    expect(normalizeManualDisplayName('  Billing fix  ')).toBe('Billing fix')
    expect(normalizeManualDisplayName('   ')).toBeNull()
    expect(normalizeManualDisplayName('')).toBeNull()
    expect(normalizeManualDisplayName(null)).toBeNull()
    expect(normalizeManualDisplayName(undefined)).toBeNull()
  })

  it('replaces the derived label only while a name is set', () => {
    expect(resolveOneLineRowLabel('Billing fix', 'feature/billing')).toBe('Billing fix')
    expect(resolveOneLineRowLabel(null, 'feature/billing')).toBe('feature/billing')
    expect(resolveOneLineRowLabel(undefined, 'feature/billing')).toBe('feature/billing')
    expect(resolveOneLineRowLabel('  ', 'feature/billing')).toBe('feature/billing')
  })
})
