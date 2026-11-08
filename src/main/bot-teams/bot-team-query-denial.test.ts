import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration } from '../../shared/commit-message-plan'
import type {
  SourceControlAgentSpawnInput,
  SpawnSourceControlAgent
} from '../text-generation/source-control-text-generation-types'
import type { BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import { withBotRunDeniedSpawn } from './bot-team-query-denial'

const DENIAL: BotRunDenial = {
  mcpServers: ['engram', 'openmetadata'],
  envNames: ['OPENMETADATA_TOKEN', 'ENGRAM_CLOUD_TOKEN'],
  envPrefixes: []
}

/** The arguments a Claude room turn really runs with, as the plan builds them. */
function claudeArgs(turn: { webResearch?: boolean; codeRead?: boolean }): string[] {
  const planned = planCommitMessageGeneration(
    { agentId: 'claude', model: 'sonnet', roomTurn: true, ...turn },
    'question'
  )
  if (!planned.ok) {
    throw new Error(planned.error)
  }
  return planned.plan.args
}

function spawnedWith(denial: BotRunDenial | null, agentId: string, input: SpawnInput) {
  const seen: SourceControlAgentSpawnInput[] = []
  const spawn: SpawnSourceControlAgent = (call) => {
    seen.push(call)
    return {} as never
  }
  withBotRunDeniedSpawn(spawn, agentId, denial)(input)
  return seen[0]
}

type SpawnInput = SourceControlAgentSpawnInput

const input = (args: string[], env?: NodeJS.ProcessEnv): SpawnInput => ({
  binary: 'claude',
  args,
  stdinMode: 'pipe',
  useCwdForNative: true,
  ...(env ? { env } : {})
})

function denied(args: string[]): string[] {
  const at = args.indexOf('--disallowedTools')
  return at === -1 ? [] : args[at + 1].split(',')
}

describe('a Claude room turn before the denial', () => {
  it('lets research and code turns call the Engram reads and every OpenMetadata read tool', () => {
    for (const turn of [{ webResearch: true }, { codeRead: true }]) {
      const args = claudeArgs(turn)
      const allowed = args[args.indexOf('--allowedTools') + 1].split(',')
      expect(allowed).toContain('mcp__engram__mem_search')
      expect(allowed).toContain('mcp__openmetadata__*')
      expect(denied(args)).not.toContain('mcp__engram')
    }
  })
})

describe('withBotRunDeniedSpawn', () => {
  it('adds a deny rule for each denied server to the deny list a research or code turn already has', () => {
    for (const turn of [{ webResearch: true }, { codeRead: true }]) {
      const base = claudeArgs(turn)
      const spawned = spawnedWith(DENIAL, 'claude', input(base))
      expect(denied(spawned.args)).toEqual([...denied(base), 'mcp__engram', 'mcp__openmetadata'])
      expect(spawned.args.filter((arg) => arg === '--disallowedTools')).toHaveLength(1)
      expect(spawned.args.filter((arg) => arg !== '--disallowedTools')).toHaveLength(
        base.length - 1
      )
    }
  })

  it('adds the deny rules as one flag on a plain turn that has none', () => {
    const base = claudeArgs({})
    expect(base).not.toContain('--disallowedTools')
    const spawned = spawnedWith(DENIAL, 'claude', input(base))
    expect(spawned.args).toEqual([...base, '--disallowedTools', 'mcp__engram,mcp__openmetadata'])
  })

  it('deletes the denied tokens from the env the agent gets, from Orca’s own when none was given', () => {
    const own = { OPENMETADATA_TOKEN: 'x', PATH: '/bin' }
    expect(spawnedWith(DENIAL, 'claude', input([], own)).env).toEqual({ PATH: '/bin' })
    expect(own.OPENMETADATA_TOKEN).toBe('x')
    process.env.ENGRAM_CLOUD_TOKEN = 'inherited'
    try {
      const env = spawnedWith(DENIAL, 'claude', input([])).env
      expect(env).toBeDefined()
      expect(env).not.toHaveProperty('ENGRAM_CLOUD_TOKEN')
    } finally {
      delete process.env.ENGRAM_CLOUD_TOKEN
    }
  })

  it('leaves other agents’ arguments alone, since only Claude lists MCP tools by name', () => {
    const spawned = spawnedWith(DENIAL, 'codex', input(['exec'], { PATH: '/bin' }))
    expect(spawned.args).toEqual(['exec'])
  })

  it('hands a bot kept out of nothing, and every non-bot reply, the very same call', () => {
    const call = input(claudeArgs({ codeRead: true }), { OPENMETADATA_TOKEN: 'x' })
    const seen: SpawnInput[] = []
    const spawn: SpawnSourceControlAgent = (given) => {
      seen.push(given)
      return {} as never
    }
    expect(withBotRunDeniedSpawn(spawn, 'claude', null)).toBe(spawn)
    withBotRunDeniedSpawn(spawn, 'claude', null)(call)
    expect(seen[0]).toBe(call)
  })
})
