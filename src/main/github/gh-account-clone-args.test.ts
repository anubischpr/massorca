import { describe, expect, it } from 'vitest'
import { ghAccountCloneConfigArgs } from './gh-account-clone-args'
import { buildGhAccountCloneConfigArgs } from '../../shared/github/gh-account-git-config'

describe('ghAccountCloneConfigArgs', () => {
  it('adds nothing when no account is requested', () => {
    expect(ghAccountCloneConfigArgs(undefined)).toEqual([])
    expect(ghAccountCloneConfigArgs(null)).toEqual([])
  })

  it('builds the pin pairs for a normalized account', () => {
    expect(ghAccountCloneConfigArgs({ host: ' GitHub.com ', user: 'palominoc' })).toEqual(
      buildGhAccountCloneConfigArgs({ host: 'github.com', user: 'palominoc' })
    )
  })

  it.each([
    { host: 'github.com', user: 'bad user' },
    { host: 'github.com;rm', user: 'palominoc' },
    { host: 'github.com', user: '' },
    'palominoc'
  ])('rejects an account that cannot be pinned safely %j', (ghAccount) => {
    expect(() => ghAccountCloneConfigArgs(ghAccount)).toThrow('GitHub account for clone is invalid')
  })
})
