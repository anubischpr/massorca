import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  everyoneAccessPolicy,
  isMarketplaceAppAllowedForAgent,
  isMarketplaceAppAllowedForBot,
  isUnrestrictedAccessPolicy,
  type MarketplaceAccessMode,
  type MarketplaceAgentAccess,
  type MarketplaceAppAccessPolicy
} from '../../shared/marketplace-apps'
import {
  accessPolicyInputSchema,
  everyoneAccessByApp,
  storedAccessSchema
} from './marketplace-access'
import { parseAccessPolicyArgs } from './marketplace-apps-args'
import {
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore
} from './marketplace-apps-test-fixtures'
import { MarketplaceVault } from './marketplace-vault'

function botPolicy(
  mode: MarketplaceAccessMode,
  botIds: string[] = [],
  teamIds: string[] = []
): MarketplaceAppAccessPolicy {
  return { ...everyoneAccessPolicy(), bots: { mode, botIds, teamIds } }
}

function agentPolicy(
  mode: MarketplaceAccessMode,
  ids: MarketplaceAgentAccess['ids'] = []
): MarketplaceAppAccessPolicy {
  return { ...everyoneAccessPolicy(), agents: { mode, ids } }
}

describe('isMarketplaceAppAllowedForBot', () => {
  // bot-1 and bot-3 share team-a; bot-2 sits in team-b.
  const bot1 = { botId: 'bot-1', teamId: 'team-a' }
  const bot2 = { botId: 'bot-2', teamId: 'team-b' }
  const bot3 = { botId: 'bot-3', teamId: 'team-a' }

  it.each([
    ['everyone, no picks', botPolicy('everyone'), bot1, true],
    ['everyone ignores picks', botPolicy('everyone', ['bot-2'], ['team-a']), bot2, true],
    ['only, the bot picked', botPolicy('only', ['bot-1']), bot1, true],
    ['only, a teammate picked', botPolicy('only', ['bot-1']), bot3, false],
    ['only, the whole team picked', botPolicy('only', [], ['team-a']), bot3, true],
    ['only, a bot of another team', botPolicy('only', [], ['team-a']), bot2, false],
    ['only, nothing picked', botPolicy('only'), bot1, false],
    ['except, the bot picked', botPolicy('except', ['bot-1']), bot1, false],
    ['except, the whole team picked', botPolicy('except', [], ['team-a']), bot3, false],
    ['except, a bot of another team', botPolicy('except', [], ['team-a']), bot2, true],
    ['except, nothing picked', botPolicy('except'), bot1, true]
  ])('%s', (_name, policy, target, expected) => {
    expect(isMarketplaceAppAllowedForBot(policy, target)).toBe(expected)
  })

  it('reads only the bot dimension, never the agent one', () => {
    const policy: MarketplaceAppAccessPolicy = {
      agents: { mode: 'only', ids: [] },
      bots: { mode: 'everyone', botIds: [], teamIds: [] }
    }
    expect(isMarketplaceAppAllowedForBot(policy, bot1)).toBe(true)
  })
})

describe('isMarketplaceAppAllowedForAgent', () => {
  it.each([
    ['everyone', 'codex', true],
    ['only', 'codex', true],
    ['only', 'claude', false],
    ['except', 'codex', false],
    ['except', 'claude', true]
  ] as const)('%s with codex picked allows %s: %s', (mode, agent, expected) => {
    const policy = agentPolicy(mode, ['codex'])
    expect(isMarketplaceAppAllowedForAgent(policy, agent)).toBe(expected)
  })

  it('treats an empty "only" as no agent and an empty "except" as every agent', () => {
    expect(isMarketplaceAppAllowedForAgent(agentPolicy('only'), 'claude')).toBe(false)
    expect(isMarketplaceAppAllowedForAgent(agentPolicy('except'), 'claude')).toBe(true)
  })

  it('treats only a policy with neither dimension limited as unrestricted', () => {
    expect(isUnrestrictedAccessPolicy(everyoneAccessPolicy())).toBe(true)
    expect(isUnrestrictedAccessPolicy(agentPolicy('except', ['claude']))).toBe(false)
    expect(isUnrestrictedAccessPolicy(botPolicy('only'))).toBe(false)
  })
})

describe('access policy input and stored records', () => {
  const valid = {
    agents: { mode: 'only', ids: ['claude', 'gentle-shell'] },
    bots: { mode: 'except', botIds: ['bot-1'], teamIds: ['team-a'] }
  }

  it('accepts a complete policy and rejects what it cannot read exactly', () => {
    expect(accessPolicyInputSchema.safeParse(valid).success).toBe(true)
    const rejected: unknown[] = [
      { ...valid, agents: { mode: 'only', ids: ['gemini'] } },
      { ...valid, agents: { mode: 'only', ids: ['claude', 'claude'] } },
      { ...valid, agents: { mode: 'some', ids: [] } },
      { ...valid, bots: { mode: 'only', botIds: [''], teamIds: [] } },
      { ...valid, bots: { mode: 'only', botIds: ['a', 'a'], teamIds: [] } },
      { ...valid, bots: { mode: 'only', botIds: [], teamIds: ['x'.repeat(201)] } },
      {
        ...valid,
        bots: {
          mode: 'only',
          botIds: Array.from({ length: 501 }, (_, index) => `bot-${index}`),
          teamIds: []
        }
      },
      { agents: valid.agents }
    ]
    for (const input of rejected) {
      expect(accessPolicyInputSchema.safeParse(input).success).toBe(false)
    }
  })

  it('parses the app id and the policy for the set call, and nothing else', () => {
    expect(parseAccessPolicyArgs({ id: 'engram', policy: valid })).toEqual({
      id: 'engram',
      policy: valid
    })
    expect(parseAccessPolicyArgs({ id: 'slack', policy: valid })).toBeNull()
    expect(parseAccessPolicyArgs({ id: 'github', policy: null })).toBeNull()
    expect(parseAccessPolicyArgs(undefined)).toBeNull()
  })

  it('reads a missing access record as Everyone for every app', () => {
    expect(storedAccessSchema.parse(undefined)).toEqual(everyoneAccessByApp())
    expect(storedAccessSchema.parse('not a record')).toEqual(everyoneAccessByApp())
  })

  it('drops an agent name it does not know, and falls back only for a broken app record', () => {
    const stored = storedAccessSchema.parse({
      engram: {
        agents: { mode: 'weird', ids: [] },
        bots: { mode: 'only', botIds: [], teamIds: [] }
      },
      openmetadata: {
        agents: { mode: 'only', ids: ['codex', 'gemini'] },
        bots: { mode: 'everyone', botIds: [], teamIds: [] }
      },
      github: everyoneAccessPolicy()
    })
    expect(stored.engram).toEqual(everyoneAccessPolicy())
    expect(stored.openmetadata.agents).toEqual({ mode: 'only', ids: ['codex'] })
  })
})

describe('MarketplaceVault state with access policies', () => {
  let home: string
  beforeEach(() => {
    home = makeTempHome()
    installFakeSecretStore(true)
  })
  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
    resetFakeSecretStore()
  })

  it('parses a state file from before access policies and keeps its settings', () => {
    const dir = join(home, '.orca', 'marketplace')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'state.json'),
      JSON.stringify({
        version: 1,
        openMetadata: { url: 'https://om.example.com/mcp', profiles: [] },
        engram: { connected: true, serverUrl: null },
        github: { hidden: false },
        written: { engram: {}, openmetadata: {} }
      })
    )
    const state = new MarketplaceVault(dir).readState()
    expect(state.openMetadata.url).toBe('https://om.example.com/mcp')
    expect(state.engram.connected).toBe(true)
    expect(state.access).toEqual(everyoneAccessByApp())
  })

  it('round trips a policy through the state file', () => {
    const dir = join(home, '.orca', 'marketplace')
    const vault = new MarketplaceVault(dir)
    const state = vault.readState()
    state.access.engram = agentPolicy('only', ['codex'])
    vault.writeState(state)
    expect(new MarketplaceVault(dir).readState().access.engram).toEqual(
      agentPolicy('only', ['codex'])
    )
  })

  it('leaves an agent kept out of one app without that app env vars', () => {
    const dir = join(home, '.orca', 'marketplace')
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata' }, 'om-token')
    vault.writeToken({ kind: 'engram-cloud' }, 'engram-token')
    const state = vault.readState()
    state.openMetadata.url = 'https://om.example.com/mcp'
    state.engram.serverUrl = 'https://engram.example.com'
    state.access.engram = agentPolicy('except', ['codex'])
    vault.writeState(state)

    expect(vault.buildAgentEnv()).toEqual({
      OPENMETADATA_TOKEN: 'om-token',
      ENGRAM_CLOUD_TOKEN: 'engram-token',
      ENGRAM_CLOUD_SERVER: 'https://engram.example.com'
    })
    expect(vault.buildAgentEnv('codex')).toEqual({ OPENMETADATA_TOKEN: 'om-token' })
    expect(vault.buildAgentEnv('claude')).toEqual(vault.buildAgentEnv())
  })
})
