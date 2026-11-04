import { rmSync, writeFileSync } from 'node:fs'
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
import {
  createRemoteVaultClient,
  type RemoteVaultMux
} from '../marketplace/marketplace-remote-vault-client'
import { registerMarketplaceAppsHandlers } from './marketplace-apps'

const TOKEN = 'tok-SECRET-123'
let home: string
let mux: RemoteVaultMux | undefined
const requests: { method: string; params?: Record<string, unknown> }[] = []

function invoke(method: string, args?: unknown): Promise<unknown> {
  const handler = handlers.get(`marketplaceApps:${method}`)
  if (!handler) {
    throw new Error(`no handler for ${method}`)
  }
  return Promise.resolve(handler({}, args))
}

function registerWith(vault: MarketplaceVault): void {
  registerMarketplaceAppsHandlers(
    createMarketplaceAppsService({
      vault,
      paths: testAgentPaths(home),
      engramProgram: async () => ({ found: false, version: null }),
      githubAuthenticated: async () => false
    }),
    createRemoteVaultClient(() => mux)
  )
}

beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
  installFakeSecretStore(true)
  handlers.clear()
  requests.length = 0
  mux = undefined
  registerWith(new MarketplaceVault(join(home, '.orca', 'marketplace')))
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
        'remoteVaultClear',
        'remoteVaultSet',
        'remoteVaultStatus',
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

  it('reports a vault that cannot get a master key as vault-unavailable', async () => {
    writeFileSync(join(home, 'blocked'), 'x')
    handlers.clear()
    registerWith(
      new MarketplaceVault(join(home, '.orca', 'marketplace'), {
        keyDir: join(home, 'blocked', 'keys')
      })
    )
    expect(
      await invoke('connect', {
        id: 'openmetadata',
        url: 'https://om.example.com/mcp',
        token: TOKEN
      })
    ).toEqual({ ok: false, reason: 'vault-unavailable' })
  })
})

describe('marketplaceApps IPC to an SSH host vault', () => {
  const status = {
    hostLabel: 'srv2056164',
    store: 'key-file',
    credentials: [{ slot: 'openmetadata', stored: true, updatedAt: 1700000000000 }]
  }

  function connectMux(answer: () => unknown): void {
    mux = {
      isDisposed: () => false,
      request: async (method, params) => {
        requests.push({ method, params })
        return answer()
      }
    }
  }

  it('sends the token once and answers with status only', async () => {
    connectMux(() => ({ ok: true, status, echoedToken: TOKEN }))
    const result = await invoke('remoteVaultSet', {
      connectionId: 'c1',
      slot: 'openmetadata',
      token: TOKEN
    })
    expect(result).toEqual({ ok: true, status })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(requests).toEqual([
      { method: 'marketplace.vault.set', params: { slot: 'openmetadata', token: TOKEN } }
    ])
  })

  it('tells the person to update an older host instead of failing', async () => {
    mux = {
      isDisposed: () => false,
      request: async () => {
        throw Object.assign(new Error('Method not found: marketplace.vault.status'), {
          code: -32601
        })
      }
    }
    expect(await invoke('remoteVaultStatus', { connectionId: 'c1' })).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
    expect(
      await invoke('remoteVaultSet', { connectionId: 'c1', slot: 'engram-cloud', token: TOKEN })
    ).toEqual({ ok: false, reason: 'host-needs-update' })
  })

  it('does not repeat the token when the host fails', async () => {
    mux = {
      isDisposed: () => false,
      request: async () => {
        throw new Error(`boom ${TOKEN}`)
      }
    }
    const result = await invoke('remoteVaultSet', {
      connectionId: 'c1',
      slot: 'openmetadata',
      token: TOKEN
    })
    expect(result).toEqual({ ok: false, reason: 'failed' })
  })

  it('reports an SSH host that is not connected as unreachable', async () => {
    expect(await invoke('remoteVaultStatus', { connectionId: 'c1' })).toEqual({
      ok: false,
      reason: 'unreachable'
    })
  })

  it.each([
    ['remoteVaultStatus', {}],
    ['remoteVaultSet', { connectionId: 'c1', slot: 'github', token: TOKEN }],
    ['remoteVaultSet', { connectionId: 'c1', slot: 'openmetadata', token: 'two words' }],
    ['remoteVaultClear', { connectionId: 'c1' }]
  ])('answers invalid-input to %s with %j', async (method, args) => {
    connectMux(() => ({ ok: true, status }))
    expect(await invoke(method, args)).toEqual({ ok: false, reason: 'invalid-input' })
    expect(requests).toEqual([])
  })
})
