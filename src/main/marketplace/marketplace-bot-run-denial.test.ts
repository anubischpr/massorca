import { describe, expect, it } from 'vitest'
import {
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppStatus
} from '../../shared/marketplace-apps'
import {
  botRunEnvKeysToDelete,
  botRunOfOptions,
  botRunOptions,
  claudeBotRunDisallowedTools,
  deleteBotRunDeniedEnv,
  deniedMarketplaceAppIdsForBot,
  resolveBotRunDenial
} from './marketplace-bot-run-denial'

const BOT = { botId: 'bob', teamId: 't1' }
const ONLY_ANN: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: ['ann'], teamIds: [] }
}

const APPS: MarketplaceAppStatus[] = [
  {
    id: 'engram',
    connected: true,
    agents: [],
    access: ONLY_ANN
  },
  {
    id: 'openmetadata',
    connected: true,
    profiles: [{ name: 'escritura', url: 'https://example.test', hasToken: true }],
    agents: [],
    access: ONLY_ANN
  },
  { id: 'github', connected: true, agents: [], access: ONLY_ANN }
]
const listApps = async (): Promise<MarketplaceAppStatus[]> => APPS

describe('bot run marker', () => {
  it('round-trips through session options and is absent for a plain session', () => {
    expect(botRunOfOptions(botRunOptions(BOT))).toEqual(BOT)
    expect(botRunOfOptions({ model: 'm', accessMode: 'default' })).toBeNull()
    expect(botRunOfOptions(undefined)).toBeNull()
  })
})

describe('resolveBotRunDenial', () => {
  it('names the MCP servers and env vars of every app the bot is kept out of', async () => {
    const denial = await resolveBotRunDenial(botRunOptions(BOT), listApps)
    expect(denial?.mcpServers).toEqual(['engram', 'openmetadata', 'escritura'])
    expect(denial?.envNames).toEqual([
      'ENGRAM_CLOUD_TOKEN',
      'ENGRAM_CLOUD_SERVER',
      'OPENMETADATA_TOKEN',
      'OPENMETADATA_TOKEN_ESCRITURA'
    ])
  })

  it('denies nothing to a bot the policy allows, and to a session that is not a bot run', async () => {
    expect(await resolveBotRunDenial(botRunOptions({ botId: 'ann', teamId: 't1' }), listApps)).toBe(
      null
    )
    expect(await resolveBotRunDenial({ accessMode: 'default' }, listApps)).toBeNull()
  })

  it('does not read the apps for a session that is not a bot run', async () => {
    let reads = 0
    await resolveBotRunDenial(undefined, async () => {
      reads += 1
      return APPS
    })
    expect(reads).toBe(0)
  })

  it('fails closed when the apps cannot be read', async () => {
    const denial = await resolveBotRunDenial(botRunOptions(BOT), async () => {
      throw new Error('unreadable')
    })
    expect(denial?.mcpServers).toEqual(['engram', 'openmetadata'])
    const env = { OPENMETADATA_TOKEN_ANY: 'x', ENGRAM_CLOUD_TOKEN: 'y', PATH: '/bin' }
    expect(deleteBotRunDeniedEnv(env, denial)).toEqual({ PATH: '/bin' })
  })
})

describe('denied env and tools', () => {
  it('deletes only the denied names from the env and leaves a null denial untouched', async () => {
    const denial = await resolveBotRunDenial(botRunOptions(BOT), listApps)
    const env = {
      OPENMETADATA_TOKEN: 't',
      OPENMETADATA_TOKEN_ESCRITURA: 't2',
      ENGRAM_CLOUD_TOKEN: 't3',
      ENGRAM_CLOUD_SERVER: 'https://example.test',
      PATH: '/bin'
    }
    expect(deleteBotRunDeniedEnv({ ...env }, denial)).toEqual({ PATH: '/bin' })
    expect(deleteBotRunDeniedEnv({ ...env }, null)).toEqual(env)
  })

  it('lists the inherited names a spawn must delete, prefixes included', () => {
    expect(
      botRunEnvKeysToDelete(
        { mcpServers: [], envNames: ['A'], envPrefixes: ['TOK_'] },
        { TOK_ONE: '1', OTHER: '2' }
      )
    ).toEqual(['A', 'TOK_ONE'])
  })

  it('turns denied servers into Claude deny rules for all their tools', async () => {
    const denial = await resolveBotRunDenial(botRunOptions(BOT), listApps)
    expect(claudeBotRunDisallowedTools(denial)).toEqual([
      'mcp__engram',
      'mcp__openmetadata',
      'mcp__escritura'
    ])
    expect(claudeBotRunDisallowedTools(null)).toEqual([])
    expect(
      claudeBotRunDisallowedTools({ mcpServers: ['my server'], envNames: [], envPrefixes: [] })
    ).toEqual(['mcp__my_server'])
  })
})

describe('deniedMarketplaceAppIdsForBot', () => {
  it('names the apps for the prompt, GitHub included, and denies all when unreadable', async () => {
    expect(await deniedMarketplaceAppIdsForBot(BOT, listApps)).toEqual([
      'engram',
      'openmetadata',
      'github'
    ])
    expect(await deniedMarketplaceAppIdsForBot({ botId: 'ann', teamId: 't1' }, listApps)).toEqual(
      []
    )
    expect(
      await deniedMarketplaceAppIdsForBot(BOT, async () => {
        throw new Error('unreadable')
      })
    ).toEqual(['engram', 'openmetadata', 'github'])
  })
})
