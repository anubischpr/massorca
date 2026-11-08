import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceControlAgentSpawnInput } from '../text-generation/source-control-text-generation-types'

const state = vi.hoisted(() => ({
  denied: false,
  spawned: [] as SourceControlAgentSpawnInput[]
}))

vi.mock('../agent-hooks/first-work-generation-target', () => ({
  resolveGenerationTarget: async () => ({
    kind: 'local',
    cwd: '/work',
    env: { OPENMETADATA_TOKEN: 'user-exported', PATH: '/bin' }
  })
}))
vi.mock('../text-generation/source-control-agent-launch', () => ({
  spawnSourceControlAgent: (input: SourceControlAgentSpawnInput) => {
    state.spawned.push(input)
    return {}
  }
}))
// The turn is planned for real; only the process it would start is replaced.
vi.mock('../text-generation/bot-team-lead-generation-request', async () => {
  const { planCommitMessageGeneration } = await import('../../shared/commit-message-plan')
  return {
    queryBotTeamLead: async (input: {
      prompt: string
      params: Parameters<typeof planCommitMessageGeneration>[0]
      target: { env?: NodeJS.ProcessEnv }
      spawnAgent: (call: SourceControlAgentSpawnInput) => unknown
      webResearch?: boolean
      codeRead?: boolean
    }) => {
      const planned = planCommitMessageGeneration(
        {
          ...input.params,
          roomTurn: true,
          ...(input.webResearch ? { webResearch: true } : {}),
          ...(input.codeRead ? { codeRead: true } : {})
        },
        input.prompt
      )
      if (!planned.ok) {
        return null
      }
      input.spawnAgent({
        binary: planned.plan.binary,
        args: planned.plan.args,
        env: input.target.env,
        stdinMode: 'pipe',
        useCwdForNative: true
      })
      return 'answer'
    }
  }
})
vi.mock('../marketplace/marketplace-bot-run-denial', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveBotRunDenial: async () =>
    state.denied
      ? {
          mcpServers: ['engram', 'openmetadata'],
          envNames: ['OPENMETADATA_TOKEN'],
          envPrefixes: []
        }
      : null
}))

import { askBotAgentForBotTeamReply } from './bot-team-request-query'

const SETTINGS = { defaultTuiAgent: 'claude' as const, disabledTuiAgents: [] }
const BOT = { id: 'claude', model: null, effort: null }

function ask(extra: { research?: boolean; botRun?: boolean }) {
  return askBotAgentForBotTeamReply({
    prompt: 'question',
    settings: SETTINGS,
    getAgentEnvResolvers: () => undefined,
    agent: BOT,
    ...(extra.research ? { research: true } : {}),
    ...(extra.botRun ? { botRun: { botId: 'bob', teamId: 't1' } } : {})
  })
}

function deniedRules(call: SourceControlAgentSpawnInput): string[] {
  const at = call.args.indexOf('--disallowedTools')
  return at === -1 ? [] : call.args[at + 1].split(',')
}

describe('a bot reply from a bot kept out of Marketplace apps', () => {
  beforeEach(() => {
    state.denied = false
    state.spawned = []
  })

  it('runs a research turn with the denied servers’ tools denied and their tokens removed', async () => {
    state.denied = true
    expect(await ask({ research: true, botRun: true })).toBe('answer')
    const [call] = state.spawned
    expect(deniedRules(call)).toEqual(expect.arrayContaining(['mcp__engram', 'mcp__openmetadata']))
    expect(call.env).toEqual({ PATH: '/bin' })
  })

  it('runs a plain turn with the same denial', async () => {
    state.denied = true
    await ask({ botRun: true })
    expect(deniedRules(state.spawned[0])).toEqual(['mcp__engram', 'mcp__openmetadata'])
  })

  it('leaves an allowed bot’s reply, and a reply with no bot, exactly as it was', async () => {
    await ask({ research: true, botRun: true })
    await ask({ research: true })
    state.denied = true
    await ask({ research: true })
    const [allowed, noBot, stillNoBot] = state.spawned
    for (const call of [allowed, noBot, stillNoBot]) {
      expect(deniedRules(call)).not.toContain('mcp__engram')
      expect(call.env).toEqual({ OPENMETADATA_TOKEN: 'user-exported', PATH: '/bin' })
    }
    expect(allowed.args).toEqual(noBot.args)
  })
})
