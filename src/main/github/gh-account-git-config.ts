/**
 * Writes/reads the repo-local git config that pins a project to a GitHub account,
 * on the repo's execution host (local/WSL git, or the SSH relay).
 */
import type { Repo } from '../../shared/repo-types'
import { isFolderRepo } from '../../shared/repo-kind'
import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import {
  ghNoreplyEmail,
  isGitConfigSafeGhBinding,
  planGhAccountGitConfigWrites,
  readGhAccountGitConfigState,
  type GhAccountGitConfigResult,
  type GhAccountGitConfigState,
  type GhAccountGitIdentity,
  type GitConfigEntries
} from '../../shared/github/gh-account-git-config'
import type { GhAccountBinding } from '../../shared/github/account-binding'
import { ghExecFileAsync, gitExecFileAsync } from '../git/runner'
import { getSshGitProvider } from '../providers/ssh-git-dispatch'
import type { LocalProjectWorktreeGitOptions } from '../project-runtime-git-options'

/** Runs `git <args>` in the repo on its execution host and returns stdout. */
export type GitConfigRunner = (args: string[]) => Promise<string>

const GIT_CONFIG_TIMEOUT_MS = 10_000
const IDENTITY_LOOKUP_TIMEOUT_MS = 10_000

export function createRepoGitConfigRunner(
  repo: Pick<Repo, 'path' | 'connectionId'>,
  localGitOptions: LocalProjectWorktreeGitOptions = {}
): GitConfigRunner | null {
  if (repo.connectionId) {
    const provider = getSshGitProvider(repo.connectionId)
    if (!provider) {
      return null
    }
    return async (args) =>
      (await provider.exec(args, repo.path, { timeoutMs: GIT_CONFIG_TIMEOUT_MS })).stdout
  }
  return async (args) =>
    (
      await gitExecFileAsync(args, {
        cwd: repo.path,
        timeout: GIT_CONFIG_TIMEOUT_MS,
        ...(localGitOptions.wslDistro ? { wslDistro: localGitOptions.wslDistro } : {})
      })
    ).stdout
}

/** Parses `git config -z --list`: NUL-separated `key\nvalue` records. */
export function parseGitConfigNulList(stdout: string): Map<string, string[]> {
  const entries = new Map<string, string[]>()
  for (const record of stdout.split('\0')) {
    if (!record) {
      continue
    }
    const newline = record.indexOf('\n')
    const key = (newline === -1 ? record : record.slice(0, newline)).toLowerCase()
    const value = newline === -1 ? '' : record.slice(newline + 1)
    entries.set(key, [...(entries.get(key) ?? []), value])
  }
  return entries
}

async function readLocalGitConfig(run: GitConfigRunner): Promise<GitConfigEntries> {
  return parseGitConfigNulList(await run(['config', '--local', '-z', '--list']))
}

/** Reads the `gh.account` pin from repo-local git config; the shell `gh()` wrapper reads the same key. */
export async function readGhAccountGitConfig(
  run: GitConfigRunner
): Promise<GhAccountGitConfigState> {
  return readGhAccountGitConfigState(await readLocalGitConfig(run))
}

async function resolveNoreplyIdentity(
  binding: GhAccountBinding,
  localGitOptions: LocalProjectWorktreeGitOptions
): Promise<GhAccountGitIdentity | null> {
  try {
    const { stdout } = await ghExecFileAsync(['api', `users/${binding.user}`, '--jq', '.id'], {
      host: binding.host,
      ghAccount: binding,
      timeout: IDENTITY_LOOKUP_TIMEOUT_MS,
      ...(localGitOptions.wslDistro ? { wslDistro: localGitOptions.wslDistro } : {})
    })
    const id = Number(stdout.trim())
    return Number.isSafeInteger(id) && id > 0
      ? { name: binding.user, email: ghNoreplyEmail(binding, id) }
      : null
  } catch {
    return null
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type ApplyGhAccountGitConfigInput = {
  next: unknown
  previous: unknown
  setIdentity: boolean
}

export async function applyGhAccountGitConfig(
  repo: Pick<Repo, 'path' | 'connectionId' | 'kind'>,
  input: ApplyGhAccountGitConfigInput,
  localGitOptions: LocalProjectWorktreeGitOptions = {},
  deps: {
    runner?: GitConfigRunner | null
    resolveIdentity?: typeof resolveNoreplyIdentity
  } = {}
): Promise<GhAccountGitConfigResult> {
  if (isFolderRepo(repo)) {
    return { ok: false, error: 'folder_workspace' }
  }
  const next = input.next == null ? null : normalizeGhAccountBinding(input.next)
  const previous = input.previous == null ? null : normalizeGhAccountBinding(input.previous)
  if (
    (input.next != null && (!next || !isGitConfigSafeGhBinding(next))) ||
    (previous && !isGitConfigSafeGhBinding(previous))
  ) {
    return { ok: false, error: 'unsafe_login' }
  }
  const run =
    deps.runner === undefined ? createRepoGitConfigRunner(repo, localGitOptions) : deps.runner
  if (!run) {
    return { ok: false, error: 'ssh_unavailable' }
  }
  const identity =
    next && input.setIdentity
      ? await (deps.resolveIdentity ?? resolveNoreplyIdentity)(next, localGitOptions)
      : null
  try {
    const entries = await readLocalGitConfig(run)
    for (const write of planGhAccountGitConfigWrites(entries, {
      next,
      previous: previous ?? null,
      identity
    })) {
      await run(['config', '--local', ...write])
    }
  } catch (error) {
    return { ok: false, error: 'git_failed', message: errorMessage(error) }
  }
  return {
    ok: true,
    identity: !next || !input.setIdentity ? 'not_requested' : identity ? 'set' : 'unavailable'
  }
}

export async function readRepoGhAccountGitConfig(
  repo: Pick<Repo, 'path' | 'connectionId' | 'kind'>,
  localGitOptions: LocalProjectWorktreeGitOptions = {}
): Promise<GhAccountGitConfigState | null> {
  if (isFolderRepo(repo)) {
    return null
  }
  const run = createRepoGitConfigRunner(repo, localGitOptions)
  return run ? readGhAccountGitConfig(run) : null
}
