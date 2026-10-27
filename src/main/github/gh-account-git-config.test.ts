import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyGhAccountGitConfig,
  readGhAccountGitConfig,
  type GitConfigRunner
} from './gh-account-git-config'
import { validateGitExecArgs } from '../../relay/git-exec-validator'

let dir: string
let run: GitConfigRunner

function localConfig(): string {
  return execFileSync('git', ['config', '--local', '--list'], { cwd: dir, encoding: 'utf8' })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gh-account-git-config-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  // Why: mirror the SSH relay so every write is proven to pass its validator.
  run = async (args) => {
    validateGitExecArgs(args)
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const repo = (): { path: string; connectionId: null; kind: 'git' } => ({
  path: dir,
  connectionId: null,
  kind: 'git'
})
const X = { host: 'github.com', user: 'palominoc' }
const Y = { host: 'github.com', user: 'anubischpr' }

describe('applyGhAccountGitConfig', () => {
  it('binds, switches and unbinds leaving unrelated config untouched', async () => {
    execFileSync('git', ['config', '--local', 'core.autocrlf', 'false'], { cwd: dir })
    const before = localConfig()
    const resolveIdentity = vi.fn(async () => ({
      name: 'palominoc',
      email: '7+palominoc@users.noreply.github.com'
    }))

    await expect(
      applyGhAccountGitConfig(
        repo(),
        { next: X, previous: null, setIdentity: true },
        {},
        { runner: run, resolveIdentity }
      )
    ).resolves.toEqual({ ok: true, identity: 'set' })
    expect(await readGhAccountGitConfig(run)).toEqual({
      account: 'palominoc',
      identityManaged: true
    })
    expect(
      execFileSync(
        'git',
        ['config', '--local', '--get-all', 'credential.https://github.com.helper'],
        {
          cwd: dir,
          encoding: 'utf8'
        }
      ).split('\n')[0]
    ).toBe('')

    await applyGhAccountGitConfig(
      repo(),
      { next: Y, previous: X, setIdentity: false },
      {},
      { runner: run }
    )
    expect(await readGhAccountGitConfig(run)).toEqual({
      account: 'anubischpr',
      identityManaged: false
    })
    expect(localConfig()).not.toContain('palominoc')

    await applyGhAccountGitConfig(
      repo(),
      { next: null, previous: Y, setIdentity: false },
      {},
      { runner: run }
    )
    expect(localConfig()).toBe(before)
  })

  it('keeps a value the user changed after Orca wrote it', async () => {
    await applyGhAccountGitConfig(
      repo(),
      { next: X, previous: null, setIdentity: false },
      {},
      {
        runner: run
      }
    )
    execFileSync('git', ['config', '--local', 'credential.https://github.com.username', 'me'], {
      cwd: dir
    })
    await applyGhAccountGitConfig(
      repo(),
      { next: null, previous: X, setIdentity: false },
      {},
      {
        runner: run
      }
    )
    expect(localConfig()).toContain('credential.https://github.com.username=me')
    expect(localConfig()).not.toContain('gh.account')
  })

  it('refuses folder workspaces, unsafe logins and missing SSH providers', async () => {
    await expect(
      applyGhAccountGitConfig(
        { ...repo(), kind: 'folder' },
        { next: X, previous: null, setIdentity: false }
      )
    ).resolves.toEqual({ ok: false, error: 'folder_workspace' })
    await expect(
      applyGhAccountGitConfig(
        repo(),
        { next: { host: 'github.com', user: 'a$(id)' }, previous: null, setIdentity: false },
        {},
        { runner: run }
      )
    ).resolves.toEqual({ ok: false, error: 'unsafe_login' })
    await expect(
      applyGhAccountGitConfig(
        repo(),
        { next: X, previous: null, setIdentity: false },
        {},
        { runner: null }
      )
    ).resolves.toEqual({ ok: false, error: 'ssh_unavailable' })
  })

  it('reports an unavailable identity without failing the binding', async () => {
    await expect(
      applyGhAccountGitConfig(
        repo(),
        { next: X, previous: null, setIdentity: true },
        {},
        { runner: run, resolveIdentity: async () => null }
      )
    ).resolves.toEqual({ ok: true, identity: 'unavailable' })
    expect(localConfig()).not.toContain('user.email')
  })
})
