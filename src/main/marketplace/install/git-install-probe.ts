import { GIT_MINIMUM_VERSION, type GitOwner } from '../../../shared/marketplace-install'
import { linuxFamily } from './git-install-plan'
import type { GitInstallEnv } from './git-install-types'

export type GitProbe =
  | { kind: 'missing' }
  | { kind: 'found'; path: string; version: string }
  | { kind: 'broken'; path: string }
  | { kind: 'unverifiable'; reason: 'probe-timeout' | 'probe-failed' | 'too-many-copies' }

/** `git version 2.45.1.windows.1` becomes `2.45.1`; a missing patch counts as 0. */
export function parseGitVersion(output: string): string | null {
  const match = /git version (\d+)\.(\d+)(?:\.(\d+))?/.exec(output)
  if (!match) {
    return null
  }
  return `${match[1]}.${match[2]}.${match[3] ?? '0'}`
}

export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

export function meetsGitMinimum(version: string): boolean {
  return compareVersions(version, GIT_MINIMUM_VERSION) >= 0
}

/** Reuses the preflight probe: it already walks PATH and the system install folders. */
export async function probeGit(env: GitInstallEnv): Promise<GitProbe> {
  const found = await env.findCommand('git')
  switch (found.status) {
    case 'absent':
      return { kind: 'missing' }
    case 'timeout':
      return { kind: 'unverifiable', reason: 'probe-timeout' }
    case 'limit_reached':
      return { kind: 'unverifiable', reason: 'too-many-copies' }
    case 'exec_failed':
      return { kind: 'broken', path: found.binary }
    case 'available': {
      const output = await env.readVersion(found.binary).catch(() => null)
      if (output === null) {
        return { kind: 'broken', path: found.binary }
      }
      const version = parseGitVersion(output)
      if (version === null) {
        return { kind: 'unverifiable', reason: 'probe-failed' }
      }
      return { kind: 'found', path: found.binary, version }
    }
  }
}

/** Asks the package manager that could own the binary; anything it does not confirm is `unknown`. */
export async function detectGitOwner(env: GitInstallEnv, binaryPath: string): Promise<GitOwner> {
  if (env.platform === 'win32') {
    return (await wingetOwnsGit(env)) ? 'winget' : 'unknown'
  }
  if (env.platform === 'darwin') {
    return (await env.commandOnPath('brew')) && (await queryOk(env, 'brew', ['list', 'git']))
      ? 'homebrew'
      : 'unknown'
  }
  if (env.platform === 'linux') {
    return linuxOwner(env, binaryPath)
  }
  return 'unknown'
}

async function wingetOwnsGit(env: GitInstallEnv): Promise<boolean> {
  const winget = await env.findCommand('winget')
  if (winget.status !== 'available') {
    return false
  }
  const result = await env
    .runQuery(winget.binary, ['list', '--id', 'Git.Git', '-e'])
    .catch(() => null)
  return result?.code === 0 && result.stdout.includes('Git.Git')
}

async function linuxOwner(env: GitInstallEnv, binaryPath: string): Promise<GitOwner> {
  const family = linuxFamily(env.readOsRelease())
  if (family === 'debian') {
    const result = await env.runQuery('dpkg', ['-S', binaryPath]).catch(() => null)
    return result?.code === 0 && /^git:/m.test(result.stdout) ? 'apt' : 'unknown'
  }
  if (family === 'fedora') {
    const result = await env.runQuery('rpm', ['-qf', binaryPath]).catch(() => null)
    return result?.code === 0 && /^git-\d/m.test(result.stdout) ? 'dnf' : 'unknown'
  }
  return 'unknown'
}

async function queryOk(
  env: GitInstallEnv,
  program: string,
  args: readonly string[]
): Promise<boolean> {
  const result = await env.runQuery(program, args).catch(() => null)
  return result?.code === 0
}
