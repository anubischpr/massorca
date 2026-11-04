import { afterEach, describe, expect, it } from 'vitest'
import type { RpcContext } from '../core'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import { BOT_TEAM_CONNECTED_APPS_METHODS, connectedAppsSource } from './bot-team-connected-apps'
import { MOBILE_BOT_TEAM_RPC_METHODS } from '../../runtime-rpc/runtime-rpc-mobile-bot-team-methods'

const STATUSES: MarketplaceAppStatus[] = [
  {
    id: 'engram',
    connected: true,
    program: { found: true, version: '1.2.3' },
    serverUrl: 'https://engram.example.test',
    credential: { stored: true },
    agents: []
  },
  {
    id: 'openmetadata',
    connected: true,
    serverUrl: 'https://om.example.test',
    profiles: [{ name: 'prod', url: 'https://om.example.test', hasToken: true }],
    agents: []
  },
  { id: 'github', connected: false, agents: [] }
]

const method = BOT_TEAM_CONNECTED_APPS_METHODS[0]
const ctx: RpcContext = { runtime: {} } as unknown as RpcContext

describe('botTeams.connectedApps', () => {
  const original = connectedAppsSource.listApps
  afterEach(() => {
    connectedAppsSource.listApps = original
  })

  it('returns only connected apps, with their id and name and nothing else', async () => {
    connectedAppsSource.listApps = async () => STATUSES
    const result = await method.handler(undefined, ctx)
    expect(result).toEqual({
      apps: [
        { id: 'engram', name: 'Engram' },
        { id: 'openmetadata', name: 'OpenMetadata' }
      ]
    })
    expect(JSON.stringify(result)).not.toMatch(/https?:|hasToken|profiles|serverUrl|version/)
  })

  it('is a read-only method the phone may call', () => {
    expect(method.name).toBe('botTeams.connectedApps')
    expect(method.params).toBeNull()
    expect(MOBILE_BOT_TEAM_RPC_METHODS).toContain('botTeams.connectedApps')
  })
})
