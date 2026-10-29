import { describe, expect, it } from 'vitest'
import type { GhAccountBinding } from '../../../src/shared/github/account-binding'
import { hostRepoCatalogSchema } from './host-screen-reply-schema'
import {
  repoAccountsByName,
  repoGroupAccountLabel,
  repoGroupEntries
} from './host-repo-group-account'

const PERSONAL: GhAccountBinding = { host: 'github.com', user: 'palominoc' }
const WORK: GhAccountBinding = { host: 'github.com', user: 'palominoc-perulaunch' }
const NO_ROWS: readonly { workspaceKind?: string }[] = []

describe('repoGroupEntries', () => {
  const catalog = [
    { id: 'r1', displayName: 'NexusCare', ghAccount: PERSONAL },
    { id: 'r2', displayName: 'Perulaunch', ghAccount: WORK }
  ]

  it('resolves gh.account first, and falls back to the bound account', () => {
    const entries = repoGroupEntries(catalog, new Map([['r1', 'palominoc-perulaunch']]))
    expect(entries).toEqual([
      { displayName: 'NexusCare', login: 'palominoc-perulaunch' },
      { displayName: 'Perulaunch', login: 'palominoc-perulaunch' }
    ])
    expect(repoGroupEntries(catalog, new Map()).map((entry) => entry.login)).toEqual([
      'palominoc',
      'palominoc-perulaunch'
    ])
  })
})

describe('repoAccountsByName', () => {
  it('maps each group to its exact login', () => {
    const accounts = repoAccountsByName([
      { displayName: 'NexusCare', login: 'palominoc' },
      { displayName: 'Perulaunch', login: 'palominoc-perulaunch' }
    ])
    expect(accounts.get('NexusCare')).toBe('palominoc')
    expect(accounts.get('Perulaunch')).toBe('palominoc-perulaunch')
  })

  it('omits the label for two same-named repos whose logins disagree', () => {
    const accounts = repoAccountsByName([
      { displayName: 'NexusCare', login: 'palominoc' },
      { displayName: 'NexusCare', login: 'palominoc-perulaunch' }
    ])
    expect(accounts.has('NexusCare')).toBe(false)
  })

  it('keeps the label for two same-named repos that agree', () => {
    const accounts = repoAccountsByName([
      { displayName: 'NexusCare', login: 'palominoc' },
      { displayName: 'NexusCare', login: 'palominoc' }
    ])
    expect(accounts.get('NexusCare')).toBe('palominoc')
  })

  it('omits the label when any repo in the group has no login', () => {
    const accounts = repoAccountsByName([
      { displayName: 'NexusCare', login: 'palominoc' },
      { displayName: 'NexusCare', login: null }
    ])
    expect(accounts.has('NexusCare')).toBe(false)
  })
})

describe('repoGroupAccountLabel', () => {
  const accounts = repoAccountsByName([{ displayName: 'NexusCare', login: 'palominoc' }])

  it('labels a repo group with its exact login', () => {
    expect(repoGroupAccountLabel('repo', 'NexusCare', accounts, NO_ROWS)).toBe('palominoc')
  })

  it('does not match a near-miss name, so no account is borrowed', () => {
    expect(repoGroupAccountLabel('repo', 'NexusCare Labs', accounts, NO_ROWS)).toBeNull()
    expect(repoGroupAccountLabel('repo', 'nexuscare', accounts, NO_ROWS)).toBeNull()
  })

  it('shows nothing outside repo grouping', () => {
    expect(repoGroupAccountLabel('pin', 'NexusCare', accounts, NO_ROWS)).toBeNull()
  })

  it('shows nothing for a folder workspace whose name equals a bound repo name', () => {
    const folderRow = [{ workspaceKind: 'folder-workspace' }]
    expect(repoGroupAccountLabel('repo', 'NexusCare', accounts, folderRow)).toBeNull()
  })

  it('still labels a group of git workspaces beside a folder row of another name', () => {
    const rows = [{ workspaceKind: 'git' }, { workspaceKind: 'git' }]
    expect(repoGroupAccountLabel('repo', 'NexusCare', accounts, rows)).toBe('palominoc')
  })
})

describe('hostRepoCatalogSchema ghAccount', () => {
  const base = { id: 'r1', displayName: 'NexusCare' }

  it('reads the bound account from a repo.list reply', () => {
    const parsed = hostRepoCatalogSchema.parse({
      repos: [{ ...base, ghAccount: { host: 'github.com', user: 'palominoc' } }]
    })
    expect(parsed[0].ghAccount).toEqual({ host: 'github.com', user: 'palominoc' })
  })

  it('reads an older host that predates the field as no account', () => {
    const parsed = hostRepoCatalogSchema.parse({ repos: [base] })
    expect(parsed[0].ghAccount).toBeNull()
  })

  it('reads a malformed account as no account, without dropping the repo', () => {
    const parsed = hostRepoCatalogSchema.parse({ repos: [{ ...base, ghAccount: { user: 7 } }] })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].ghAccount).toBeNull()
  })
})
