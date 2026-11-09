import { describe, expect, it, vi } from 'vitest'
import { createGitHubAccountsRelayClient } from './gh-account-remote-client'

type RelayMux = {
  isDisposed: () => boolean
  request: (method: string, params?: Record<string, unknown>) => Promise<unknown>
}

function muxWith(request: RelayMux['request'], disposed = false): RelayMux {
  return { isDisposed: () => disposed, request }
}

const METHOD_NOT_FOUND = Object.assign(new Error('method not found'), { code: -32601 })

describe('createGitHubAccountsRelayClient', () => {
  it('rebuilds the host inventory from known fields only', async () => {
    const request = vi.fn(async () => ({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'dev-box',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo'],
          token: 'gho_secret'
        }
      ]
    }))
    const client = createGitHubAccountsRelayClient(() => muxWith(request))

    const result = await client.listHostBindableAccounts({ connectionId: 'ssh-1' })

    expect(request).toHaveBeenCalledWith('github.listHostBindableAccounts', {})
    expect(result).toEqual({
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
    expect(JSON.stringify(result)).not.toContain('gho_secret')
  })

  it('reports a host that predates the methods as needing an update', async () => {
    const client = createGitHubAccountsRelayClient(() =>
      muxWith(async () => {
        throw METHOD_NOT_FOUND
      })
    )

    expect(await client.listHostBindableAccounts({ connectionId: 'ssh-1' })).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })

  it('reports a missing or disposed connection as unreachable and sends nothing', async () => {
    const request = vi.fn()

    expect(
      await createGitHubAccountsRelayClient(() => undefined).listHostBindableAccounts({
        connectionId: 'ssh-1'
      })
    ).toEqual({ ok: false, reason: 'unreachable' })
    expect(
      await createGitHubAccountsRelayClient(() => muxWith(request, true)).listHostBindableAccounts({
        connectionId: 'ssh-1'
      })
    ).toEqual({ ok: false, reason: 'unreachable' })
    expect(request).not.toHaveBeenCalled()
  })

  it('switches and removes one login by host and user on the host', async () => {
    const request = vi.fn(async () => ({ ok: true }))
    const client = createGitHubAccountsRelayClient(() => muxWith(request))

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
    expect(request).toHaveBeenNthCalledWith(1, 'github.switchActiveAccount', {
      host: 'github.com',
      user: 'dev-box'
    })
    expect(request).toHaveBeenNthCalledWith(2, 'github.removeAccount', {
      host: 'github.com',
      user: 'dev-box'
    })
  })

  it('refuses a malformed connection before any request is sent', async () => {
    const request = vi.fn()
    const client = createGitHubAccountsRelayClient(() => muxWith(request))

    expect(await client.listHostBindableAccounts({ connectionId: '' })).toEqual({
      ok: false,
      reason: 'failed'
    })
    expect(request).not.toHaveBeenCalled()
  })
})
