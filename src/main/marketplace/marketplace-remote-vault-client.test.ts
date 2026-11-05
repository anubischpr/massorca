import { describe, expect, it } from 'vitest'
import { createRemoteVaultClient, type RemoteVaultMux } from './marketplace-remote-vault-client'

const TOKEN = 'tok-SECRET-123'
const STATUS = {
  hostLabel: 'ssh-host',
  store: 'key-file',
  credentials: [
    { slot: 'openmetadata', stored: false },
    { slot: 'engram-cloud', stored: false }
  ],
  profiles: [{ name: 'escritura', stored: true, updatedAt: 1_800_000_000_000 }]
}

function clientWith(request: RemoteVaultMux['request']): {
  client: ReturnType<typeof createRemoteVaultClient>
  sent: { method: string; params: Record<string, unknown> | undefined }[]
} {
  const sent: { method: string; params: Record<string, unknown> | undefined }[] = []
  const client = createRemoteVaultClient(() => ({
    isDisposed: () => false,
    request: async (method, params) => {
      sent.push({ method, params })
      return request(method, params)
    }
  }))
  return { client, sent }
}

describe('remote vault client profile tokens', () => {
  it('sends the token of a profile to the new method and keeps the status profiles', async () => {
    const { client, sent } = clientWith(async () => ({ ok: true, status: STATUS }))
    const result = await client.set({ connectionId: 'c1', profile: 'escritura', token: TOKEN })
    expect(sent).toEqual([
      { method: 'marketplace.vault.setProfile', params: { name: 'escritura', token: TOKEN } }
    ])
    expect(result).toEqual({ ok: true, status: STATUS })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it('clears the token of a profile through its own method', async () => {
    const { client, sent } = clientWith(async () => ({ ok: true, status: STATUS }))
    await client.clear({ connectionId: 'c1', profile: 'escritura' })
    expect(sent).toEqual([
      { method: 'marketplace.vault.clearProfile', params: { name: 'escritura' } }
    ])
  })

  it('tells the person to update a relay that has no profile methods', async () => {
    const { client } = clientWith(async (method) => {
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 })
    })
    expect(await client.set({ connectionId: 'c1', profile: 'escritura', token: TOKEN })).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
    expect(await client.clear({ connectionId: 'c1', profile: 'escritura' })).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })

  it('still sends the original slots with the original methods', async () => {
    const { client, sent } = clientWith(async () => ({ ok: true, status: STATUS }))
    await client.set({ connectionId: 'c1', slot: 'openmetadata', token: TOKEN })
    await client.clear({ connectionId: 'c1', slot: 'engram-cloud' })
    expect(sent.map((call) => call.method)).toEqual([
      'marketplace.vault.set',
      'marketplace.vault.clear'
    ])
  })

  it('reads a status from a relay that predates profiles', async () => {
    const { client } = clientWith(async () => ({
      ok: true,
      status: { hostLabel: 'old', store: 'key-file', credentials: STATUS.credentials }
    }))
    const result = await client.status({ connectionId: 'c1' })
    expect(result).toMatchObject({ ok: true, status: { hostLabel: 'old' } })
    expect(result.ok && result.status.profiles).toBeUndefined()
  })

  it.each([
    [{ connectionId: 'c1', profile: 'openmetadata', token: TOKEN }],
    [{ connectionId: 'c1', profile: 'has space', token: TOKEN }],
    [{ connectionId: 'c1', profile: 'escritura', token: 'two words' }],
    [{ connectionId: 'c1', profile: 'escritura' }]
  ])('refuses %j without sending anything', async (args) => {
    const { client, sent } = clientWith(async () => ({ ok: true, status: STATUS }))
    expect(await client.set(args)).toEqual({ ok: false, reason: 'invalid-input' })
    expect(sent).toEqual([])
  })

  it('does not repeat the token when the relay fails', async () => {
    const { client } = clientWith(async () => {
      throw new Error(`boom ${TOKEN}`)
    })
    expect(await client.set({ connectionId: 'c1', profile: 'escritura', token: TOKEN })).toEqual({
      ok: false,
      reason: 'failed'
    })
  })
})
