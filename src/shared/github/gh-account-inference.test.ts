import { describe, expect, it } from 'vitest'
import {
  ghAccountInferenceNeedsOrgLookup,
  ghAccountKey,
  inferGhAccount,
  parseGhRemoteUrl
} from './gh-account-inference'

const PALOMINO = { host: 'github.com', user: 'palominoc' }
const PERULAUNCH = { host: 'github.com', user: 'palominoc-perulaunch' }
const ANUBIS = { host: 'github.com', user: 'anubischpr' }
const accounts = [PALOMINO, PERULAUNCH, ANUBIS]

describe('parseGhRemoteUrl', () => {
  it.each([
    [
      'https://github.com/Alterra-DS/api.git',
      { host: 'github.com', aliasLogin: null, owner: 'Alterra-DS' }
    ],
    [
      'git@github.com:palominoc/app.git',
      { host: 'github.com', aliasLogin: null, owner: 'palominoc' }
    ],
    [
      'git@github.com-AnubisChpr:x/y.git',
      { host: 'github.com', aliasLogin: 'AnubisChpr', owner: 'x' }
    ],
    [
      'ssh://git@github.com-anubischpr/x/y',
      { host: 'github.com', aliasLogin: 'anubischpr', owner: 'x' }
    ],
    [
      'https://my-ghe.example.com/team/repo',
      { host: 'my-ghe.example.com', aliasLogin: null, owner: 'team' }
    ]
  ])('parses %s', (url, expected) => {
    expect(parseGhRemoteUrl(url)).toEqual(expected)
  })

  it('rejects non-remote strings', () => {
    expect(parseGhRemoteUrl('/home/me/project')).toBeNull()
    expect(parseGhRemoteUrl('')).toBeNull()
  })
})

describe('inferGhAccount', () => {
  it('prefers an existing gh.account over the remote', () => {
    expect(
      inferGhAccount({
        accounts,
        existingGhAccount: 'anubischpr',
        remoteUrl: 'https://github.com/palominoc/app'
      })
    ).toEqual({ binding: ANUBIS, reason: 'existing_config' })
  })

  it('uses the SSH alias login', () => {
    expect(
      inferGhAccount({ accounts, remoteUrl: 'git@github.com-anubischpr:Alterra-DS/api.git' })
    ).toEqual({ binding: ANUBIS, reason: 'ssh_alias' })
  })

  it('matches the owner login exactly, not by prefix', () => {
    expect(inferGhAccount({ accounts, remoteUrl: 'https://github.com/PalominoC/app' })).toEqual({
      binding: PALOMINO,
      reason: 'owner_login'
    })
  })

  it('needs an org lookup for org owners and resolves a single member', () => {
    const input = { accounts, remoteUrl: 'https://github.com/Alterra-DS/api' }
    expect(inferGhAccount(input)).toBeNull()
    expect(ghAccountInferenceNeedsOrgLookup(input)).toBe(true)
    const orgsByAccount = new Map([
      [ghAccountKey(PERULAUNCH), ['alterra-ds']],
      [ghAccountKey(PALOMINO), ['other-org']]
    ])
    expect(inferGhAccount({ ...input, orgsByAccount })).toEqual({
      binding: PERULAUNCH,
      reason: 'org_member'
    })
  })

  it('returns null when several accounts belong to the org', () => {
    const orgsByAccount = new Map([
      [ghAccountKey(PERULAUNCH), ['Alterra-DS']],
      [ghAccountKey(PALOMINO), ['Alterra-DS']]
    ])
    expect(
      inferGhAccount({ accounts, remoteUrl: 'https://github.com/Alterra-DS/api', orgsByAccount })
    ).toBeNull()
  })

  it('needs no lookup when no account is on the remote host', () => {
    expect(
      ghAccountInferenceNeedsOrgLookup({ accounts, remoteUrl: 'https://gitlab.com/group/repo' })
    ).toBe(false)
  })
})
