import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, args?: unknown) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

import {
  installAllAgents,
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore,
  testAgentPaths
} from '../marketplace/marketplace-apps-test-fixtures'
import { createMarketplaceAppsService } from '../marketplace/marketplace-apps-service'
import { MarketplaceVault } from '../marketplace/marketplace-vault'
import { registerMarketplaceAppsHandlers } from './marketplace-apps'

const TOKEN = 'tok-SECRET-123'
let home: string

function invoke(method: string, args?: unknown): Promise<unknown> {
  const handler = handlers.get(`marketplaceApps:${method}`)
  if (!handler) {
    throw new Error(`no handler for ${method}`)
  }
  return Promise.resolve(handler({}, args))
}

beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
  installFakeSecretStore(true)
  handlers.clear()
  registerMarketplaceAppsHandlers(
    createMarketplaceAppsService({
      vault: new MarketplaceVault(join(home, '.orca', 'marketplace')),
      paths: testAgentPaths(home),
      engramProgram: async () => ({ found: false, version: null }),
      githubAuthenticated: async () => false
    })
  )
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('marketplaceApps IPC', () => {
  it('registers one handler per method of the contract', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        'addOpenMetadataProfile',
        'connect',
        'disconnect',
        'listApps',
        'removeOpenMetadataProfile',
        'setEngramServer',
        'setOpenMetadataToken'
      ].map((method) => `marketplaceApps:${method}`)
    )
  })

  it.each([
    ['connect', undefined],
    ['connect', { id: 'openmetadata', url: 'javascript:alert(1)', token: TOKEN }],
    ['connect', { id: 'openmetadata', url: 'https://x.example', token: 42 }],
    ['disconnect', 'engram'],
    ['setOpenMetadataToken', { token: '' }],
    ['addOpenMetadataProfile', { name: '../x', url: 'https://x.example', token: TOKEN }],
    ['removeOpenMetadataProfile', {}],
    ['setEngramServer', { url: 5 }]
  ])('answers invalid-input to %s with %j', async (method, args) => {
    expect(await invoke(method, args)).toEqual({ ok: false, reason: 'invalid-input' })
  })

  it('stores a token without ever returning or listing it', async () => {
    const connected = await invoke('connect', {
      id: 'openmetadata',
      url: 'https://om.example.com/mcp',
      token: TOKEN
    })
    expect(JSON.stringify(connected)).not.toContain(TOKEN)
    expect(JSON.stringify(await invoke('listApps'))).not.toContain(TOKEN)
    expect(
      JSON.stringify(await invoke('setEngramServer', { url: 'https://e.example', token: TOKEN }))
    ).not.toContain(TOKEN)
  })

  it('reports a vault that cannot encrypt as vault-unavailable', async () => {
    installFakeSecretStore(false)
    expect(
      await invoke('connect', {
        id: 'openmetadata',
        url: 'https://om.example.com/mcp',
        token: TOKEN
      })
    ).toEqual({ ok: false, reason: 'vault-unavailable' })
  })
})
