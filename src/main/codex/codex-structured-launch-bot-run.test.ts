import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { botRunOptions, type BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import { codexStructuredChildEnvironment } from './codex-structured-child-environment'
import { createCodexStructuredLaunchResolver } from './codex-structured-launch-resolution'

const DENIAL: BotRunDenial = {
  mcpServers: ['engram', 'openmetadata'],
  envNames: ['OPENMETADATA_TOKEN', 'ENGRAM_CLOUD_TOKEN'],
  envPrefixes: []
}
const ENV = {
  OPENMETADATA_TOKEN: 'vault-token',
  ENGRAM_CLOUD_TOKEN: 'cloud-token',
  PATH: '/bin'
}

let codexHome = ''
beforeEach(() => {
  codexHome = mkdtempSync(join(tmpdir(), 'orca-codex-bot-run-'))
  writeFileSync(join(codexHome, 'config.toml'), '[mcp_servers.engram]\ncommand = "engram"\n')
})
afterEach(() => rmSync(codexHome, { recursive: true, force: true }))

function recordWith(options?: Record<string, string>): AgentSessionRecord {
  return {
    sessionId: 'session-1',
    provider: 'codex',
    location: {
      executionHostId: LOCAL_EXECUTION_HOST_ID,
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree'
    },
    accountHome: { variable: 'CODEX_HOME', path: codexHome },
    providerHandleChain: [],
    ...(options ? { options } : {})
  } as unknown as AgentSessionRecord
}

function launch(record: AgentSessionRecord, denial: BotRunDenial | null) {
  return createCodexStructuredLaunchResolver({
    store: { getRecord: () => record, pinLaunchDirectory: vi.fn() },
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveCommand: () => '/usr/local/bin/codex',
    resolveEnvironment: async () => ({ ...ENV }),
    resolveLaunchArgs: () => [],
    resolveBotRunDenial: async (options) => (options?.botTeamBotId ? denial : null)
  })({ identity: { sessionId: 'session-1' } as never })
}

describe('codex structured launch for a bot run', () => {
  it('disables the denied servers the config holds and takes the tokens out of the env', async () => {
    const bot = await launch(recordWith(botRunOptions({ botId: 'bob', teamId: 't1' })), DENIAL)
    expect(bot.args).toEqual(['-c', 'mcp_servers.engram.enabled=false', 'app-server'])
    expect(bot.env).toEqual({ PATH: '/bin' })
    expect(bot.envToDelete).toEqual(['OPENMETADATA_TOKEN', 'ENGRAM_CLOUD_TOKEN'])
    expect(JSON.stringify(bot.args)).not.toContain('vault-token')
    const child = codexStructuredChildEnvironment(bot, 'spawn-token', 'session-1')
    expect(child.envToDelete).toEqual(
      expect.arrayContaining(['OPENMETADATA_TOKEN', 'ENGRAM_CLOUD_TOKEN'])
    )
    expect(child.env.OPENMETADATA_TOKEN).toBeUndefined()
  })

  it('launches an allowed bot and a normal session exactly alike', async () => {
    const plain = await launch(recordWith(), null)
    const allowed = await launch(recordWith(botRunOptions({ botId: 'ann', teamId: 't1' })), null)
    expect(plain.args).toEqual(['app-server'])
    expect(plain.env).toEqual(ENV)
    expect(plain).not.toHaveProperty('envToDelete')
    expect(allowed).toEqual(plain)
    // A denial never reaches a session that is not a bot run.
    expect(await launch(recordWith(), DENIAL)).toEqual(plain)
  })
})
