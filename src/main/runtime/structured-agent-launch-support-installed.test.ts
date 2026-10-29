import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { structuredAgentSupportsLaunch } from './structured-agent-launch-support'

const { loginShell } = vi.hoisted(() => {
  const loginShell: { env: Record<string, string> } = { env: {} }
  return { loginShell }
})
vi.mock('../startup/login-shell-environment', () => ({
  resolveLoginShellEnvironment: async () => loginShell.env
}))

type Settings = Pick<
  GlobalSettings,
  'agentDefaultEnv' | 'nativeChatInheritShellEnvironment' | 'nativeChatShellEnvironmentVariables'
> &
  Partial<Pick<GlobalSettings, 'agentCmdOverrides'>>

let root: string
let binDir: string

function runtimeWith(settings: Settings) {
  return {
    requireStore: () => ({ getSettings: () => settings }),
    resolveRuntimeFileTarget: async () => ({ worktree: { path: root } })
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-grok-installed-'))
  binDir = join(root, 'bin')
  await mkdir(binDir)
  // Only the shell PATH this test names; HOME is the empty root so no real install is found.
  loginShell.env = { PATH: binDir, HOME: root }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const base: Settings = {
  agentDefaultEnv: {},
  nativeChatInheritShellEnvironment: true,
  nativeChatShellEnvironmentVariables: []
}

async function installCli(name: string): Promise<string> {
  const file = join(binDir, name)
  await writeFile(file, '#!/bin/sh\n')
  await chmod(file, 0o755)
  return file
}

describe('Grok create check on the local host', () => {
  it('is not offered when its command does not resolve', async () => {
    expect(await structuredAgentSupportsLaunch('grok', 'id:w', runtimeWith(base))).toBe(false)
  })

  it('is offered when its command resolves on the shell PATH', async () => {
    await installCli('grok')
    expect(await structuredAgentSupportsLaunch('grok', 'id:w', runtimeWith(base))).toBe(true)
  })

  it('is offered when the Command setting names a runnable binary', async () => {
    const file = await installCli('grok')
    const settings = { ...base, agentCmdOverrides: { grok: file } }
    expect(await structuredAgentSupportsLaunch('grok', 'id:w', runtimeWith(settings))).toBe(true)
  })
})

describe.each(['claude', 'codex'] as const)('%s create check on the local host', (agent) => {
  it('is not offered when its CLI does not resolve on the launch PATH', async () => {
    expect(await structuredAgentSupportsLaunch(agent, 'id:w', runtimeWith(base))).toBe(false)
  })

  it('is offered when its CLI resolves on the launch PATH', async () => {
    await installCli(agent)
    expect(await structuredAgentSupportsLaunch(agent, 'id:w', runtimeWith(base))).toBe(true)
  })

  it('is offered when the Command setting names a runnable binary', async () => {
    const file = await installCli(agent)
    const settings = { ...base, agentCmdOverrides: { [agent]: file } }
    expect(await structuredAgentSupportsLaunch(agent, 'id:w', runtimeWith(settings))).toBe(true)
  })

  it('is admitted when the Command setting names no runnable program, so the launch says why', async () => {
    const settings = {
      ...base,
      agentCmdOverrides: { [agent]: join(root, 'missing', agent) }
    }
    expect(await structuredAgentSupportsLaunch(agent, 'id:w', runtimeWith(settings))).toBe(true)
  })
})
