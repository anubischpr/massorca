import { describe, expect, it, vi } from 'vitest'
import type { GhAccountBindingInventory } from '../../shared/github/auth-types'
import { ghAccountKey } from '../../shared/github/gh-account-inference'
import type { GitConfigRunner } from './gh-account-git-config'
import { inferRepoGhAccount } from './gh-account-repo-inference'

const gitRepo = { path: '/repos/orca', connectionId: null, kind: 'git' as const }
const folderRepo = { path: '/notes', connectionId: null, kind: 'folder' as const }
const palomino = { host: 'github.com', user: 'palominoc' }
const anubis = { host: 'github.com', user: 'anubischpr' }

function inventory(
  accounts: { host: string; user: string; source?: 'env' | 'keyring' }[]
): GhAccountBindingInventory {
  return {
    capability: 'supported',
    accounts: accounts.map((account) => ({
      ...account,
      active: false,
      envToken: null,
      source: account.source ?? 'keyring',
      scopes: []
    }))
  }
}

function fakeRunner(options: { config?: string; remote?: string | null }): GitConfigRunner {
  return async (args) => {
    if (args[0] === 'config') {
      return options.config ?? ''
    }
    if (args[0] === 'remote' && options.remote) {
      return `${options.remote}\n`
    }
    throw new Error(`git ${args.join(' ')} failed`)
  }
}

describe('inferRepoGhAccount', () => {
  it('returns nothing for a folder workspace without touching git', async () => {
    const runner = vi.fn(fakeRunner({}))

    await expect(inferRepoGhAccount(folderRepo, {}, { runner })).resolves.toEqual({
      inference: null,
      remoteOwner: null
    })
    expect(runner).not.toHaveBeenCalled()
  })

  it('returns nothing when the execution host cannot run git', async () => {
    await expect(inferRepoGhAccount(gitRepo, {}, { runner: null })).resolves.toEqual({
      inference: null,
      remoteOwner: null
    })
  })

  it('keeps an existing pin when that account is still connected', async () => {
    const result = await inferRepoGhAccount(
      gitRepo,
      {},
      {
        runner: fakeRunner({
          config: 'gh.account\npalominoc\0',
          remote: 'git@github.com:acme/orca.git'
        }),
        listInventory: async () => inventory([palomino, anubis]),
        listOrgs: vi.fn(async () => ({}))
      }
    )

    expect(result).toEqual({
      inference: { binding: palomino, reason: 'existing_config' },
      remoteOwner: 'acme'
    })
  })

  it('matches an SSH host alias before the remote owner', async () => {
    const result = await inferRepoGhAccount(
      gitRepo,
      {},
      {
        runner: fakeRunner({ remote: 'git@github.com-anubischpr:palominoc/orca.git' }),
        listInventory: async () => inventory([palomino, anubis]),
        listOrgs: vi.fn(async () => ({}))
      }
    )

    expect(result.inference).toEqual({ binding: anubis, reason: 'ssh_alias' })
    expect(result.remoteOwner).toBe('palominoc')
  })

  it('uses only keyring accounts for the suggestion', async () => {
    const result = await inferRepoGhAccount(
      gitRepo,
      {},
      {
        runner: fakeRunner({ remote: 'https://github.com/palominoc/orca.git' }),
        listInventory: async () => inventory([{ ...palomino, source: 'env' }, anubis]),
        listOrgs: vi.fn(async () => ({}))
      }
    )

    expect(result.inference).toBeNull()
  })

  it('looks up org membership only for same-host accounts and picks the single member', async () => {
    const enterprise = { host: 'ghe.example.com', user: 'ada' }
    const listOrgs = vi.fn(async (_accounts: readonly unknown[]) => ({
      [ghAccountKey(palomino)]: ['acme'],
      [ghAccountKey(anubis)]: ['acme']
    }))

    const result = await inferRepoGhAccount(
      gitRepo,
      {},
      {
        runner: fakeRunner({ remote: 'git@github.com:acme/orca.git' }),
        listInventory: async () => inventory([palomino, anubis, enterprise]),
        listOrgs
      }
    )

    expect(listOrgs).toHaveBeenCalledTimes(1)
    expect(listOrgs.mock.calls[0][0]).toEqual([palomino, anubis])
    // Both github.com accounts are members of `acme`, so the inference must stay ambiguous.
    expect(result).toEqual({ inference: null, remoteOwner: 'acme' })
  })

  it('infers the one org member when exactly one account belongs to the owner', async () => {
    const result = await inferRepoGhAccount(
      gitRepo,
      {},
      {
        runner: fakeRunner({ remote: 'git@github.com:acme/orca.git' }),
        listInventory: async () => inventory([palomino, anubis]),
        listOrgs: vi.fn(async () => ({
          [ghAccountKey(palomino)]: ['acme'],
          [ghAccountKey(anubis)]: ['other-org']
        }))
      }
    )

    expect(result.inference).toEqual({ binding: palomino, reason: 'org_member' })
  })

  it('suggests nothing and skips org lookup when origin is missing', async () => {
    const listOrgs = vi.fn(async () => ({}))

    const result = await inferRepoGhAccount(
      gitRepo,
      {},
      {
        runner: fakeRunner({ remote: null }),
        listInventory: async () => inventory([palomino]),
        listOrgs
      }
    )

    expect(result).toEqual({ inference: null, remoteOwner: null })
    expect(listOrgs).not.toHaveBeenCalled()
  })
})
