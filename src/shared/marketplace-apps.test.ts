import { describe, expect, it } from 'vitest'
import {
  everyoneAccessPolicy,
  marketplaceAgentSupportsAppDenial,
  marketplaceAgentSwitchBlockedMessage,
  marketplaceAppMcpServerNames,
  marketplaceAppTokenEnvNames,
  marketplaceAppsDeniedForBot,
  type MarketplaceAppStatus
} from './marketplace-apps'

const openMetadata: MarketplaceAppStatus = {
  id: 'openmetadata',
  connected: true,
  agents: [],
  profiles: [{ name: 'openmetadata-escritura', url: 'https://om.example/mcp', hasToken: true }],
  access: {
    ...everyoneAccessPolicy(),
    bots: { mode: 'except', botIds: ['bot-max'], teamIds: [] }
  }
}
const engram: MarketplaceAppStatus = { id: 'engram', connected: true, agents: [] }

describe('bot enforcement helpers', () => {
  it('lists only connected apps the bot is kept out of', () => {
    expect(
      marketplaceAppsDeniedForBot([openMetadata, engram], { botId: 'bot-max', teamId: 't1' }).map(
        (app) => app.id
      )
    ).toEqual(['openmetadata'])
    expect(
      marketplaceAppsDeniedForBot([openMetadata, engram], { botId: 'bot-ana', teamId: 't1' })
    ).toEqual([])
    expect(
      marketplaceAppsDeniedForBot([{ ...openMetadata, connected: false }], {
        botId: 'bot-max',
        teamId: 't1'
      })
    ).toEqual([])
  })

  it('names the MCP servers and env vars an app brings, profiles included', () => {
    expect(marketplaceAppMcpServerNames(openMetadata)).toEqual([
      'openmetadata',
      'openmetadata-escritura'
    ])
    expect(marketplaceAppTokenEnvNames(openMetadata)).toEqual([
      'OPENMETADATA_TOKEN',
      'OPENMETADATA_TOKEN_OPENMETADATA_ESCRITURA'
    ])
    expect(marketplaceAppMcpServerNames(engram)).toEqual(['engram'])
    expect(marketplaceAppTokenEnvNames(engram)).toEqual([
      'ENGRAM_CLOUD_TOKEN',
      'ENGRAM_CLOUD_SERVER'
    ])
  })
})

describe('agents that cannot drop an app for one bot', () => {
  it('refuses denial only for Antigravity', () => {
    expect(marketplaceAgentSupportsAppDenial('antigravity')).toBe(false)
    expect(marketplaceAgentSupportsAppDenial('claude')).toBe(true)
    expect(marketplaceAgentSupportsAppDenial('pi')).toBe(true)
  })

  it('names the blocked items in the switch message', () => {
    expect(marketplaceAgentSwitchBlockedMessage(['Engram', 'OpenMetadata'])).toContain(
      'this bot is blocked from Engram, OpenMetadata.'
    )
  })
})
