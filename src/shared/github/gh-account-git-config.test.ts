import { describe, expect, it } from 'vitest'
import {
  ghCredentialHelperCommand,
  isAllowedGhAccountGitConfigWrite,
  planGhAccountGitConfigWrites,
  readGhAccountGitConfigState
} from './gh-account-git-config'

const X = { host: 'github.com', user: 'palominoc' }
const Y = { host: 'github.com', user: 'anubischpr' }
const HELPER_X = ghCredentialHelperCommand(X)

function entries(record: Record<string, string[]>): Map<string, string[]> {
  return new Map(Object.entries(record))
}

describe('ghCredentialHelperCommand', () => {
  it('matches the hand-written github.com helper exactly', () => {
    expect(HELPER_X).toBe(
      '!f() { test "$1" = get || exit 0; echo username=palominoc; echo "password=$(gh auth token --user palominoc)"; }; f'
    )
  })

  it('pins --hostname for enterprise hosts', () => {
    expect(ghCredentialHelperCommand({ host: 'ghe.example.com', user: 'a' })).toContain(
      'gh auth token --hostname ghe.example.com --user a'
    )
  })
})

describe('planGhAccountGitConfigWrites', () => {
  it('binds a fresh repo with reset helper, username and optional identity', () => {
    const identity = { name: 'palominoc', email: '1+palominoc@users.noreply.github.com' }
    expect(
      planGhAccountGitConfigWrites(entries({}), { next: X, previous: null, identity })
    ).toEqual([
      ['--replace-all', 'gh.account', 'palominoc'],
      ['--add', 'credential.https://github.com.helper', ''],
      ['--add', 'credential.https://github.com.helper', HELPER_X],
      ['--replace-all', 'credential.https://github.com.username', 'palominoc'],
      ['--replace-all', 'user.name', 'palominoc'],
      ['--replace-all', 'user.email', '1+palominoc@users.noreply.github.com']
    ])
  })

  it('replaces hand-written helpers instead of appending to them', () => {
    const writes = planGhAccountGitConfigWrites(
      entries({ 'credential.https://github.com.helper': ['manager'] }),
      { next: X, previous: null, identity: null }
    )
    expect(writes[0]).toEqual(['--unset-all', 'credential.https://github.com.helper'])
  })

  it('unbinding removes only values still equal to what Orca wrote', () => {
    const writes = planGhAccountGitConfigWrites(
      entries({
        'gh.account': ['palominoc'],
        'credential.https://github.com.helper': ['', HELPER_X],
        'credential.https://github.com.username': ['someone-else'],
        'user.name': ['Christian'],
        'user.email': ['1+palominoc@users.noreply.github.com']
      }),
      { next: null, previous: X, identity: null }
    )
    expect(writes).toEqual([
      ['--unset-all', 'gh.account'],
      ['--unset-all', 'credential.https://github.com.helper']
    ])
  })

  it('removes the managed noreply identity when switching accounts', () => {
    const writes = planGhAccountGitConfigWrites(
      entries({
        'gh.account': ['palominoc'],
        'credential.https://github.com.helper': ['', HELPER_X],
        'user.name': ['palominoc'],
        'user.email': ['1+palominoc@users.noreply.github.com']
      }),
      { next: Y, previous: X, identity: null }
    )
    expect(writes).toContainEqual(['--unset-all', 'user.name'])
    expect(writes).toContainEqual(['--unset-all', 'user.email'])
    expect(writes.filter((w) => w[0] === '--unset-all' && w[1].endsWith('.helper'))).toHaveLength(1)
  })
})

describe('readGhAccountGitConfigState', () => {
  it('reports the account and whether the identity is the managed noreply one', () => {
    expect(
      readGhAccountGitConfigState(
        entries({
          'gh.account': ['palominoc'],
          'user.name': ['palominoc'],
          'user.email': ['1+palominoc@users.noreply.github.com']
        })
      )
    ).toEqual({ account: 'palominoc', identityManaged: true })
    expect(readGhAccountGitConfigState(entries({}))).toEqual({
      account: null,
      identityManaged: false
    })
  })
})

describe('isAllowedGhAccountGitConfigWrite', () => {
  it('accepts every write the planner emits', () => {
    const identity = { name: 'palominoc', email: '1+palominoc@users.noreply.github.com' }
    const writes = planGhAccountGitConfigWrites(
      entries({
        'gh.account': ['anubischpr'],
        'credential.https://github.com.helper': ['', ghCredentialHelperCommand(Y)],
        'user.name': ['anubischpr'],
        'user.email': ['2+anubischpr@users.noreply.github.com']
      }),
      { next: X, previous: Y, identity }
    )
    for (const write of writes) {
      expect(isAllowedGhAccountGitConfigWrite(['--local', ...write])).toBe(true)
    }
  })

  it.each([
    [['--global', '--replace-all', 'gh.account', 'x']],
    [['--local', '--replace-all', 'core.sshCommand', 'evil']],
    [['--local', '--add', 'credential.https://github.com.helper', '!evil']],
    [['--local', '--add', 'credential.https://github.com.helper', `${HELPER_X}; rm -rf ~`]],
    [['--local', '--replace-all', 'credential.https://github.com.helper', HELPER_X]],
    [['--local', '--replace-all', 'gh.account', 'a;b']],
    [['--local', '--replace-all', 'user.email', 'me@example.com']],
    [['--local', '--add', 'credential.https://evil.com/x.helper', '']],
    [['--local', '--unset-all', 'gh.account', 'extra']]
  ])('rejects %j', (args) => {
    expect(isAllowedGhAccountGitConfigWrite(args)).toBe(false)
  })
})
