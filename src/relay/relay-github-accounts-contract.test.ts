import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGitHubAccountsRelayClient } from '../main/github/gh-account-remote-client'

const mocks = vi.hoisted(() => ({
  listGhAccountBindingInventory: vi.fn(),
  switchGhActiveAccount: vi.fn(),
  removeGhAccount: vi.fn()
}))

vi.mock('../main/github/gh-account-binding-inventory', () => ({
  listGhAccountBindingInventory: mocks.listGhAccountBindingInventory
}))
vi.mock('../main/github/gh-account-switch', () => ({
  switchGhActiveAccount: mocks.switchGhActiveAccount
}))
vi.mock('../main/github/gh-account-logout', () => ({
  removeGhAccount: mocks.removeGhAccount
}))

import { GitHubAccountsHandler } from './relay-github-accounts'

type Handler = (params: Record<string, unknown>) => Promise<unknown>

function relayHandlers(): Map<string, Handler> {
  const handlers = new Map<string, Handler>()
  const dispatcher = {
    onRequest: vi.fn((method: string, handler: Handler) => {
      handlers.set(method, handler)
    })
  }
  new GitHubAccountsHandler(dispatcher as never)
  return handlers
}

// Why: a mux the way the SSH relay answers: a method this relay lacks is method-not-found.
function muxServing(handlers: Map<string, Handler>) {
  return {
    isDisposed: () => false,
    request: async (method: string, params?: Record<string, unknown>) => {
      const handler = handlers.get(method)
      if (!handler) {
        throw Object.assign(new Error('method not found'), { code: -32601 })
      }
      return handler(params ?? {})
    }
  }
}

describe('the desktop SSH client against the relay GitHub account handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads this relay list, switch and remove answers', async () => {
    mocks.listGhAccountBindingInventory.mockResolvedValue({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'dev-box',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo']
        }
      ]
    })
    mocks.switchGhActiveAccount.mockResolvedValue({ ok: true })
    mocks.removeGhAccount.mockResolvedValue({ ok: true })
    const client = createGitHubAccountsRelayClient(() => muxServing(relayHandlers()))

    expect(await client.listHostBindableAccounts({ connectionId: 'ssh-1' })).toEqual({
      ok: true,
      inventory: {
        capability: 'supported',
        accounts: [
          {
            host: 'github.com',
            user: 'dev-box',
            active: true,
            envToken: null,
            source: 'keyring',
            scopes: ['repo']
          }
        ]
      }
    })
    expect(
      await client.switchActiveAccount({
        connectionId: 'ssh-1',
        host: 'github.com',
        user: 'dev-box'
      })
    ).toEqual({ ok: true })
    expect(
      await client.removeAccount({ connectionId: 'ssh-1', host: 'github.com', user: 'dev-box' })
    ).toEqual({ ok: true })
  })

  it('reports an older relay without these methods as needing an update', async () => {
    const client = createGitHubAccountsRelayClient(() => muxServing(new Map()))

    expect(await client.listHostBindableAccounts({ connectionId: 'ssh-1' })).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })
})
