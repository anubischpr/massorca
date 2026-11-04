import { afterEach, describe, expect, it } from 'vitest'
import type { RpcContext } from '../core'
import {
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppStatus
} from '../../../../shared/marketplace-apps'
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
const TEAM = { id: 't1', bots: [{ id: 'ann' }, { id: 'bob' }] }
const ctx = {
  runtime: { getOrchestrationDb: () => ({ listBotTeams: () => [TEAM] }) }
} as unknown as RpcContext
const NOBODY: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: [], teamIds: [] }
}
const ONLY_BOB: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: ['bob'], teamIds: [] }
}

describe('botTeams.connectedApps', () => {
  const original = connectedAppsSource.listApps
  afterEach(() => {
    connectedAppsSource.listApps = original
  })

  it('returns only connected apps, with their id and name and nothing else', async () => {
    connectedAppsSource.listApps = async () => STATUSES
    const result = await method.handler({}, ctx)
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
    expect(method.params).not.toBeNull()
    expect(MOBILE_BOT_TEAM_RPC_METHODS).toContain('botTeams.connectedApps')
  })

  it('hides an app every bot of the asked team is kept out of, and keeps the rest', async () => {
    connectedAppsSource.listApps = async () => [
      { ...STATUSES[0], access: NOBODY },
      { ...STATUSES[1], access: ONLY_BOB }
    ]
    const result = await method.handler({ teamId: 't1' }, ctx)
    expect(result).toEqual({ apps: [{ id: 'openmetadata', name: 'OpenMetadata' }] })
  })

  it('lists every connected app when no team is asked for, as an older phone does', async () => {
    connectedAppsSource.listApps = async () => [{ ...STATUSES[0], access: NOBODY }]
    expect(await method.handler({}, ctx)).toEqual({ apps: [{ id: 'engram', name: 'Engram' }] })
  })

  it('keeps every app for a team the host does not know', async () => {
    connectedAppsSource.listApps = async () => [{ ...STATUSES[0], access: NOBODY }]
    expect(await method.handler({ teamId: 'gone' }, ctx)).toEqual({
      apps: [{ id: 'engram', name: 'Engram' }]
    })
  })
})
