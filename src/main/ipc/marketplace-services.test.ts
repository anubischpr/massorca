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
vi.mock('../preflight/agent-detection', () => ({
  runPreflightCheck: async () => ({ glab: { installed: false, authenticated: false } }),
  _resetPreflightCache: () => undefined
}))
vi.mock('../bitbucket/credential-connection', () => ({
  connectBitbucket: vi.fn(),
  disconnectBitbucket: vi.fn(),
  getBitbucketConnectionStatus: () => ({
    configured: false,
    source: 'none',
    account: null,
    authMode: null,
    email: null,
    baseUrl: null
  })
}))

import { makeTempHome } from '../marketplace/marketplace-apps-test-fixtures'
import { storedServiceCredentials } from '../marketplace/marketplace-service-credentials'
import { MarketplaceVault } from '../marketplace/marketplace-vault'
import { registerMarketplaceServicesHandlers } from './marketplace-services'

const TOKEN = 'fake-token-SECRET-123'
let home: string
const originalStored = storedServiceCredentials.vault

function invoke(method: string, args?: unknown): Promise<unknown> {
  const handler = handlers.get(`marketplaceServices:${method}`)
  if (!handler) {
    throw new Error(`no handler for ${method}`)
  }
  return Promise.resolve(handler({}, args))
}

beforeEach(() => {
  home = makeTempHome()
  handlers.clear()
  const vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), { sealer: () => null })
  storedServiceCredentials.vault = () => vault
  registerMarketplaceServicesHandlers(() => vault)
})
afterEach(() => {
  storedServiceCredentials.vault = originalStored
  rmSync(home, { recursive: true, force: true })
})

describe('marketplaceServices IPC', () => {
  it('saves a Gitea token on this computer write-only and clears it again', async () => {
    const connected = await invoke('connect', { service: 'gitea', token: TOKEN })
    expect(connected).toMatchObject({
      ok: true,
      status: {
        services: expect.arrayContaining([
          expect.objectContaining({ service: 'gitea', source: 'stored' })
        ])
      }
    })
    expect(JSON.stringify(connected)).not.toContain(TOKEN)

    const cleared = await invoke('disconnect', { service: 'gitea' })
    expect(cleared).toMatchObject({
      ok: true,
      status: { services: expect.arrayContaining([{ service: 'gitea', source: 'none' }]) }
    })
  })

  it('answers invalid-input for arguments it cannot use', async () => {
    expect(await invoke('connect', { service: 'nope', token: TOKEN })).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    expect(await invoke('disconnect', 'gitea')).toEqual({ ok: false, reason: 'invalid-input' })
  })
})
