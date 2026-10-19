import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionExecutionLocation } from '../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { AgentCliVersionProbeOutcome } from '../agent-cli-version-probe'
import { resolveHostStructuredAgentCreateSupport } from './structured-agent-launch-support'

const { outcomes, loginShell } = vi.hoisted(() => {
  const outcomes: Record<string, AgentCliVersionProbeOutcome> = {
    pi: 'supported',
    'gentle-shell': 'supported'
  }
  const loginShell: { env: Record<string, string> } = { env: {} }
  return { outcomes, loginShell }
})
vi.mock('../startup/login-shell-environment', () => ({
  resolveLoginShellEnvironment: async () => loginShell.env
}))
// The runtime's own binary is stubbed; which command the settings resolve to is the real code's.
vi.mock('../pi/rpc-launch-resolution', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  piRpcLaunchOutcome: async (launch: { command: string }) =>
    outcomes[basename(launch.command).replace(/\.(?:cmd|bat|exe)$/, '')] ?? 'did-not-start'
}))

const location: AgentSessionExecutionLocation = {
  executionHostId: LOCAL_EXECUTION_HOST_ID,
  wslDistro: null,
  workspaceId: 'workspace-1',
  workspaceKind: 'git-worktree'
}

function settings(extra: Record<string, unknown> = {}) {
  return {
    nativeChatInheritShellEnvironment: true,
    nativeChatShellEnvironmentVariables: [],
    agentDefaultEnv: {},
    ...extra
  }
}

function createSupport(input: {
  piRuntime?: 'pi' | 'gentle-shell'
  accessMode?: 'default' | 'full-access'
  hostSettings?: ReturnType<typeof settings>
}) {
  const hostSettings = input.hostSettings ?? settings()
  return resolveHostStructuredAgentCreateSupport({
    agent: 'pi',
    ...(input.piRuntime ? { piRuntime: input.piRuntime } : {}),
    ...(input.accessMode ? { accessMode: input.accessMode } : {}),
    worktreeSelector: 'id:workspace-1',
    location,
    runtime: {
      requireStore: () => ({ getSettings: () => hostSettings }),
      resolveRuntimeFileTarget: async () => ({ worktree: { path: '/repo/worktree' } })
    },
    getSettings: () => ({ claudeManagedAccounts: [], activeClaudeManagedAccountId: null })
  })
}

let bin: string
/** Puts a runnable `gentle-shell` on the host's PATH; `--version` is stubbed separately. */
async function installGentleShell(): Promise<void> {
  const file = join(bin, process.platform === 'win32' ? 'gentle-shell.cmd' : 'gentle-shell')
  await writeFile(file, '#!/bin/sh\n')
  await chmod(file, 0o755)
}

beforeEach(async () => {
  outcomes.pi = 'supported'
  outcomes['gentle-shell'] = 'supported'
  bin = await mkdtemp(join(tmpdir(), 'orca-gentle-shell-bin-'))
  loginShell.env = { PATH: bin, HOME: '/home/user' }
  await installGentleShell()
})
afterEach(async () => {
  await rm(bin, { recursive: true, force: true })
})

describe('host Pi runtime fallback', () => {
  it('keeps stock Pi when it can run, naming no runtime in the reply', async () => {
    const support = await createSupport({ accessMode: 'full-access' })
    expect(support).toEqual({ supported: true })
  })

  it('resolves an unset runtime to Gentle Shell when only that is installed', async () => {
    outcomes.pi = 'did-not-start'
    const support = await createSupport({ accessMode: 'full-access' })
    expect(support).toEqual({ supported: true, piRuntime: 'gentle-shell' })
  })

  it('also falls back when stock Pi ran but is an unsupported release', async () => {
    outcomes.pi = 'unsupported'
    expect(await createSupport({ accessMode: 'full-access' })).toEqual({
      supported: true,
      piRuntime: 'gentle-shell'
    })
  })

  it('applies Gentle Shell access rules to a restricted request after the fallback', async () => {
    outcomes.pi = 'did-not-start'
    expect(await createSupport({ accessMode: 'default' })).toEqual({
      supported: true,
      piRuntime: 'gentle-shell'
    })
  })

  it('still refuses restricted access on stock Pi', async () => {
    expect(await createSupport({ accessMode: 'default' })).toEqual({
      supported: false,
      reason: 'access'
    })
  })

  it('honors an explicit stock Pi even when only Gentle Shell is installed', async () => {
    outcomes.pi = 'did-not-start'
    const support = await createSupport({ piRuntime: 'pi', accessMode: 'full-access' })
    expect(support).toMatchObject({ supported: false, reason: 'agent', cause: 'cliMissing' })
    expect(support).not.toHaveProperty('piRuntime')
  })

  it('honors an explicit Gentle Shell without reporting it as a fallback', async () => {
    expect(await createSupport({ piRuntime: 'gentle-shell' })).toEqual({ supported: true })
  })

  it('names the cause when neither Pi nor Gentle Shell is installed', async () => {
    outcomes.pi = 'did-not-start'
    outcomes['gentle-shell'] = 'did-not-start'
    expect(await createSupport({ accessMode: 'full-access' })).toEqual({
      supported: false,
      reason: 'agent',
      cause: 'cliMissing'
    })
  })

  it('does not fall back to a Gentle Shell that is not on the PATH', async () => {
    await rm(join(bin, process.platform === 'win32' ? 'gentle-shell.cmd' : 'gentle-shell'))
    outcomes.pi = 'did-not-start'
    expect(await createSupport({ accessMode: 'full-access' })).toEqual({
      supported: false,
      reason: 'agent',
      cause: 'cliMissing'
    })
  })

  it('names no missing-install cause when a binary ran but is unsupported', async () => {
    outcomes.pi = 'unsupported'
    outcomes['gentle-shell'] = 'did-not-start'
    expect(await createSupport({ accessMode: 'full-access' })).toEqual({
      supported: false,
      reason: 'agent'
    })
  })
})
