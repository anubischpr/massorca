import { describe, expect, it, vi } from 'vitest'
import type { RpcResponse } from '../transport/types'
import {
  connectOpenMetadata,
  listMarketplaceApps,
  readHostAgentIds,
  readHostPiRuntimes,
  readHostTools,
  setEngramServer,
  setMarketplaceAppAccess,
  setOpenMetadataToken,
  type MarketplaceHostRpc
} from './marketplace-host-rpc'

function hostAnswering(answer: (method: string, params?: unknown) => RpcResponse) {
  const sendRequest = vi.fn((method: string, params?: unknown) =>
    Promise.resolve(answer(method, params))
  )
  const client: MarketplaceHostRpc = { sendRequest }
  return { client, sendRequest }
}

function succeeded(result: unknown): RpcResponse {
  return { id: 'req', ok: true, result }
}

function failed(): RpcResponse {
  return { id: 'req', ok: false, error: { code: 'method_not_found', message: 'nope' } }
}

describe('listMarketplaceApps', () => {
  it('reads the host list and keeps only the fields the host answers with', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded({
        ok: true,
        apps: [{ id: 'engram', connected: true, agents: [], secret: 'leaked' }]
      })
    )

    const result = await listMarketplaceApps(client)

    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.list')
    expect(result).toEqual({ ok: true, apps: [{ id: 'engram', connected: true, agents: [] }] })
  })

  it('reads an error answer, a malformed answer, or a dropped call as a failed read', async () => {
    const refused = hostAnswering(() => failed())
    const garbled = hostAnswering(() => succeeded({ nope: true }))
    const dropped: MarketplaceHostRpc = {
      sendRequest: () => Promise.reject(new Error('timeout'))
    }

    expect(await listMarketplaceApps(refused.client)).toEqual({ ok: false, reason: 'failed' })
    expect(await listMarketplaceApps(garbled.client)).toEqual({ ok: false, reason: 'failed' })
    expect(await listMarketplaceApps(dropped)).toEqual({ ok: false, reason: 'failed' })
  })
})

describe('Marketplace writes', () => {
  it('connects OpenMetadata with its address and token, and never echoes the token back', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded({
        ok: true,
        status: { id: 'openmetadata', connected: true, agents: [] }
      })
    )

    const result = await connectOpenMetadata(client, {
      url: 'https://meta.example.com',
      token: 'om-secret-token'
    })

    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.connect', {
      id: 'openmetadata',
      url: 'https://meta.example.com',
      token: 'om-secret-token'
    })
    expect(result.ok).toBe(true)
    expect(JSON.stringify(result)).not.toContain('om-secret-token')
  })

  it('replaces the OpenMetadata token with the setOpenMetadataToken call', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded({ ok: true, status: { id: 'openmetadata', connected: true, agents: [] } })
    )

    await setOpenMetadataToken(client, 'new-token')

    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.setOpenMetadataToken', {
      token: 'new-token'
    })
  })

  it('sets the Engram server and its token through setEngramServer', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded({ ok: true, status: { id: 'engram', connected: true, agents: [] } })
    )

    await setEngramServer(client, { url: 'https://engram.example.com', token: 'engram-token' })

    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.setEngramServer', {
      url: 'https://engram.example.com',
      token: 'engram-token'
    })
  })

  it('saves an app access policy through setAccessPolicy', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded({ ok: true, status: { id: 'engram', connected: true, agents: [] } })
    )
    const policy = {
      agents: { mode: 'everyone' as const, ids: [] },
      bots: { mode: 'except' as const, botIds: [], teamIds: ['team-1'] }
    }

    const result = await setMarketplaceAppAccess(client, 'engram', policy)

    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.setAccessPolicy', {
      id: 'engram',
      policy
    })
    expect(result.ok).toBe(true)
  })

  it('passes the host refusal reason through, and reads a dropped write as failed', async () => {
    const refused = hostAnswering(() => succeeded({ ok: false, reason: 'invalid-input' }))
    const dropped: MarketplaceHostRpc = {
      sendRequest: () => Promise.reject(new Error('gone'))
    }

    expect(await setOpenMetadataToken(refused.client, 'x')).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    expect(await setOpenMetadataToken(dropped, 'x')).toEqual({ ok: false, reason: 'failed' })
  })
})

describe('host readers for git, agents and Pi runtimes', () => {
  it('reads git, GitHub CLI and GitLab CLI states from preflight', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded({
        git: { installed: true },
        gh: { installed: true, authenticated: false },
        glab: { installed: false, authenticated: false }
      })
    )

    expect(await readHostTools(client)).toEqual({
      git: true,
      gh: { installed: true, authenticated: false },
      glab: { installed: false, authenticated: false }
    })
    expect(sendRequest).toHaveBeenCalledWith('preflight.check', {})
  })

  it('reads GitLab as unknown when an older host does not report it', async () => {
    const { client } = hostAnswering(() =>
      succeeded({ git: { installed: false }, gh: { installed: false, authenticated: false } })
    )

    expect(await readHostTools(client)).toEqual({
      git: false,
      gh: { installed: false, authenticated: false },
      glab: null
    })
  })

  it('reads the installed agent ids, and null when the answer is not a list', async () => {
    const listed = hostAnswering(() => succeeded(['claude', 'codex']))
    const garbled = hostAnswering(() => succeeded({ agents: [] }))

    expect(await readHostAgentIds(listed.client)).toEqual(new Set(['claude', 'codex']))
    expect(await readHostAgentIds(garbled.client)).toBeNull()
  })

  it('reads the Pi runtimes and drops entries it does not know', async () => {
    const { client, sendRequest } = hostAnswering(() =>
      succeeded(['pi', 'bogus', 'gentle-shell', 'pi'])
    )

    expect(await readHostPiRuntimes(client)).toEqual(['pi', 'gentle-shell'])
    expect(sendRequest).toHaveBeenCalledWith('preflight.detectPiRuntimes')
  })
})
