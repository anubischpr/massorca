import { describe, expect, it } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { botRunOptions, type BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import type { ClaudeStructuredLaunch } from './claude-structured-launch-resolution'
import { withClaudeBotRunDenial } from './claude-structured-bot-run'

const IDENTITY = { sessionId: 'session-1' } as never
const DENIAL: BotRunDenial = {
  mcpServers: ['engram', 'openmetadata', 'escritura'],
  envNames: ['OPENMETADATA_TOKEN', 'ENGRAM_CLOUD_TOKEN'],
  envPrefixes: []
}

const LAUNCH = {
  pathToClaudeCodeExecutable: '/usr/local/bin/claude',
  options: { settingSources: ['user'], extraArgs: { 'replay-user-messages': null } },
  cwd: '/repos/work',
  env: { OPENMETADATA_TOKEN: 'vault-token', ENGRAM_CLOUD_TOKEN: 'cloud-token', PATH: '/bin' },
  claudeConfigDir: '/home/.claude',
  providerSessionId: 'provider-1',
  resumeLeafUuid: null,
  resumesTranscript: false,
  continuesChain: false
} as unknown as ClaudeStructuredLaunch

function resolver(options: Record<string, string> | undefined, denial: BotRunDenial | null) {
  const record = { options } as AgentSessionRecord
  return withClaudeBotRunDenial(async () => structuredClone(LAUNCH), {
    store: { getRecord: () => record },
    resolveBotRunDenial: async (recorded) => (recorded?.botTeamBotId ? denial : null)
  })
}

describe('withClaudeBotRunDenial', () => {
  it('takes the denied tokens out of a bot run and denies every tool of the denied servers', async () => {
    const launch = await resolver(
      botRunOptions({ botId: 'bob', teamId: 't1' }),
      DENIAL
    )({
      identity: IDENTITY
    })
    expect(launch.env).toEqual({ PATH: '/bin' })
    expect(launch.envToDelete).toEqual(['OPENMETADATA_TOKEN', 'ENGRAM_CLOUD_TOKEN'])
    expect(launch.options).toEqual({
      ...LAUNCH.options,
      disallowedTools: ['mcp__engram', 'mcp__openmetadata', 'mcp__escritura']
    })
    expect(JSON.stringify(launch.options)).not.toContain('vault-token')
  })

  it('returns the launch of an allowed bot and of a normal session exactly as resolved', async () => {
    const allowed = await resolver(
      botRunOptions({ botId: 'ann', teamId: 't1' }),
      null
    )({
      identity: IDENTITY
    })
    expect(allowed).toEqual(LAUNCH)
    expect(allowed).not.toHaveProperty('envToDelete')
    const plain = await resolver(undefined, DENIAL)({ identity: IDENTITY })
    expect(plain).toEqual(LAUNCH)
  })

  it('denies no tool when the denied apps have no MCP server', async () => {
    const launch = await resolver(botRunOptions({ botId: 'bob', teamId: 't1' }), {
      mcpServers: [],
      envNames: ['ENGRAM_CLOUD_TOKEN'],
      envPrefixes: []
    })({ identity: IDENTITY })
    expect(launch.options).not.toHaveProperty('disallowedTools')
    expect(launch.env).not.toHaveProperty('ENGRAM_CLOUD_TOKEN')
  })
})
