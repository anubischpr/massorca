import { describe, expect, it } from 'vitest'
import type { GhAccountBinding } from '../../../src/shared/github/account-binding'
import { hostRepoCatalogSchema } from './host-screen-reply-schema'
import { repoAccountsByName, repoGroupAccountLabel } from './host-repo-group-account'

const PERSONAL: GhAccountBinding = { host: 'github.com', user: 'palominoc' }
const WORK: GhAccountBinding = { host: 'github.com', user: 'palominoc-perulaunch' }

describe('repoAccountsByName', () => {
  it('maps each repo name to its own account, keeping the exact login', () => {
    const accounts = repoAccountsByName([
      { displayName: 'NexusCare', ghAccount: PERSONAL },
      { displayName: 'Perulaunch', ghAccount: WORK },
      { displayName: 'Scratch', ghAccount: null }
    ])
    expect(accounts.get('NexusCare')?.user).toBe('palominoc')
    expect(accounts.get('Perulaunch')?.user).toBe('palominoc-perulaunch')
    expect(accounts.has('Scratch')).toBe(false)
  })
})

describe('repoGroupAccountLabel', () => {
  const accounts = repoAccountsByName([{ displayName: 'NexusCare', ghAccount: PERSONAL }])

  it('labels a repo group with its exact login', () => {
    expect(repoGroupAccountLabel('repo', 'NexusCare', accounts)).toBe('palominoc')
  })

  it('does not match a near-miss name, so no account is borrowed', () => {
    expect(repoGroupAccountLabel('repo', 'NexusCare Labs', accounts)).toBeNull()
    expect(repoGroupAccountLabel('repo', 'nexuscare', accounts)).toBeNull()
  })

  it('shows nothing outside repo grouping', () => {
    expect(repoGroupAccountLabel('pin', 'NexusCare', accounts)).toBeNull()
  })

  it('shows nothing for a folder workspace group, which has no repo account', () => {
    expect(repoGroupAccountLabel('repo', 'Downloads', accounts)).toBeNull()
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
